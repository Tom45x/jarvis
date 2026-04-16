/**
 * Schritt 2 des Picnic 2FA-Setups — SMS-Code als Argument übergeben.
 * Aufruf: node scripts/picnic-auth-code.mjs <SMS-CODE>
 */
import PicnicClient from 'picnic-api'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const code = process.argv[2]

if (!code) {
  console.error('❌ Aufruf: node scripts/picnic-auth-code.mjs <SMS-CODE>')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const email = envContent.match(/PICNIC_EMAIL=(.+)/)?.[1]?.trim()
const password = envContent.match(/PICNIC_PASSWORD=(.+)/)?.[1]?.trim()

if (!email || !password) {
  console.error('❌ PICNIC_EMAIL und PICNIC_PASSWORD müssen in .env.local gesetzt sein.')
  process.exit(1)
}

const client = new PicnicClient({ countryCode: 'DE' })

const loginResult = await client.auth.login(email, password)
console.log('✓ Login OK')

if (!loginResult.second_factor_authentication_required) {
  const authKey = loginResult.authKey
  console.log('\n✅ Kein 2FA nötig. Auth-Key:')
  console.log(authKey)
  speichern(authKey)
  process.exit(0)
}

const result = await client.auth.verify2FACode(code)
const authKey = result.authKey

console.log('\n✅ 2FA bestätigt! Auth-Key:')
console.log(authKey)

speichern(authKey)

function speichern(key) {
  const newEnv = envContent.includes('PICNIC_AUTH_KEY=')
    ? envContent.replace(/PICNIC_AUTH_KEY=.*/, `PICNIC_AUTH_KEY=${key}`)
    : envContent + `\nPICNIC_AUTH_KEY=${key}\n`
  fs.writeFileSync(envPath, newEnv)
  console.log('\n✓ Automatisch in .env.local gespeichert.')
}
