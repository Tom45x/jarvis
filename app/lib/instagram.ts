const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const URL_PATTERN = /^https:\/\/(?:www\.)?instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)\/?/

export function normalisiereInstaUrl(url: string): string {
  const match = url.match(URL_PATTERN)
  if (!match) throw new Error(`Keine gültige Instagram-Reel/Post-URL: ${url}`)
  const [, typ, id] = match
  return `https://www.instagram.com/${typ}/${id}/`
}

export function dekodiereHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

export async function holeReelCaption(url: string): Promise<{ caption: string } | null> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': IPHONE_UA },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const html = await response.text()
  const match = html.match(/<meta property="og:description" content="([^"]*)"/)
  if (!match) return null

  const caption = dekodiereHtmlEntities(match[1])
  return { caption }
}
