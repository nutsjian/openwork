import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/db'
import {
  sessions,
  messages,
  sessionParticipants,
  handRaises,
  projectMembers,
  meetingMinutes,
} from '@/db/schema'
import { facilitatorAgent } from '@/agents/facilitator'
import { sql } from 'drizzle-orm'

// In-memory session hubs: sessionId → Set<ServerWebSocket>
const sessionClients = new Map<string, Set<Bun.ServerWebSocket<any>>>()

// Per-connection state: ws → participant info
const connectionState = new Map<
  Bun.ServerWebSocket<any>,
  {
    sessionId: string
    nickname: string
    role: string
    participantId: string
  }
>()

// ── Broadcast helper ──────────────────────────────────────────────

function broadcast(sessionId: string, data: object) {
  const json = JSON.stringify(data)
  const clients = sessionClients.get(sessionId)
  if (!clients) return

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json)
    }
  }
}

// ── Initialize a new connection ───────────────────────────────────

export async function initConnection(
  ws: Bun.ServerWebSocket<{ sessionId: string; nickname: string; role: string }>,
) {
  const { sessionId, nickname, role } = ws.data

  // Register client
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set())
  }
  sessionClients.get(sessionId)!.add(ws)

  // Upsert session participant (use nickname as key for dedup)
  const existing = await db
    .select()
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.nickname, nickname),
      ),
    )

  let participant
  if (existing.length > 0) {
    // Re-activate if previously left
    ;[participant] = await db
      .update(sessionParticipants)
      .set({ status: 'active', role: role as 'host' | 'member' })
      .where(eq(sessionParticipants.id, existing[0].id))
      .returning()
  } else {
    ;[participant] = await db
      .insert(sessionParticipants)
      .values({
        sessionId,
        nickname,
        role: role as 'host' | 'member',
        color: getColor(nickname),
      })
      .returning()
  }

  // Store connection state
  connectionState.set(ws, {
    sessionId,
    nickname,
    role,
    participantId: participant.id,
  })

  // Load existing messages
  const existingMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.timestamp))

  // Load active participants
  const participants = await db
    .select()
    .from(sessionParticipants)
    .where(
      and(
        eq(sessionParticipants.sessionId, sessionId),
        eq(sessionParticipants.status, 'active'),
      ),
    )

  // Load pending hand raises
  const pendingHands = await db
    .select()
    .from(handRaises)
    .where(
      and(
        eq(handRaises.sessionId, sessionId),
        eq(handRaises.status, 'pending'),
      ),
    )

  // Send joined state
  ws.send(
    JSON.stringify({
      type: 'joined',
      participant: {
        id: participant.id,
        nickname,
        role,
        color: participant.color,
      },
      participants: participants.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        color: p.color,
      })),
      messages: existingMessages.map((m) => ({
        id: m.id,
        participantId: m.participantId,
        nickname: m.nickname,
        content: m.content,
        type: m.type,
        messageType: m.messageType,
        timestamp: m.timestamp,
      })),
      handRaises: pendingHands.map((h) => ({
        id: h.id,
        participantId: h.participantId,
        status: h.status,
      })),
    }),
  )

  // Broadcast system message: member joined (skip if only participant)
  if (participants.length > 1) {
    // Save system message
    const [sysMsg] = await db
      .insert(messages)
      .values({
        sessionId,
        participantId: participant.id,
        nickname: '系统',
        content: `${nickname} 加入了讨论`,
        type: 'user',
        messageType: 'system',
      })
      .returning()

    // Update session last message
    await db
      .update(sessions)
      .set({
        lastMessageAt: sysMsg.timestamp,
        lastMessagePreview: `${nickname} 加入了讨论`,
      })
      .where(eq(sessions.id, sessionId))

    broadcast(sessionId, {
      type: 'message',
      message: {
        id: sysMsg.id,
        participantId: sysMsg.participantId,
        nickname: sysMsg.nickname,
        content: sysMsg.content,
        type: sysMsg.type,
        messageType: 'system',
        timestamp: sysMsg.timestamp,
      },
    })
  }
}

// ── Handle incoming WebSocket message ──────────────────────────────

export async function handleMessage(
  ws: Bun.ServerWebSocket<{ sessionId: string; nickname: string; role: string }>,
  message: string | Buffer<ArrayBuffer>,
) {
  const state = connectionState.get(ws)
  if (!state) return

  const { sessionId, nickname, role, participantId } = state

  let data: any
  try {
    data = JSON.parse(message.toString())
  } catch {
    return
  }

  try {
    switch (data.type) {
      case 'message': {
        // Save and broadcast message
        const [msg] = await db
          .insert(messages)
          .values({
            sessionId,
            participantId,
            nickname,
            content: data.content,
            type: 'user',
            messageType: 'text',
          })
          .returning()

        // Update session last message
        await db
          .update(sessions)
          .set({
            lastMessageAt: msg.timestamp,
            lastMessagePreview: data.content.slice(0, 100),
          })
          .where(eq(sessions.id, sessionId))

        broadcast(sessionId, {
          type: 'message',
          message: {
            id: msg.id,
            participantId,
            nickname,
            content: data.content,
            type: 'user',
            messageType: 'text',
            timestamp: msg.timestamp,
          },
        })
        break
      }

      case 'raise-hand': {
        // Insert hand raise
        const [hand] = await db
          .insert(handRaises)
          .values({
            sessionId,
            participantId,
            status: 'pending',
          })
          .returning()

        broadcast(sessionId, {
          type: 'hand-raised',
          hand: {
            id: hand.id,
            participantId,
            nickname,
          },
        })
        break
      }

      case 'cancel-hand': {
        // Update existing pending hand raise
        await db
          .update(handRaises)
          .set({ status: 'dismissed' })
          .where(
            and(
              eq(handRaises.sessionId, sessionId),
              eq(handRaises.participantId, participantId),
              eq(handRaises.status, 'pending'),
            ),
          )

        broadcast(sessionId, {
          type: 'hand-cancelled',
          participantId,
        })
        break
      }

      case 'request-summary': {
        // Host-only: trigger AI summary
        if (role !== 'host') {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Only host can request summary',
            }),
          )
          return
        }

        broadcast(sessionId, { type: 'summary-started' })

        // Load conversation history
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.sessionId, sessionId))
          .orderBy(asc(messages.timestamp))

        const chatMessages = history.map((m) => ({
          role: m.type === 'ai' ? ('assistant' as const) : ('user' as const),
          content: m.content,
        }))

        // Stream AI summary
        const stream = await facilitatorAgent.stream([
          {
            role: 'user' as const,
            content:
              '你是一位专业的会议记录员。请根据以下讨论记录，用中文总结本轮讨论的要点和结论。使用 Markdown 格式。保持简洁，突出关键决策和待确认事项。',
          },
          ...chatMessages,
        ])

        let fullText = ''
        for await (const chunk of stream.textStream) {
          fullText += chunk
          broadcast(sessionId, { type: 'ai-chunk', text: chunk })
        }

        if (fullText) {
          // Save AI message
          const [aiMsg] = await db
            .insert(messages)
            .values({
              sessionId,
              participantId: 'ai',
              nickname: 'AI 助手',
              content: fullText,
              type: 'ai',
              messageType: 'ai',
            })
            .returning()

          // Update session last message
          await db
            .update(sessions)
            .set({
              lastMessageAt: aiMsg.timestamp,
              lastMessagePreview: fullText.slice(0, 100),
            })
            .where(eq(sessions.id, sessionId))
        }

        // Update round number
        await db
          .update(sessions)
          .set({ roundNumber: sql`round_number + 1` })
          .where(eq(sessions.id, sessionId))

        broadcast(sessionId, { type: 'ai-done', fullText })
        break
      }

      case 'allow-hand': {
        // Host-only: allow a hand-raised participant
        if (role !== 'host') {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Only host can allow hands',
            }),
          )
          return
        }

        await db
          .update(handRaises)
          .set({ status: 'allowed' })
          .where(
            and(
              eq(handRaises.id, data.handId),
              eq(handRaises.sessionId, sessionId),
            ),
          )

        broadcast(sessionId, {
          type: 'hand-allowed',
          handId: data.handId,
          participantId: data.participantId,
        })
        break
      }

      case 'end-session': {
        // Host-only: end the session
        if (role !== 'host') {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Only host can end session',
            }),
          )
          return
        }

        // Save system message: session ended
        const [endMsg] = await db
          .insert(messages)
          .values({
            sessionId,
            participantId,
            nickname: '系统',
            content: '讨论会已结束',
            type: 'user',
            messageType: 'system',
          })
          .returning()

        broadcast(sessionId, {
          type: 'message',
          message: {
            id: endMsg.id,
            participantId: endMsg.participantId,
            nickname: endMsg.nickname,
            content: endMsg.content,
            type: endMsg.type,
            messageType: 'system',
            timestamp: endMsg.timestamp,
          },
        })

        // Mark as completing
        await db
          .update(sessions)
          .set({ status: 'completing' })
          .where(eq(sessions.id, sessionId))

        broadcast(sessionId, { type: 'session-ended' })

        // Fire-and-forget: generate meeting minutes
        ;(async () => {
          try {
            const allMessages = await db
              .select()
              .from(messages)
              .where(eq(messages.sessionId, sessionId))
              .orderBy(asc(messages.timestamp))

            const [session] = await db
              .select()
              .from(sessions)
              .where(eq(sessions.id, sessionId))

            const historyText = allMessages
              .map((m) => `[${m.nickname}]: ${m.content}`)
              .join('\n')

            const minutesText = await facilitatorAgent.generate(
              `请根据以下讨论记录生成一份会议纪要（Markdown 格式）。要求包含：
- 会议日期
- 参与者
- 讨论摘要
- 提出的需求（Epic/Feature/User Story）
- 待解决问题
- 行动项

对话记录：
${historyText}`,
            )

            await db.insert(meetingMinutes).values({
              sessionId,
              projectId: session.projectId,
              sessionDate: session.createdAt,
              summary: minutesText,
            })
          } catch (err) {
            console.error(
              '[ws] Background minutes generation failed:',
              err,
            )
          } finally {
            await db
              .update(sessions)
              .set({ status: 'completed', endedAt: new Date() })
              .where(eq(sessions.id, sessionId))
          }
        })()
        break
      }
    }
  } catch (err: any) {
    console.error('[ws] Error handling message:', err)
    ws.send(JSON.stringify({ type: 'error', message: err.message }))
  }
}

// ── Handle disconnect ─────────────────────────────────────────────

export function handleClose(
  ws: Bun.ServerWebSocket<{ sessionId: string; nickname: string; role: string }>,
) {
  const state = connectionState.get(ws)
  if (!state) return

  const { sessionId, nickname, participantId } = state

  const clients = sessionClients.get(sessionId)
  if (clients) {
    clients.delete(ws)
    if (clients.size === 0) {
      sessionClients.delete(sessionId)
    }
  }

  connectionState.delete(ws)

  // Mark participant as left (async, don't block)
  db.update(sessionParticipants)
    .set({ status: 'left' })
    .where(eq(sessionParticipants.id, participantId))
    .then(async () => {
      // Broadcast system message: member left
      const [leftMsg] = await db
        .insert(messages)
        .values({
          sessionId,
          participantId,
          nickname: '系统',
          content: `${nickname} 离开了讨论`,
          type: 'user',
          messageType: 'system',
        })
        .returning()

      broadcast(sessionId, {
        type: 'message',
        message: {
          id: leftMsg.id,
          participantId: leftMsg.participantId,
          nickname: leftMsg.nickname,
          content: leftMsg.content,
          type: leftMsg.type,
          messageType: 'system',
          timestamp: leftMsg.timestamp,
        },
      })

      broadcast(sessionId, {
        type: 'participant-left',
        participantId,
        nickname,
      })
    })
    .catch(() => {})
}

// ── Utility ──────────────────────────────────────────────────────

const COLORS = [
  '#4F46E5',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#2563EB',
  '#65A30D',
  '#EA580C',
]

function getColor(nickname: string): string {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

export { broadcast }
