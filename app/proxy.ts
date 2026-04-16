import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const apiKey = process.env.INTERNAL_API_KEY
  // Wenn kein Key konfiguriert ist, alle Requests durchlassen (Entwicklungsumgebung)
  if (!apiKey) return NextResponse.next()

  const incomingKey = request.headers.get('x-api-key')
  if (incomingKey !== apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
