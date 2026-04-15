// Supabase Migration Script
// Verwendung: node scripts/migrate.mjs "ALTER TABLE ..."
// Oder: node scripts/migrate.mjs (führt Standard-Migrationen aus)
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.split('=')[0].trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const token = env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('❌ SUPABASE_ACCESS_TOKEN fehlt in .env.local')
  process.exit(1)
}

const sql = process.argv[2]
if (!sql) {
  console.error('❌ Kein SQL angegeben. Verwendung: node scripts/migrate.mjs "ALTER TABLE ..."')
  process.exit(1)
}

try {
  const result = execSync(
    `npx supabase db query --linked "${sql.replace(/"/g, '\\"')}"`,
    { env: { ...process.env, SUPABASE_ACCESS_TOKEN: token }, cwd: resolve(__dirname, '..') }
  ).toString()
  console.log('✅ Migration erfolgreich')
  console.log(result)
} catch (err) {
  console.error('❌ Migration fehlgeschlagen:', err.message)
  process.exit(1)
}
