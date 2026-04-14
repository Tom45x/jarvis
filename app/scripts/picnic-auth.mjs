/**
 * Einmaliger Picnic 2FA-Setup.
 * Führt den Login + SMS-Bestätigung durch und gibt den Auth-Key aus,
 * der dann als PICNIC_AUTH_KEY in .env.local gespeichert werden muss.
 *
 * Ausführen mit: node scripts/picnic-auth.mjs
 */
import PicnicClient from 'picnic-api'
import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function frage(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans.trim()) }))
}

// .env.local lesen
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const email = envContent.match(/PICNIC_EMAIL=(.+)/)?.[1]?.trim()
const password = envContent.match(/PICNIC_PASSWORD=(.+)/)?.[1]?.trim()

if (!email || !password) {
  console.error('❌ PICNIC_EMAIL und PICNIC_PASSWORD müssen in .env.local gesetzt sein.')
  process.exit(1)
}

const client = new PicnicClient({ countryCode: 'DE' })

console.log(`\nPicnic 2FA-Einrichtung für: ${email}\n`)

const loginResult = await client.auth.login(email, password)
console.log('✓ Login OK')

if (!loginResult.second_factor_authentication_required) {
  console.log('\n✅ Kein 2FA nötig. Auth-Key:')
  console.log(loginResult.authKey)
  console.log('\nTrage das in .env.local ein:')
  console.log(`PICNIC_AUTH_KEY=${loginResult.authKey}`)
  process.exit(0)
}

console.log('→ 2FA erforderlich. SMS wird gesendet...')
await client.auth.generate2FACode('SMS')
console.log('✓ SMS gesendet.\n')

const code = await frage('SMS-Code eingeben: ')
const result = await client.auth.verify2FACode(code)

console.log('\n✅ 2FA bestätigt! Auth-Key:')
console.log(result.authKey)
console.log('\nTrage das in .env.local ein:')
console.log(`PICNIC_AUTH_KEY=${result.authKey}`)

// Automatisch in .env.local schreiben falls noch nicht vorhanden
const newEnv = envContent.includes('PICNIC_AUTH_KEY=')
  ? envContent.replace(/PICNIC_AUTH_KEY=.*/,  `PICNIC_AUTH_KEY=${result.authKey}`)
  : envContent + `\nPICNIC_AUTH_KEY=${result.authKey}\n`

fs.writeFileSync(envPath, newEnv)
console.log('\n✓ Automatisch in .env.local gespeichert.')
