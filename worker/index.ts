import { handlePricesRequest } from './prices'

export interface Env {
  ASSETS: Fetcher
  DB: D1Database
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok' })
    }

    if (url.pathname.startsWith('/api/prices/')) {
      return handlePricesRequest(url.pathname, url.searchParams)
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
