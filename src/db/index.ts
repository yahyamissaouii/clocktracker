import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cache } from 'react';
import * as schema from './schema';

const createDb = cache(() => {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL is not configured');
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
  });

  return drizzle(client, { schema });
});

/**
 * Cloudflare Workers must not reuse a module-level Postgres client between
 * requests. Keep the existing call sites compatible while creating the
 * Drizzle client in the current request context.
 */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, property) {
    const instance = createDb();
    const value = Reflect.get(instance, property);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
