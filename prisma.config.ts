// prisma.config.ts — Prisma 7.x configuration
// Connection URLs are configured here (not in schema.prisma — Prisma 7 requirement).
//
// TWO CONNECTION STRINGS REQUIRED (Neon PostgreSQL with PgBouncer):
//   DATABASE_URL = Pooled connection  — used by Prisma Client at runtime
//   DIRECT_URL   = Direct connection  — used by `prisma db push` / `prisma migrate dev`
//
// IMPORTANT: prisma.config.ts `datasource.url` is used for ALL Prisma CLI commands
// (db push, migrate dev, etc.). For Neon, set this to DIRECT_URL so that migration
// commands bypass PgBouncer (which doesn't support multi-statement DDL transactions).
// At runtime, the PrismaClient constructor receives DATABASE_URL via the adapter.
//
// To push schema changes: ensure DIRECT_URL is set in .env.local before running
// `npx prisma db push`. This file reads DIRECT_URL for CLI commands.

import "dotenv/config";
import { config as loadEnvLocal } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local for local development (Next.js convention — takes precedence over .env)
loadEnvLocal({ path: ".env.local", override: true });

// For CLI commands (db push, migrate), use the direct (non-pooled) connection.
// The Neon PgBouncer pooled URL causes "prepared statement" errors during DDL.
const migrationUrl = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Using DIRECT_URL for CLI commands — bypasses PgBouncer for DDL operations.
    // Falls back to DATABASE_URL if DIRECT_URL is not set.
    url: migrationUrl,
  },
});
