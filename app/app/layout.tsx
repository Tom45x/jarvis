import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BottomNav } from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'Jarvis',
  description: 'Familien-Wochenplaner',
  manifest: undefined,
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full flex flex-col bg-white pb-16">
        <div className="flex-1">{children}</div>
        <BottomNav />
      </body>
    </html>
  )
}
