import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WrapApp',
  description: 'For the Love of Wraps',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WrapApp',
  },
}



export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-200">
        <meta name="theme-color" content="#db2777" />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered:', reg.scope); })
                  .catch(function(err) { console.log('SW error:', err); });
              });
            }
          `
        }} />
        {children}
      </body>
    </html>
  )
}