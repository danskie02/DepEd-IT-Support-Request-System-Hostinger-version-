
import { db } from "./db";
import {
  users, requests, otps,
  type User, type InsertUser,
  type Request, type InsertRequest,
  type InsertRequest as CreateRequestPayload
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByTelegramChatId(chatId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserVerified(id: number, verified: boolean): Promise<void>;
  updateUserTelegramChatId(id: number, chatId: string): Promise<void>;
  updateAdminProfile(id: number, data: { email: string; phone: string }): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  deleteUser(id: number): Promise<void>;
  
  // OTP operations
  createOtp(userId: number, code: string): Promise<void>;
  getOtp(userId: number, code: string): Promise<typeof otps.$inferSelect | undefined>;
  deleteOtp(userId: number): Promise<void>;

  // Request operations
  getRequests(userId?: number): Promise<(Request & { user: User })[]>; // Optional userId filter
  getRequest(id: number): Promise<Request | undefined>;
  createRequest(userId: number, request: CreateRequestPayload): Promise<Request>;
  updateRequestStatus(id: number, status: "approved" | "denied", response?: string): Promise<Request | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUserVerified(id: number, verified: boolean): Promise<void> {
    await db.update(users).set({ isVerified: verified }).where(eq(users.id, id));
  }

  async getUserByTelegramChatId(chatId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramChatId, chatId));
    return user;
  }

  async updateUserTelegramChatId(id: number, chatId: string): Promise<void> {
    await db.update(users).set({ telegramChatId: chatId }).where(eq(users.id, id));
  }

  async updateAdminProfile(id: number, data: { email: string; phone: string }): Promise<void> {
    await db.update(users).set({ 
      email: data.email,
      phone: data.phone 
    }).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.id);
  }

  async updateUser(id: number, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async createOtp(userId: number, code: string): Promise<void> {
    // Delete existing OTPs for user first
    await this.deleteOtp(userId);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await db.insert(otps).values({ userId, code, expiresAt });
  }

  async getOtp(userId: number, code: string): Promise<typeof otps.$inferSelect | undefined> {
    const [otp] = await db.select().from(otps)
      .where(eq(otps.userId, userId));
    
    // Check code match and expiry
    if (otp && otp.code === code && new Date() < otp.expiresAt) {
      return otp;
    }
    return undefined;
  }

  async deleteOtp(userId: number): Promise<void> {
    await db.delete(otps).where(eq(otps.userId, userId));
  }

  async getRequests(userId?: number): Promise<(Request & { user: User })[]> {
    const query = db.select({
      id: requests.id,
      userId: requests.userId,
      title: requests.title,
      description: requests.description,
      category: requests.category,
      priority: requests.priority,
      status: requests.status,
      adminResponse: requests.adminResponse,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      user: users
    })
    .from(requests)
    .innerJoin(users, eq(requests.userId, users.id))
    .orderBy(desc(requests.createdAt));

    if (userId) {
      query.where(eq(requests.userId, userId));
    }

    // @ts-ignore - Drizzle relation join typing can be tricky, but runtime is correct
    return await query;
  }

  async getRequest(id: number): Promise<Request | undefined> {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  }

  async createRequest(userId: number, request: CreateRequestPayload): Promise<Request> {
    const [newReq] = await db.insert(requests).values({ ...request, userId }).returning();
    return newReq;
  }

  async updateRequestStatus(id: number, status: "approved" | "denied", response?: string): Promise<Request | undefined> {
    const [updated] = await db.update(requests)
      .set({ status, adminResponse: response, updatedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
