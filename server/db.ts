import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import { env } from "./config/env";
import {
  DB_POOL_SIZE_PROD,
  DB_POOL_SIZE_DEV,
  DB_IDLE_TIMEOUT_MS,
  DB_CONNECTION_TIMEOUT_MS,
} from "./constants";

neonConfig.webSocketConstructor = ws;

// env.DATABASE_URL is validated at startup - no need for manual check
const poolSize = env.NODE_ENV === "production" ? DB_POOL_SIZE_PROD : DB_POOL_SIZE_DEV;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: poolSize,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
});

export const db = drizzle({ client: pool, schema });
