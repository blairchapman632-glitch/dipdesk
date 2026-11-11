import type { Metadata, Viewport } from 'next'
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



// The page fills the whole screen (viewport-fit=cover); the phone top bar and bottom nav
// pad themselves with the iPhone safe areas. White everywhere, so iOS never shows a
// grey/blurred strip behind the status bar.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* A fresh app launch always lands on Home, before anything is drawn. Old home-screen
            installs saved /dashboard as their start_url (iOS never updates it). Only the first
            page of a new session (no 'wrapapp_launched' flag) and only a bare /dashboard; a
            query (?add=1, ?report=true, ?google=…) means an in-app link, so it's left alone.
            In-app taps are client-side navigations, so this never runs for them. */}
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              if (!sessionStorage.getItem('wrapapp_launched')) {
                sessionStorage.setItem('wrapapp_launched', '1');
                if (location.pathname === '/dashboard' && !location.search) {
                  location.replace('/explore');
                }
              }
            } catch (e) {}
          `
        }} />
      </head>
      <body className="bg-white">
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