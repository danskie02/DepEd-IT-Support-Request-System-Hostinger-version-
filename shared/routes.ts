
import { z } from 'zod';
import { insertUserSchema, insertRequestSchema, users, requests } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        identifier: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.object({ userId: z.number(), message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    adminLogin: {
      method: 'POST' as const,
      path: '/api/auth/admin-login',
      input: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ userId: z.number(), message: z.string() }),
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
    userLogin: {
      method: 'POST' as const,
      path: '/api/auth/user-login',
      input: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ userId: z.number(), message: z.string() }),
        401: errorSchemas.unauthorized,
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/auth/verify',
      input: z.object({
        userId: z.number(),
        code: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: insertUserSchema,
      responses: {
        201: z.object({ userId: z.number(), message: z.string() }),
        400: errorSchemas.validation,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: z.void(),
      },
    },
    profile: {
      method: 'POST' as const,
      path: '/api/admin/profile',
      input: z.object({
        email: z.string().email('Invalid email format'),
        phone: z.string().min(1, 'Phone is required'),
      }),
      responses: {
        200: z.object({
          ok: z.boolean(),
          message: z.string(),
          user: z.custom<typeof users.$inferSelect>(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
    checkUser: {
      method: 'POST' as const,
      path: '/api/auth/check-user',
      input: z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }),
      responses: {
        200: z.object({ exists: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
    contactInfo: {
      method: 'GET' as const,
      path: '/api/auth/contact-info/:userId',
      responses: {
        200: z.object({
          email: z.string(),
          phone: z.string(),
          name: z.string(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
  requests: {
    list: {
      method: 'GET' as const,
      path: '/api/requests',
      responses: {
        200: z.array(z.custom<typeof requests.$inferSelect & { user: typeof users.$inferSelect }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/requests/:id',
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/requests',
      input: insertRequestSchema,
      responses: {
        201: z.custom<typeof requests.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/requests/:id/status',
      input: z.object({
        status: z.enum(["on_going", "finished"]),
        adminResponse: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/admin/users',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/admin/users',
      input: z.object({
        username: z.string().min(3, 'Username must be at least 3 characters'),
        email: z.string().email('Invalid email format'),
        phone: z.string().min(1, 'Phone is required'),
        name: z.string().min(1, 'Name is required'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        role: z.enum(['user', 'admin']).default('user'),
      }),
      responses: {
        201: z.object({ id: z.number(), message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
      },
    },
    updatePassword: {
      method: 'PATCH' as const,
      path: '/api/admin/users/:id/password',
      input: z.object({
        password: z.string().min(6, 'Password must be at least 6 characters'),
      }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/admin/users/:id',
      input: z.object({
        email: z.string().email('Invalid email format').optional(),
        phone: z.string().min(1, 'Phone is required').optional(),
        name: z.string().min(1, 'Name is required').optional(),
        role: z.enum(['user', 'admin']).optional(),
      }),
      responses: {
        200: z.object({ message: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/admin/users/:id',
      responses: {
        200: z.object({ message: z.string() }),
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// Input schemas for type inference
const loginInputSchema = z.object({
  identifier: z.string(),
  password: z.string(),
});

const verifyInputSchema = z.object({
  userId: z.number(),
  code: z.string(),
});

// Type exports for client usage
export type LoginRequest = z.infer<typeof loginInputSchema>;
export type VerifyOtpRequest = z.infer<typeof verifyInputSchema>;
export type CreateRequestPayload = z.infer<typeof insertRequestSchema>;
export type UpdateRequestStatusPayload = z.infer<typeof api.requests.updateStatus.input>;
