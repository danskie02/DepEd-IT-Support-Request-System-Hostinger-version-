
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
// DISABLED: Telegram service is temporarily suspended
// import { sendOtpViaMultipleChannels, sendTelegramMessage, notifyUserRequestUpdate, notifyUserRequestUpdateSms } from "./telegram";
// Using email and SMS only
import { sendOtpViaEmail, notifyUserRequestUpdateSms } from "./telegram";
import { sendOtpViaSms } from "./sms";

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
      
      // Send OTP via Email and SMS (Telegram is disabled)
      const emailResult = await sendOtpViaEmail(user.email, otpCode, user.name);
      const smsResult = await sendOtpViaSms(user.phone, otpCode);

      console.log(`[OTP SENT] User: ${user.email}, Code: ${otpCode}`);
      console.log(`[OTP CHANNELS] Email: ${emailResult.success ? 'Sent' : 'Failed'}, SMS: ${smsResult.success ? 'Sent' : 'Failed'}`);

      // Return success but don't log in fully yet - wait for verify
      // For this MVP, we'll store the pending user ID in session slightly differently or just return it
      // To keep it simple with passport, we can't fully login yet. 
      // We'll return the userId so the frontend can send it with the OTP.
      
      res.json({ 
        userId: user.id, 
        message: "OTP sent to your registered email and phone."
      });
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
      
      // Send confirmation message to user's Telegram (optional)
      // @ts-ignore
      const user = req.user;
      if (user?.telegramChatId) {
        // DISABLED: Telegram notifications are suspended
        // const message = `📝 <b>Request Submitted Successfully</b>\n\n` +
        //   `<b>Request ID:</b> #${request.id}\n` +
        //   `<b>Title:</b> ${request.title}\n` +
        //   `<b>Status:</b> <code>Pending</code>\n\n` +
        //   `Your request has been received and is awaiting admin review.\n\n` +
        //   `📱 <b>Track your request:</b>\n` +
        //   `<a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/requests/${request.id}">View Request</a>\n\n` +
        //   `We'll notify you when there's an update! 🎓`;
        // 
        // if (user?.telegramChatId) {
        //   await sendTelegramMessage(user.telegramChatId, message);
        //   console.log(`[REQUEST CREATED - TELEGRAM CONFIRMATION] Request #${request.id}, User: ${user.name}`);
        // }
      }
      
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
      
      // Fetch user details to send notifications
      const user = await storage.getUser(updated.userId);
      
      // DISABLED: Telegram notifications are suspended
      // if (user && user.telegramChatId) {
      //   // Send Telegram notification to user about request status update
      //   await notifyUserRequestUpdate(
      //     user.telegramChatId,
      //     updated.id,
      //     updated.title,
      //     status as 'approved' | 'denied' | 'pending',
      //     adminResponse,
      //     user.name
      //   );
      // } else if (!user?.telegramChatId) {
      //   console.log(`[REQUEST UPDATE] User ${user?.name} (ID: ${updated.userId}) has not linked Telegram. They will need to check the website.`);
      // }

      // Send SMS notification (if phone is present + SMS gateway configured)
      if (user?.phone) {
        const smsOk = await notifyUserRequestUpdateSms(
          user.phone,
          user.id,
          updated.id,
          updated.title,
          status as 'approved' | 'denied' | 'pending',
          adminResponse,
        );
        console.log(`[REQUEST UPDATE - SMS] ${smsOk ? 'Sent' : 'Skipped/Failed'} for Request #${updated.id}`);
      }

      console.log(`[REQUEST STATUS UPDATED] Request #${updated.id} by admin, Status: ${status}, User: ${user?.name}`);

      res.json(updated);
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

  // DISABLED: Telegram Bot Webhook - Telegram service is temporarily suspended
  // app.post('/api/telegram/webhook', async (req, res) => {
  //   try {
  //     const { message } = req.body;

  //     if (!message || !message.text) {
  //       return res.json({ ok: true });
  //     }

  //     const chatId = message.chat.id;
  //     const text = message.text.trim();
  //     const firstName = message.chat.first_name;

  //     console.log(`[TELEGRAM BOT] Chat ID: ${chatId}, Message: ${text}`);

  //     // Handle /start command
  //     if (text === '/start') {
  //       const welcomeMsg = `👋 Welcome to <b>DepEd IT Services</b>!\n\nTo receive OTP codes here, link your account:\n\n/link <email>\n\nExample: <code>/link juan@deped.gov.ph</code>`;
  //       await sendTelegramMessage(chatId, welcomeMsg);
  //       return res.json({ ok: true });
  //     }

  //     // Handle /link command to link account
  //     if (text.startsWith('/link')) {
  //       const email = text.replace('/link', '').trim();

  //       if (!email || !email.includes('@')) {
  //         await sendTelegramMessage(chatId, '❌ Invalid format. Use: /link <email>\n\nExample: /link juan@deped.gov.ph');
  //         return res.json({ ok: true });
  //       }

  //       const user = await storage.getUserByEmail(email);

  //       if (!user) {
  //         await sendTelegramMessage(chatId, `❌ No account found for ${email}. Please register first at the DepEd IT Services portal.`);
  //         return res.json({ ok: true });
  //       }

  //       // Update user's telegram chat ID
  //       await storage.updateUserTelegramChatId(user.id, chatId.toString());

  //       const confirmMsg = `✅ <b>Account Linked!</b>\n\nYour account ${email} is now linked.\n\n🔐 You will receive OTP codes via Telegram during login.`;
  //       await sendTelegramMessage(chatId, confirmMsg);

  //       console.log(`[TELEGRAM LINKED] User: ${email}, Chat ID: ${chatId}`);
  //       return res.json({ ok: true });
  //     }

  //     // Handle /unlink command
  //     if (text === '/unlink') {
  //       const user = await storage.getUserByTelegramChatId(chatId.toString());

  //       if (!user) {
  //         await sendTelegramMessage(chatId, '❌ This Telegram account is not linked to any user.');
  //         return res.json({ ok: true });
  //       }

  //       await storage.updateUserTelegramChatId(user.id, '');

  //       const unlinkMsg = `✅ <b>Account Unlinked!</b>\n\nYour Telegram has been unlinked from your account.`;
  //       await sendTelegramMessage(chatId, unlinkMsg);

  //       console.log(`[TELEGRAM UNLINKED] User: ${user.email}, Chat ID: ${chatId}`);
  //       return res.json({ ok: true });
  //     }

  //     // Handle /help command
  //     if (text === '/help') {
  //       const helpMsg = `📖 <b>Available Commands</b>\n\n/start - Welcome message\n/link &lt;email&gt; - Link your account\n/unlink - Unlink your account\n/help - Show this message`;
  //       await sendTelegramMessage(chatId, helpMsg);
  //       return res.json({ ok: true });
  //     }

  //     // Default response for unknown commands
  //     const defaultMsg = `ℹ️ I didn't understand that command. Try /help for available commands.`;
  //     await sendTelegramMessage(chatId, defaultMsg);

  //     return res.json({ ok: true });
  //   } catch (err) {
  //     console.error('[TELEGRAM WEBHOOK ERROR]', err);
  //     res.json({ ok: true }); // Always return 200 to Telegram
  //   }
  // });

  // Admin Profile Update Endpoint
  app.post('/api/admin/profile', async (req, res) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden - Admin access required' });
      }

      const { email, phone } = req.body;

      // Validate email
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email is required' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Validate phone (optional but should be valid if provided)
      if (phone && typeof phone !== 'string') {
        return res.status(400).json({ message: 'Invalid phone format' });
      }

      // Update user profile
      await storage.updateAdminProfile(req.user.id, {
        email: email.trim(),
        phone: phone?.trim() || '',
      });

      console.log(`[ADMIN PROFILE] Admin ${req.user.username} updated profile - Email: ${email}, Phone: ${phone || 'Not provided'}`);

      // Fetch updated user
      const updatedUser = await storage.getUserById(req.user.id);

      res.json({
        ok: true,
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      console.error('[ADMIN PROFILE ERROR]', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // TEST ENDPOINT: Send Test Email
  app.post('/api/test-email', async (req, res) => {
    try {
      const { email, otpCode } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      console.log(`[TEST EMAIL] Attempting to send email to ${email} with code ${otpCode || '123456'}`);

      const { sendOtpViaEmail } = await import('./telegram');
      const result = await sendOtpViaEmail(email, otpCode || '123456', 'Test User');

      console.log(`[TEST EMAIL] Result:`, result);

      res.json({
        success: result.success,
        message: result.message,
        sent_to: email,
      });
    } catch (error) {
      console.error('[TEST EMAIL ERROR]', error);
      res.status(500).json({ 
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // User Management Routes (Admin Only)
  app.get(api.users.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin only" });

    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error('[LIST USERS ERROR]', error);
      res.status(500).json({ message: 'Failed to retrieve users' });
    }
  });

  app.post(api.users.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin only" });

    try {
      const input = api.users.create.input.parse(req.body);

      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(input.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(input.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await hashPassword(input.password);

      // Create user
      const newUser = await storage.createUser({
        username: input.username,
        email: input.email,
        phone: input.phone,
        name: input.name,
        password: hashedPassword,
        role: input.role,
      });

      res.status(201).json({ 
        id: newUser.id, 
        message: `User ${input.username} created successfully` 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        console.error('[CREATE USER ERROR]', error);
        res.status(500).json({ message: 'Failed to create user' });
      }
    }
  });

  app.patch(api.users.updatePassword.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin only" });

    try {
      const userId = Number(req.params.id);
      const { password } = api.users.updatePassword.input.parse(req.body);

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(password);

      // Update password
      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ message: `Password for user ${user.name} updated successfully` });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        console.error('[UPDATE PASSWORD ERROR]', error);
        res.status(500).json({ message: 'Failed to update password' });
      }
    }
  });

  app.patch(api.users.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin only" });

    try {
      const userId = Number(req.params.id);
      const input = api.users.update.input.parse(req.body);

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user details
      const updated = await storage.updateUser(userId, input);

      res.json({ 
        message: "User updated successfully", 
        user: updated 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        console.error('[UPDATE USER ERROR]', error);
        res.status(500).json({ message: 'Failed to update user' });
      }
    }
  });

  app.delete(api.users.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    // @ts-ignore
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin only" });

    try {
      const userId = Number(req.params.id);

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting the admin user
      if (user.role === 'admin' && user.username === 'admin') {
        return res.status(403).json({ message: "Cannot delete the system admin account" });
      }

      // Delete user
      await storage.deleteUser(userId);

      res.json({ message: `User ${user.name} deleted successfully` });
    } catch (error) {
      console.error('[DELETE USER ERROR]', error);
      res.status(500).json({ message: 'Failed to delete user' });
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
