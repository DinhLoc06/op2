import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const rawUrl = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
const databaseUrl = rawUrl?.replace(/^(['"])(.*)\1$/, '$2');
if (!databaseUrl) throw new Error('DATABASE_URL is missing');
const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const result = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'addresses', 'refresh_tokens', 'audit_logs', 'orders')
    ORDER BY table_name, ordinal_position
  `);
  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
