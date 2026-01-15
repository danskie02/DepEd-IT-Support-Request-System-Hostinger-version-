
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
    }
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
        status: z.enum(["approved", "denied"]),
        adminResponse: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
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
