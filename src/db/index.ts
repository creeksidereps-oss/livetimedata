import { drizzle } from "drizzle-orm/vercel-postgres";
import { pool } from "@/lib/db";
import * as schema from "./schema";

export const db = drizzle(pool, { schema });