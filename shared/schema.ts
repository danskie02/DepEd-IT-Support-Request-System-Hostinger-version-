
import { pgTable, text, serial, integer, boolean, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "denied"]);
export const smsJobStatusEnum = pgEnum("sms_job_status", ["pending", "sending", "sent", "failed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(), // For admin
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  telegramChatId: text("telegram_chat_id"), // Telegram chat ID for OTP delivery
  role: userRoleEnum("role").default("user").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // e.g., Hardware, Software, Network
  priority: text("priority").default("medium").notNull(),
  office: text("office").notNull(), // e.g., HR, SDS, ASDS, SGOD, CID, Medical Unit, Legal Unit, Accounting Unit
  status: requestStatusEnum("status").default("pending").notNull(),
  adminResponse: text("admin_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const otps = pgTable("otps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const smsJobs = pgTable("sms_jobs", {
  id: serial("id").primaryKey(),
  to: text("to").notNull(),
  message: text("message").notNull(),
  kind: text("kind").notNull(), // otp | request_update | other
  userId: integer("user_id").references(() => users.id),
  requestId: integer("request_id").references(() => requests.id),
  status: smsJobStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const requestsRelations = relations(requests, ({ one }) => ({
  user: one(users, {
    fields: [requests.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  requests: many(requests),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, isVerified: true });
export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, userId: true, status: true, adminResponse: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;

// API Types
export type LoginRequest = { identifier: string; password: string }; // username or email
export type VerifyOtpRequest = { userId: number; code: string };
export type CreateRequestPayload = InsertRequest;
export type UpdateRequestStatusPayload = { status: "approved" | "denied"; adminResponse?: string };
