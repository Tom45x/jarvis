// eslint-disable-next-line @typescript-eslint/no-require-imports
const BringLib = require('bring-shopping')

interface BringListEntry {
  listUuid: string
  name: string
}

interface BringItem {
  name: string
  specification: string
}

interface BringInstance {
  login(): Promise<void>
  loadLists(): Promise<{ lists: BringListEntry[] }>
  getItems(listUuid: string): Promise<{ purchase: BringItem[]; recently: BringItem[] }>
  saveItem(listUuid: string, itemName: string, specification: string): Promise<void>
  removeItem(listUuid: string, itemName: string): Promise<void>
}

let client: BringInstance | null = null

async function getClient(): Promise<BringInstance> {
  if (client) return client
  const email = process.env.BRING_EMAIL
  const password = process.env.BRING_PASSWORD
  if (!email || !password) {
    throw new Error('BRING_EMAIL und BRING_PASSWORD müssen in .env.local gesetzt sein.')
  }
  const bring: BringInstance = new BringLib({ mail: email, password })
  await bring.login()
  client = bring
  return client
}

async function findeListeUuid(bring: BringInstance, listenName: string): Promise<string> {
  const { lists } = await bring.loadLists()
  const liste = lists.find(l => l.name === listenName)
  if (!liste) {
    throw new Error(
      `Bring-Liste "${listenName}" nicht gefunden. Bitte erstelle sie manuell in der Bring-App.`
    )
  }
  return liste.listUuid
}

export async function aktualisiereEinkaufsliste(
  listenName: string,
  items: { name: string; menge: number; einheit: string }[]
): Promise<void> {
  const bring = await getClient()
  const listUuid = await findeListeUuid(bring, listenName)

  // Bestehende Items entfernen (purchase + recently)
  const { purchase, recently } = await bring.getItems(listUuid)
  for (const item of [...purchase, ...recently]) {
    await bring.removeItem(listUuid, item.name)
  }

  // Neue Items hinzufügen
  for (const item of items) {
    const spec = `${item.menge}${item.einheit}`
    await bring.saveItem(listUuid, item.name, spec)
  }
}
