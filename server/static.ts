import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Support multiple deployment layouts:
  // - production bundle running from `build/index.cjs` => expects `build/public`
  // - older setups running from `dist/index.cjs` => expects `dist/public`
  // - some platforms use `process.cwd()` as the working directory
  const candidates = [
    path.resolve(__dirname, "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "build/public"),
    path.resolve(process.cwd(), "dist/public"),
  ];

  const distPath = candidates.find((p) => fs.existsSync(p));
  if (!distPath) {
    console.warn(
      "[STATIC] Could not find a public/ directory for the client bundle. " +
        `Tried: ${candidates.join(", ")}`
    );
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
