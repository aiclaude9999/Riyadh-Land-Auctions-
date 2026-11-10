import { PrismaClient } from '@prisma/client';

/** Neon's pooled connection string (host contains "-pooler") needs pgbouncer mode for Prisma. */
function databaseUrl(): string | undefined {
  const u = process.env.DATABASE_URL;
  if (!u || !u.includes('-pooler') || u.includes('pgbouncer=')) return u;
  return u + (u.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
