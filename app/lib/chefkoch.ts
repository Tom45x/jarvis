const URL_PATTERN = /^https?:\/\/(?:www\.)?chefkoch\.de\/rezepte\/(\d+)\/([^?#]*)/

export interface ChefkochRezept {
  name: string
  zutatenRoh: string[]
  zubereitung: string[]
  totalMinutes: number | null
}

export function normalisiereChefkochUrl(url: string): string {
  const match = url.match(URL_PATTERN)
  if (!match) throw new Error(`Keine gültige Chefkoch-Rezept-URL: ${url}`)
  const [, id, rest] = match
  return `https://www.chefkoch.de/rezepte/${id}/${rest}`
}

function isoDurationZuMinuten(iso: unknown): number | null {
  if (typeof iso !== 'string') return null
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (!match) return null
  const [, h, m] = match
  if (!h && !m) return null
  return (h ? parseInt(h, 10) * 60 : 0) + (m ? parseInt(m, 10) : 0)
}

function ermittleTotalMinutes(recipe: Record<string, unknown>): number | null {
  const total = isoDurationZuMinuten(recipe.totalTime)
  if (total !== null) return total
  const prep = isoDurationZuMinuten(recipe.prepTime)
  const cook = isoDurationZuMinuten(recipe.cookTime)
  if (prep !== null && cook !== null) return prep + cook
  return prep ?? cook
}

function flachZubereitung(instructions: unknown): string[] {
  if (!Array.isArray(instructions)) return []
  const result: string[] = []
  for (const item of instructions) {
    if (typeof item === 'string') {
      result.push(item)
      continue
    }
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    if (Array.isArray(obj.itemListElement)) {
      result.push(...flachZubereitung(obj.itemListElement))
      continue
    }
    if (typeof obj.text === 'string') {
      result.push(obj.text)
    }
  }
  return result
}

function findeRecipeNode(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
  for (const scriptMatch of scripts) {
    let parsed: unknown
    try {
      parsed = JSON.parse(scriptMatch[1])
    } catch {
      continue
    }
    const kandidaten = Array.isArray((parsed as { '@graph'?: unknown[] })?.['@graph'])
      ? (parsed as { '@graph': unknown[] })['@graph']
      : [parsed]
    for (const node of kandidaten) {
      if (!node || typeof node !== 'object') continue
      const obj = node as Record<string, unknown>
      if (obj['@type'] === 'Recipe') return obj
    }
  }
  return null
}

export async function holeChefkochRezept(url: string): Promise<ChefkochRezept | null> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  } catch {
    return null
  }
  if (!response.ok) return null

  const html = await response.text()
  const recipe = findeRecipeNode(html)
  if (!recipe) return null

  const zutatenRoh = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient.filter((z): z is string => typeof z === 'string')
    : []
  const zubereitung = flachZubereitung(recipe.recipeInstructions)

  if (zutatenRoh.length === 0 && zubereitung.length === 0) return null

  return {
    name: typeof recipe.name === 'string' ? recipe.name : 'Chefkoch-Rezept',
    zutatenRoh,
    zubereitung,
    totalMinutes: ermittleTotalMinutes(recipe),
  }
}
