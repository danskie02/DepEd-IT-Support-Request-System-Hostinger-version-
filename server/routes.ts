
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import PgSession from "connect-pg-simple";
import { pool } from "./db";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const MemoryStoreSession = MemoryStore(session);
const PgStore = PgSession(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePassword(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedPasswordBuf = Buffer.from(hashed, "hex");
  const suppliedPasswordBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session setup - use PostgreSQL in production, memory in development
  const sessionStore = process.env.NODE_ENV === "production"
    ? new PgStore({ pool, tableName: "session" })
    : new MemoryStoreSession({ checkPeriod: 86400000 });

  app.use(
    session({
      cookie: { maxAge: 86400000, secure: process.env.NODE_ENV === "production", httpOnly: true, sameSite: "lax" },
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "dev_secret",
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth Routes
  app.post(api.auth.login.path, async (req, res, next) => {
    try {
      const { identifier, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(identifier) || await storage.getUserByEmail(identifier);

      if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await storage.createOtp(user.id, otpCode);
      
      // MOCK OTP SENDING - In production, send via SMS/Email
      console.log(`[OTP] User: ${user.email}, Code: ${otpCode}`);

      // Return success but don't log in fully yet - wait for verify
      // For this MVP, we'll store the pending user ID in session slightly differently or just return it
      // To keep it simple with passport, we can't fully login yet. 
      // We'll return the userId so the frontend can send it with the OTP.
      
      res.json({ userId: user.id, message: "OTP sent to your registered contact" });
    } catch (err) {
      next(err);
    }
  });

  app.post(api.auth.verify.path, async (req, res, next) => {
    try {
      const { userId, code } = api.auth.verify.input.parse(req.body);
      const otp = await storage.getOtp(userId, code);

      if (!otp) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      await storage.deleteOtp(userId);
      await storage.updateUserVerified(userId, true);

      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post(api.auth.register.path, async (req, res, next) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });

      res.status(201).json({ userId: user.id, message: "Registration successful. Please login." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        next(err);
      }
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).send();
    }
  });

  // Request Routes
  app.get(api.requests.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    const user = req.user;
    
    // If admin, show all. If user, show only theirs.
    const requests = await storage.getRequests(user.role === 'admin' ? undefined : user.id);
    res.json(requests);
  });

  app.post(api.requests.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    try {
      const input = api.requests.create.input.parse(req.body);
      // @ts-ignore
      const request = await storage.createRequest(req.user.id, input);
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

  app.get(api.requests.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    const request = await storage.getRequest(Number(req.params.id));
    if (!request) return res.status(404).json({ message: "Not found" });
    
    // @ts-ignore
    if (req.user.role !== 'admin' && request.userId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    
    res.json(request);
  });

  app.patch(api.requests.updateStatus.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin only" });

    try {
      const { status, adminResponse } = api.requests.updateStatus.input.parse(req.body);
      const updated = await storage.updateRequestStatus(Number(req.params.id), status, adminResponse);
      
      if (!updated) return res.status(404).json({ message: "Not found" });
      
      // MOCK SMS Notification
      console.log(`[SMS] Request ${updated.id} status updated to ${status}. Response: ${adminResponse}`);

      res.json(updated);
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

  // Seed Admin User
  const adminUser = await storage.getUserByUsername("admin");
  if (!adminUser) {
    const hashed = await hashPassword("admin123");
    await storage.createUser({
      username: "admin",
      name: "System Administrator",
      email: "admin@deped.gov.ph",
      phone: "09000000000",
      password: hashed,
      role: "admin",
      isVerified: true
    });
    console.log("Seeded admin user (admin/admin123)");
  }

  return httpServer;
}
