import { createServer } from 'node:http'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const listenPort = Number(process.env.QA_PROXY_PORT || 3107)
const upstreamUrl = process.env.QA_UPSTREAM_URL || 'http://127.0.0.1:3109'
const productionUrl = process.env.PROD_SUPABASE_URL
const productionKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
const allowedIds = new Set([
  '1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f',
  'e06ab168-56aa-45f5-9672-619215df3ce7',
  '2d96e662-5e7e-4761-8a87-85128e20a559',
])

if (!productionUrl || !productionKey) {
  throw new Error('PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_ROLE_KEY are required.')
}

const production = createClient(productionUrl, productionKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function requestBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : undefined
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://127.0.0.1:${listenPort}`)
    const detailMatch = url.pathname.match(/^\/api\/admin\/social-content\/([0-9a-f-]+)$/)
    const recordId = detailMatch?.[1] || ''

    if (allowedIds.has(recordId)) {
      if (request.method !== 'GET') {
        return json(response, 409, {
          error: 'Production-equivalent QA proxy is read-only.',
          blocked: true,
          persisted: false,
        })
      }

      const { data, error } = await production
        .from('social_content_queue')
        .select('*')
        .eq('id', recordId)
        .single()

      if (error || !data) return json(response, 404, { error: 'Authorized production review row not found.' })
      return json(response, 200, {
        item: data,
        fixture: false,
        fixture_state: 'persisted_review_only_youtube_experiment',
        integration_note: 'Production-equivalent localhost projection from the exact persisted row. Read-only proxy; no mutation or provider action is available.',
      })
    }

    const body = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await requestBody(request)
    const upstream = await fetch(new URL(url.pathname + url.search, upstreamUrl), {
      method: request.method,
      headers: { ...request.headers, host: new URL(upstreamUrl).host },
      body,
      redirect: 'manual',
    })
    const headers = Object.fromEntries(upstream.headers)
    delete headers['content-encoding']
    delete headers['content-length']
    delete headers['transfer-encoding']
    if (headers.location) headers.location = headers.location.replace(upstreamUrl, `http://127.0.0.1:${listenPort}`)
    response.writeHead(upstream.status, headers)
    response.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    json(response, 502, { error: error instanceof Error ? error.message : 'QA proxy failed.' })
  }
})

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`Read-only production-row QA proxy listening on http://127.0.0.1:${listenPort} -> ${upstreamUrl}`)
})

