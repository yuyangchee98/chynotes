import type Database from 'better-sqlite3'

/**
 * Migration system for chynotes database
 *
 * Each migration has:
 * - version: unique identifier (timestamp-based recommended)
 * - name: human-readable description
 * - up: SQL or function to run
 */

interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

/**
 * All migrations in order
 * Add new migrations to the end of this array
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'add_tag_prompts_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tag_prompts (
          id INTEGER PRIMARY KEY,
          tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          prompt TEXT NOT NULL,
          response TEXT,
          updated_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_tag_prompts_tag ON tag_prompts(tag_id);
      `)
    },
  },
]

/**
 * Ensure the migrations tracking table exists
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)
}

/**
 * Get all applied migration versions
 */
function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]
  return new Set(rows.map(r => r.version))
}

/**
 * Mark a migration as applied
 */
function markApplied(db: Database.Database, migration: Migration): void {
  db.prepare(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `).run(migration.version, migration.name, Date.now())
}

/**
 * Run all pending migrations
 * Returns the number of migrations applied
 */
export function runMigrations(db: Database.Database): number {
  ensureMigrationsTable(db)

  const applied = getAppliedVersions(db)
  const pending = migrations.filter(m => !applied.has(m.version))

  if (pending.length === 0) {
    return 0
  }

  // Sort by version to ensure order
  pending.sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    console.log(`Running migration ${migration.version}: ${migration.name}`)

    // Run in transaction for safety
    const runMigration = db.transaction(() => {
      migration.up(db)
      markApplied(db, migration)
    })

    runMigration()
    console.log(`Migration ${migration.version} complete`)
  }

  return pending.length
}

/**
 * Get migration status
 */
export function getMigrationStatus(db: Database.Database): {
  applied: number[]
  pending: number[]
  total: number
} {
  ensureMigrationsTable(db)
  const applied = getAppliedVersions(db)

  return {
    applied: Array.from(applied).sort((a, b) => a - b),
    pending: migrations.filter(m => !applied.has(m.version)).map(m => m.version),
    total: migrations.length,
  }
}
