import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { AppProviders } from '../components/providers'

import appCss from '../styles.css?url'
import payCss from '../pay.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        name: 'theme-color',
        content: '#1f1f1f',
      },
      {
        title: 'BOBC Pay · Your money, moving',
      },
      {
        name: 'description',
        content: 'Pay, receive, and redeem BOBC on Arbitrum One.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: payCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/bobc.svg' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
        <Scripts />
      </body>
    </html>
  )
}
