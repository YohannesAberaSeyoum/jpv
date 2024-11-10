import dotenv from 'dotenv';
import { drizzle } from "drizzle-orm/node-postgres";
import pg from 'pg';
import * as schema from './schema/jpv.js';
const { Client } = pg;
dotenv.config();

// const DATABASE_URL = process.env.DB_URL;
const DATABASE_URL = "postgresql://john:john@localhost:5432/jpv";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = new Client({connectionString: DATABASE_URL});
await client.connect()
export const db = drizzle(client, {schema});