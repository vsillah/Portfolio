// Read-only local QA proxy: serve the captured public service catalog to the
// exact branch under review while all other requests go to the local Next app.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const catalog = fs.readFileSync(path.join(__dirname, '../../docs/showcase-audit/services-catalog-2026-10-23.json'))
const rows = JSON.parse(catalog).rows
const targetPort = Number(process.env.SERVICE_QA_TARGET_PORT || 3211)
const listenPort = Number(process.env.SERVICE_QA_PORT || 3212)

http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${listenPort}`)
  if (request.method === 'GET' && url.pathname === '/api/services' && url.searchParams.get('active') === 'true') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    response.end(JSON.stringify(rows))
    return
  }
  const detail = request.method === 'GET' && url.pathname.match(/^\/api\/services\/([0-9a-f-]{36})$/)
  if (detail) {
    const row = rows.find((service) => service.id === detail[1])
    response.writeHead(row ? 200 : 404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    response.end(JSON.stringify(row || { error: 'Service not found in public snapshot' }))
    return
  }
  const upstream = http.request({ hostname: '127.0.0.1', port: targetPort, path: request.url, method: request.method, headers: { ...request.headers, host: `127.0.0.1:${targetPort}` } }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', () => { response.writeHead(502); response.end('Local QA server unavailable') })
  request.pipe(upstream)
}).listen(listenPort, '127.0.0.1', () => {
  process.stdout.write(`Service QA proxy listening on http://127.0.0.1:${listenPort}\n`)
})
