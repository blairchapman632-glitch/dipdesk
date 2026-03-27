import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DipDesk',
  description: 'Run your dips with confidence',
  
}



export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-200">
        {children}
      </body>
    </html>
  )
}