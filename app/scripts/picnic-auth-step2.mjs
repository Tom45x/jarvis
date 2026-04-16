/**
 * Picnic 2FA — Schritt 2: SMS-Code verifizieren und finalen Auth-Key speichern.
 * Aufruf: node scripts/picnic-auth-step2.mjs <SMS-CODE>
 */
import PicnicClient from 'picnic-api'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const tmpPath = path.join(__dirname, '..', '.picnic-auth-tmp.json')

const code = process.argv[2]
if (!code) {
  console.error('❌ Aufruf: node scripts/picnic-auth-step2.mjs <SMS-CODE>')
  process.exit(1)
}

if (!fs.existsSync(tmpPath)) {
  console.error('❌ Keine temporäre Auth-Datei gefunden. Zuerst: node scripts/picnic-auth-step1.mjs')
  process.exit(1)
}

const { intermediaryAuthKey } = JSON.parse(fs.readFileSync(tmpPath, 'utf8'))

// Client mit intermediärem Key erstellen (selbe Session wie Schritt 1)
const client = new PicnicClient({ countryCode: 'DE', authKey: intermediaryAuthKey })
const result = await client.auth.verify2FACode(code)
const finalAuthKey = result.authKey

console.log('\n✅ 2FA bestätigt! Auth-Key:')
console.log(finalAuthKey)

const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const newEnv = envContent.includes('PICNIC_AUTH_KEY=')
  ? envContent.replace(/PICNIC_AUTH_KEY=.*/, `PICNIC_AUTH_KEY=${finalAuthKey}`)
  : envContent + `\nPICNIC_AUTH_KEY=${finalAuthKey}\n`
fs.writeFileSync(envPath, newEnv)
console.log('✓ In .env.local gespeichert.')

// Temp-Datei aufräumen
fs.unlinkSync(tmpPath)
console.log('✓ Temp-Datei gelöscht.')
console.log('\nFINAL_AUTH_KEY=' + finalAuthKey)
