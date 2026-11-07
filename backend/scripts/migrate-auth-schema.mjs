import { readFileSync } from 'node:fs';
import { Client } from 'pg';

function envValue(key) {
  if (process.env[key]) return process.env[key];
  const source = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const line = source.split(/\r?\n/).find((value) => value.startsWith(`${key}=`));
  const raw = line?.slice(key.length + 1).trim();
  return raw?.replace(/^(['"])(.*)\1$/, '$2');
}

const url = envValue('DATABASE_URL');
if (!url) throw new Error('DATABASE_URL is missing');

const migration = [
  `DO $$ BEGIN
     CREATE TYPE "users_role_enum" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,
  `CREATE TABLE IF NOT EXISTS "users" (
     "id" SERIAL PRIMARY KEY,
     "email" varchar(120) NOT NULL UNIQUE,
     "fullName" varchar(100) NOT NULL,
     "password" varchar(255) NOT NULL,
     "role" "users_role_enum" NOT NULL DEFAULT 'CUSTOMER',
     "isActive" boolean NOT NULL DEFAULT true,
     "tokenVersion" integer NOT NULL DEFAULT 0,
     "createdAt" timestamp NOT NULL DEFAULT now(),
     "updatedAt" timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS "addresses" (
     "id" SERIAL PRIMARY KEY,
     "receiverName" varchar(100) NOT NULL,
     "receiverPhone" varchar(30) NOT NULL,
     "addressLine" varchar(255) NOT NULL,
     "ward" varchar(100) NOT NULL,
     "district" varchar(100) NOT NULL,
     "province" varchar(100) NOT NULL,
     "isDefault" boolean NOT NULL DEFAULT false,
     "userId" integer NOT NULL,
     CONSTRAINT "fk_addresses_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS "refresh_tokens" (
     "id" SERIAL PRIMARY KEY,
     "tokenHash" char(64) NOT NULL UNIQUE,
     "expiresAt" timestamptz NOT NULL,
     "revoked" boolean NOT NULL DEFAULT false,
     "userId" integer NOT NULL,
     "createdAt" timestamp NOT NULL DEFAULT now(),
     CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS "audit_logs" (
     "id" SERIAL PRIMARY KEY,
     "action" varchar(100) NOT NULL,
     "entity" varchar(100) NOT NULL,
     "entityId" varchar(100) NOT NULL,
     "ipAddress" varchar(45),
     "metadata" text,
     "userId" integer,
     "createdAt" timestamp NOT NULL DEFAULT now(),
     CONSTRAINT "fk_audit_logs_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
   )`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "userId" integer`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "addressId" integer`,
  `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingAddressSnapshot" text`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_user') THEN
       ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
     END IF;
   END $$`,
  `CREATE INDEX IF NOT EXISTS "idx_addresses_user" ON "addresses" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs" ("userId")`,
];

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('BEGIN');
  for (const statement of migration) await client.query(statement);
  await client.query('COMMIT');
  console.log('Auth schema migration completed. Existing product and order data was preserved.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
