/**
 * Picnic 2FA — Schritt 1: Login + SMS senden, intermediären Auth-Key speichern.
 * Danach: node scripts/picnic-auth-step2.mjs <SMS-CODE>
 */
import PicnicClient from 'picnic-api'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const tmpPath = path.join(__dirname, '..', '.picnic-auth-tmp.json')

const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const email = envContent.match(/PICNIC_EMAIL=(.+)/)?.[1]?.trim()
const password = envContent.match(/PICNIC_PASSWORD=(.+)/)?.[1]?.trim()

if (!email || !password) {
  console.error('❌ PICNIC_EMAIL und PICNIC_PASSWORD müssen in .env.local gesetzt sein.')
  process.exit(1)
}

const client = new PicnicClient({ countryCode: 'DE' })
const loginResult = await client.auth.login(email, password)
const intermediaryAuthKey = loginResult.authKey
console.log('✓ Login OK')

if (!loginResult.second_factor_authentication_required) {
  console.log('\n✅ Kein 2FA nötig. Auth-Key:')
  console.log(intermediaryAuthKey)
  speichern(intermediaryAuthKey)
  process.exit(0)
}

await client.auth.generate2FACode('SMS')
console.log('✓ SMS gesendet.')

// Intermediären Key für Schritt 2 speichern
fs.writeFileSync(tmpPath, JSON.stringify({ intermediaryAuthKey }))
console.log('\n→ Jetzt SMS-Code eingeben:')
console.log('  node scripts/picnic-auth-step2.mjs <CODE>')

function speichern(key) {
  const newEnv = envContent.includes('PICNIC_AUTH_KEY=')
    ? envContent.replace(/PICNIC_AUTH_KEY=.*/, `PICNIC_AUTH_KEY=${key}`)
    : envContent + `\nPICNIC_AUTH_KEY=${key}\n`
  fs.writeFileSync(envPath, newEnv)
  console.log('✓ In .env.local gespeichert.')
}
