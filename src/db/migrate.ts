// migrate.ts
import dotenv from 'dotenv';
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from 'pg';
const { Client } = pg;

dotenv.config();
// const DATABASE_URL = process.env.DB_URL;
const DATABASE_URL = "postgresql://john:john@localhost:5432/jpv";


if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const migrationClient = new Client({
  connectionString: DATABASE_URL
});
await migrationClient.connect()
const db = drizzle(migrationClient);

const main = async () => {
  console.log("Migrating database...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  await migrationClient.end();
  console.log("Database migrated successfully!");
};

main();