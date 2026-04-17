// eslint-disable-next-line @typescript-eslint/no-require-imports
const PicnicClient = require('picnic-api')

export interface PicnicArtikel {
  artikelId: string
  name: string
  preis: number // in Cent
}

interface SellingUnit {
  id: string
  name: string
  display_price: number
}

interface OrderArticle {
  id: string
  name: string
  unit_quantity: string
}

interface OrderLine {
  type: 'ORDER_LINE'
  id: string
  items: OrderArticle[]
}

interface DeliveryOrder {
  type: 'ORDER'
  id: string
  creation_time: string
  status: string
}

interface DeliverySlim {
  delivery_id: string
  creation_time: string
  status: string
  orders: DeliveryOrder[]
}

interface DeliveryDetail {
  delivery_id: string
  creation_time: string
  status: string
  orders: Array<{ items: OrderLine[] }>
}

// Bewusst eingeschränktes Interface: Nur Warenkorb-Befüllung erlaubt.
// checkout() / submitOrder() sind absichtlich NICHT exponiert —
// Bestellungen müssen manuell in der Picnic-App ausgelöst werden.
interface PicnicInstance {
  auth: {
    login(username: string, password: string): Promise<unknown>
  }
  catalog: {
    search(query: string): Promise<SellingUnit[]>
  }
  cart: {
    addProductToCart(productId: string, count?: number): Promise<unknown>
    clearCart(): Promise<unknown>
    // checkout intentionally omitted
  }
  delivery: {
    getDeliveries(filter?: string[]): Promise<DeliverySlim[]>
    getDelivery(deliveryId: string): Promise<DeliveryDetail>
  }
}

const SESSION_TTL_MS = 60 * 60 * 1000 // 1 Stunde

let client: PicnicInstance | null = null
let clientCreatedAt: number | null = null

async function getClient(): Promise<PicnicInstance> {
  const now = Date.now()

  const authKey = process.env.PICNIC_AUTH_KEY
  const email = process.env.PICNIC_EMAIL
  const password = process.env.PICNIC_PASSWORD

  if (authKey) {
    // Auth-Key ist statisch — kein TTL notwendig, aber trotzdem cachen
    if (client && clientCreatedAt) return client
    const instance: PicnicInstance = new PicnicClient({ countryCode: 'DE', authKey })
    client = instance
    clientCreatedAt = now
    return client
  }

  // Session-basierter Login — nach TTL neu authentifizieren
  if (client && clientCreatedAt && now - clientCreatedAt < SESSION_TTL_MS) return client

  if (!email || !password) {
    throw new Error('PICNIC_AUTH_KEY oder PICNIC_EMAIL + PICNIC_PASSWORD müssen in .env.local gesetzt sein. Für 2FA-Konten: node scripts/picnic-auth.mjs ausführen.')
  }

  const instance: PicnicInstance = new PicnicClient({ countryCode: 'DE' })
  await instance.auth.login(email, password)
  client = instance
  clientCreatedAt = now
  return client
}

export async function sucheArtikel(name: string): Promise<PicnicArtikel | null> {
  const picnic = await getClient()
  const results = await picnic.catalog.search(name)
  if (!results || results.length === 0) return null

  const first = results[0]
  return {
    artikelId: first.id,
    name: first.name,
    preis: first.display_price,
  }
}

export async function zumWarenkorb(artikelId: string, count = 1): Promise<void> {
  const picnic = await getClient()
  await picnic.cart.addProductToCart(artikelId, count)
}

export async function warenkorbLeeren(): Promise<void> {
  const picnic = await getClient()
  await picnic.cart.clearCart()
}

export async function resetClient(): Promise<void> {
  client = null
}

export interface AktuelleBestellung {
  bestellung_id: string
  erstellt_am: string
  artikel_namen: string[]
}

export async function ladeAktuelleBestellung(): Promise<AktuelleBestellung | null> {
  const picnic = await getClient()
  const lieferungen = await picnic.delivery.getDeliveries(['CURRENT'])
  if (!lieferungen || lieferungen.length === 0) return null

  const aktuell = lieferungen[0]
  const details = await picnic.delivery.getDelivery(aktuell.delivery_id)

  const artikel_namen: string[] = []
  for (const order of details.orders ?? []) {
    for (const line of order.items ?? []) {
      for (const article of line.items ?? []) {
        if (article.name) artikel_namen.push(article.name)
      }
    }
  }

  return {
    bestellung_id: aktuell.delivery_id,
    erstellt_am: aktuell.creation_time,
    artikel_namen,
  }
}
