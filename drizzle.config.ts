import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

// const DATABASE_URL = process.env.DB_URL;
const DATABASE_URL = "postgresql://john:john@localhost:5432/jpv";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: './src/db/schema/',
  out: './drizzle',
  dialect: 'postgresql', // 'postgresql' | 'mysql' | 'sqlite'
  dbCredentials: {
    url:DATABASE_URL
  },
});