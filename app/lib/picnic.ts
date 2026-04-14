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
  }
}

let client: PicnicInstance | null = null

async function getClient(): Promise<PicnicInstance> {
  if (client) return client

  const email = process.env.PICNIC_EMAIL
  const password = process.env.PICNIC_PASSWORD

  if (!email || !password) {
    throw new Error('PICNIC_EMAIL und PICNIC_PASSWORD müssen in .env.local gesetzt sein.')
  }

  const instance: PicnicInstance = new PicnicClient()
  await instance.auth.login(email, password)
  client = instance
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
