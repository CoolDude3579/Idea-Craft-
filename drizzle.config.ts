import type { Config } from "drizzle-kit";

const config: Config = {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
};

export { config };
export default config;
