import { config } from "dotenv";
config({ override: true }); // Override system environment variables with .env file
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { initializeTelegramPolling } from "./telegram";
import { createServer } from "http";

const app = express();
// when running behind Render (or any proxy) we must trust the proxy so that
// secure cookies and client IPs are handled correctly. express-session will
// otherwise refuse to set cookies over HTTPS.
app.set('trust proxy', 1);

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Initialize Telegram bot polling mode
  // DISABLED: Telegram service is temporarily suspended
  // try {
  //   await initializeTelegramPolling();
  // } catch (error) {
  //   console.error('[TELEGRAM] Failed to initialize polling:', error);
  //   // Don't fail the entire server if Telegram initialization fails
  // }

  // start in-process SMS worker if we're using pull mode so that jobs
  // created by this server are immediately picked up.  Previously the
  // worker had to be launched separately which meant a misconfigured Pi
  // running only `npm run start` would enqueue messages and never send
  // them until the process was restarted (when someone finally remembered
  // to run the worker manually).  The new behaviour mirrors the old one
  // but keeps a single process working for most deployments.
  if ((process.env.SMS_MODE || 'push').toLowerCase().trim() === 'pull') {
    try {
      const { startSmsWorker } = await import('./smsWorker');
      startSmsWorker().catch((e) => console.error('[SMS WORKER] failed', e));
    } catch (e) {
      console.error('[SMS WORKER] could not be initialized:', e);
    }
  }

  // schedule periodic administrative SMS digests (11 AM & 3 PM local time)
  try {
    const { startAdminSchedulers } = await import('./adminNotifier');
    startAdminSchedulers();
    console.log('[ADMIN SMS] schedulers initialized');
  } catch (e) {
    console.error('[ADMIN SMS] could not start schedulers', e);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
