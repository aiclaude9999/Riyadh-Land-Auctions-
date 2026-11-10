import { PrismaClient } from '@prisma/client';

/** Neon's pooled connection string (host contains "-pooler") needs pgbouncer mode for Prisma. */
function databaseUrl(): string | undefined {
  let u = process.env.DATABASE_URL;
  if (!u) return u;
  const add = (kv: string) => (u = u + (u!.includes('?') ? '&' : '?') + kv);
  if (u.includes('-pooler') && !u.includes('pgbouncer=')) add('pgbouncer=true');
  // enough connections for parallel ingest (Prisma's default is only cpus*2+1)
  if (!u.includes('connection_limit=') && process.env.DATABASE_POOL) add(`connection_limit=${process.env.DATABASE_POOL}`);
  return u;
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
