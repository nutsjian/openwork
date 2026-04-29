import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { connect as tlsConnect } from 'tls'
import { URL } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const originalFetch = globalThis.fetch.bind(globalThis)

if (process.env.HTTPS_PROXY) {
  const proxyUrl = new URL(process.env.HTTPS_PROXY)

  globalThis.fetch = async (input: any, init: any = {}): Promise<Response> => {
    let urlStr: string | undefined
    if (typeof input === 'string') urlStr = input
    else if (input instanceof URL) urlStr = input.toString()
    else if (input?.url) urlStr = input.url

    if (!urlStr || !urlStr.startsWith('https://')) {
      return originalFetch(input, init)
    }

    if (urlStr.includes('open.bigmodel.cn/api/paas/v4')) {
      urlStr = urlStr.replace('/api/paas/v4', '/api/coding/paas/v4')
    }

    const parsedUrl = new URL(urlStr)
    const method = init?.method || (init?.body ? 'POST' : 'GET')

    const proxySocket = await new Promise<any>((resolve, reject) => {
      const req = http.request({
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port, 10),
        method: 'CONNECT',
        path: `${parsedUrl.hostname}:443`,
      })
      req.on('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          socket.destroy()
          reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`))
          return
        }
        resolve(socket)
      })
      req.on('error', reject)
      req.end()
    })

    const tlsSocket = tlsConnect({
      socket: proxySocket,
      servername: parsedUrl.hostname,
    })

    const reqHeaders: Record<string, string> = {
      Host: parsedUrl.host,
      ...(init?.headers as Record<string, string>),
    }

    let bodyBuf: Buffer | undefined
    if (init?.body != null) {
      if (typeof init.body === 'string') bodyBuf = Buffer.from(init.body)
      else if (init.body instanceof ArrayBuffer)
        bodyBuf = Buffer.from(init.body)
      else if (init.body instanceof Uint8Array) bodyBuf = Buffer.from(init.body)
      else bodyBuf = Buffer.from(JSON.stringify(init.body))
    }

    if (bodyBuf && !reqHeaders['content-length']) {
      reqHeaders['content-length'] = String(bodyBuf.length)
    }

    console.log(`[proxy] ${method} ${urlStr}`)

    const headerLines = Object.entries(reqHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n')

    tlsSocket.write(
      `${method} ${parsedUrl.pathname}${parsedUrl.search} HTTP/1.1\r\n${headerLines}\r\n\r\n`,
    )
    if (bodyBuf) {
      console.log(`[proxy] Sending body: ${bodyBuf.length} bytes`)
      tlsSocket.write(bodyBuf)
    }

    return new Promise<Response>((resolve, reject) => {
      let rawBuf = Buffer.alloc(0)
      let resolved = false

      const onData = (chunk: Buffer) => {
        rawBuf = Buffer.concat([rawBuf, chunk])
        if (resolved) return
        const sep = rawBuf.indexOf('\r\n\r\n')
        if (sep === -1) return

        resolved = true
        tlsSocket.removeListener('data', onData)

        const headPart = rawBuf.subarray(0, sep).toString()
        const tailPart = rawBuf.subarray(sep + 4)
        console.log(`[proxy] Response: ${headPart.split('\\r\\n')[0]}`)

        const [statusLine, ...hdrLines] = headPart.split('\r\n')
        const m = statusLine.match(/^HTTP\/[\d.]+ (\d+) (.*)/)
        const status = m ? parseInt(m[1]) : 200
        const statusText = m ? m[2] : ''

        const respHeaders: Record<string, string> = {}
        for (const line of hdrLines) {
          const i = line.indexOf(':')
          if (i > 0) respHeaders[line.substring(0, i).trim().toLowerCase()] = line.substring(i + 1).trim()
        }

        const cl = parseInt(respHeaders['content-length'], 10)
        const isSSE = (respHeaders['content-type'] || '').includes('text/event-stream')

        if (isSSE) {
          const stream = new ReadableStream<Uint8Array>({
            start(ctrl) {
              if (tailPart.length > 0) ctrl.enqueue(new Uint8Array(tailPart))
              tlsSocket.on('data', (c: Buffer) => ctrl.enqueue(new Uint8Array(c)))
              tlsSocket.on('end', () => ctrl.close())
              tlsSocket.on('error', (e: Error) => ctrl.error(e))
            },
            cancel() {
              tlsSocket.destroy()
            },
          })
          resolve(new Response(stream, { status, statusText, headers: respHeaders }))
        } else {
          const rest = new Promise<Buffer>((resBody) => {
            if (cl && tailPart.length >= cl) {
              resBody(tailPart.subarray(0, cl))
              tlsSocket.destroy()
              return
            }
            tlsSocket.on('data', (c: Buffer) => {
              rawBuf = Buffer.concat([rawBuf, c])
              if (cl && rawBuf.length - sep - 4 >= cl) {
                resBody(rawBuf.subarray(sep + 4, sep + 4 + cl))
                tlsSocket.destroy()
              }
            })
            tlsSocket.on('end', () => {
              resBody(rawBuf.subarray(sep + 4))
            })
          })
          rest.then((body) => {
            resolve(new Response(body, { status, statusText, headers: respHeaders }))
          })
        }
      }

      tlsSocket.on('data', onData)
      tlsSocket.on('error', (e: Error) => {
        console.error('[proxy] TLS error:', e.message)
        if (!resolved) reject(e)
      })
      tlsSocket.on('close', () => {
        if (!resolved) reject(new Error('TLS closed before response'))
      })
    })
  }

  console.log(`Using proxy: ${process.env.HTTPS_PROXY}`)
}

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { projectRoutes } from '@/routes/projects'
import { sessionRoutes } from '@/routes/sessions'
import { minuteRoutes } from '@/routes/minutes'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: ['http://localhost:*'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }),
)

app.get('/api/v1/health', (c) => c.json({ status: 'ok' }))

app.route('/api/v1/projects', projectRoutes)
app.route('/api/v1/sessions', sessionRoutes)
app.route('/api/v1/minutes', minuteRoutes)

const port = Number(process.env.PORT) || 13179

console.log(`virevo-server starting on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
