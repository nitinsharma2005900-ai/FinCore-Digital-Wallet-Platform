import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// PostgreSQL migration scripts contain procedural bodies. Send each whole script through
// the simple-query protocol using pg via Prisma's PostgreSQL connector is unsupported;
// psql is the deliberate migration executor, never used with untrusted SQL.
import { spawnSync } from 'node:child_process';
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
const db = new PrismaClient({datasourceUrl:url});
async function main() {
 await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "SchemaMigration" (name text PRIMARY KEY, "appliedAt" timestamptz NOT NULL DEFAULT now())');
 const psql = process.env.PSQL_BIN || (process.platform==='win32' ? resolve('.tools/pgsql/bin/psql.exe') : 'psql');
 for (const name of readdirSync('database/migrations').filter(n=>n.endsWith('.sql')).sort()) {
  const done = await db.$queryRaw<{name:string}[]>`SELECT name FROM "SchemaMigration" WHERE name=${name}`;
  if (done.length) continue;
  readFileSync(resolve('database/migrations',name));
  const u = new URL(url!);
  const result=spawnSync(psql,['-h',u.hostname,'-p',u.port||'5432','-U',u.username,'-d',u.pathname.slice(1),'-v','ON_ERROR_STOP=1','-1','-f',resolve('database/migrations',name)],{stdio:'inherit',env:{...process.env,PGPASSWORD:decodeURIComponent(u.password)}});
  if(result.status!==0) throw new Error('Migration failed: '+name);
  await db.$executeRaw`INSERT INTO "SchemaMigration" (name) VALUES (${name})`;
  console.log('Applied',name);
 }
 // Runtime role is not the table owner and cannot disable triggers, TRUNCATE, or alter schema.
 await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO fincore_app');
 await db.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fincore_app');
 await db.$executeRawUnsafe('REVOKE UPDATE, DELETE ON "LedgerEntry", "Audit" FROM fincore_app');
 await db.$executeRawUnsafe('REVOKE ALL ON "SchemaMigration" FROM fincore_app');
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1;});
