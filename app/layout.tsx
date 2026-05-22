import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lazy Lister — AI Marketplace Listing Aggregator',
  description: 'Drop photos. Get a perfect listing for any marketplace in seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: 'var(--bg)' }}>
        {children}
      </body>
    </html>
  )
}
