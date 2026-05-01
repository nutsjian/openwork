import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { projectRoutes } from '@/routes/projects'
import { sessionRoutes } from '@/routes/sessions'
import { projectMinuteRoutes, minuteRoutes } from '@/routes/minutes'
import { memberRoutes } from '@/routes/members'
import { epicRoutes } from '@/routes/epics'
import {
  initConnection,
  handleMessage,
  handleClose,
} from '@/routes/ws'

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
app.route('/api/v1/projects', projectMinuteRoutes)
app.route('/api/v1/sessions', sessionRoutes)
app.route('/api/v1/minutes', minuteRoutes)
app.route('/api/v1/projects', memberRoutes)
app.route('/api/v1', epicRoutes)

const port = Number(process.env.PORT) || 13179

console.log(`virevo-server starting on http://localhost:${port}`)

Bun.serve<{ sessionId: string; nickname: string; role: string }>({
  port,
  fetch(req, server) {
    const url = new URL(req.url)

    // Handle WebSocket upgrade at /api/v1/ws
    if (url.pathname === '/api/v1/ws') {
      const sessionId = url.searchParams.get('sessionId')
      const nickname = url.searchParams.get('nickname') || '匿名'
      const role = url.searchParams.get('role') || 'member'

      if (!sessionId) {
        return new Response('Missing sessionId', { status: 400 })
      }

      const upgraded = server.upgrade(req, {
        data: { sessionId, nickname, role },
      })

      if (upgraded) {
        return // handled by websocket callbacks
      }

      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    // Pass all other requests to Hono
    return app.fetch(req)
  },
  websocket: {
    open(ws) {
      initConnection(ws)
    },
    message(ws, message) {
      handleMessage(ws, message)
    },
    close(ws) {
      handleClose(ws)
    },
  },
})
