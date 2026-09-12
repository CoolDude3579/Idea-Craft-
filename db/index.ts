import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

/** null when DATABASE_URL is unset: the prototype runs stateless without it. */
export function getDb(): Database | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!cached) {
    cached = drizzle(postgres(url, { prepare: false, max: 1 }), { schema });
  }
  return cached;
}

export { schema };
