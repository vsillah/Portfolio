/**
 * Client-side SSE stream reader.
 * Wraps fetch + ReadableStream to yield parsed JSON events from text/event-stream responses.
 */

export interface SSEReaderOptions {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
  onEvent: (event: Record<string, unknown>) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

export async function readSSEStream(opts: SSEReaderOptions): Promise<void> {
  const { url, method = 'POST', headers = {}, body, signal, onEvent, onError, onDone } = opts

  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `HTTP ${res.status}`
    try {
      const json = JSON.parse(text)
      if (json.error) msg = typeof json.error === 'string' ? json.error : JSON.stringify(json.error)
    } catch {
      if (text) msg = text.slice(0, 200)
    }
    throw new Error(msg)
  }

  const contentType = res.headers.get('content-type') ?? ''

  if (!contentType.includes('text/event-stream')) {
    const json = await res.json()
    onEvent({ ...json, step: 'done' })
    onDone?.()
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6)
          try {
            const parsed = JSON.parse(jsonStr)
            onEvent(parsed)
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6))
        onEvent(parsed)
      } catch {
        // skip
      }
    }
  } catch (err) {
    if (signal?.aborted) return
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return
  }

  onDone?.()
}
