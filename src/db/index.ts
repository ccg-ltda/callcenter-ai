import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

let dbInstance: any;

if (connectionString && connectionString !== '') {
  try {
    const client = postgres(connectionString, { prepare: false });
    dbInstance = drizzle(client, { schema });
  } catch (error) {
    console.error('Failed to initialize database client:', error);
    dbInstance = createDbMockProxy();
  }
} else {
  dbInstance = createDbMockProxy();
}

function createDbMockProxy() {
  console.warn('[DB WARNING] DATABASE_URL is not defined. Drizzle ORM client running in Mock/Proxy mode.');
  return new Proxy({}, {
    get(target, prop) {
      // Return a function that mimics Drizzle's query structures to prevent server crash
      return () => {
        console.warn(`[DB MOCK] Database operation '${String(prop)}' was intercepted.`);
        return {
          select: () => ({ from: () => Promise.resolve([]) }),
          insert: () => ({ values: () => Promise.resolve({ returning: () => Promise.resolve([]) }) }),
          update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
          delete: () => ({ where: () => Promise.resolve([]) }),
          execute: () => Promise.resolve([]),
        };
      };
    }
  });
}

export const db = dbInstance;
export * as schema from './schema';
