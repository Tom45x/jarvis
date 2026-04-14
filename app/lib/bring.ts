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
  login(email: string, password: string): Promise<void>
  getLists(): Promise<{ lists: BringListEntry[] }>
  getItems(listUuid: string): Promise<{ purchase: BringItem[]; recently: BringItem[] }>
  saveItem(listUuid: string, itemName: string, specification: string): Promise<void>
  removeItem(listUuid: string, itemName: string): Promise<void>
}

let client: BringInstance | null = null

async function getClient(): Promise<BringInstance> {
  if (client) return client
  const bring: BringInstance = new BringLib()
  await bring.login(
    process.env.BRING_EMAIL!,
    process.env.BRING_PASSWORD!
  )
  client = bring
  return client
}

async function findeListeUuid(bring: BringInstance, listenName: string): Promise<string> {
  const { lists } = await bring.getLists()
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

  // Bestehende Items entfernen
  const { purchase } = await bring.getItems(listUuid)
  for (const item of purchase) {
    await bring.removeItem(listUuid, item.name)
  }

  // Neue Items hinzufügen
  for (const item of items) {
    const spec = `${item.menge}${item.einheit}`
    await bring.saveItem(listUuid, item.name, spec)
  }
}
