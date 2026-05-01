import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  HandWavingIcon,
  HandPointingIcon,
  RobotIcon,
  ArrowLeftIcon,
  SparkleIcon,
  StopCircleIcon,
  CopyIcon,
  UsersIcon,
  ChatCircleDotsIcon,
  PaperPlaneRightIcon,
} from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { Badge } from '@workspace/ui/components/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { createSessionWebSocket, getAvatarColor } from '@/lib/api'
import { toast } from 'sonner'
import { MarkdownContent } from '@/components/markdown-content'

// ── Types ───────────────────────────────────────────────────────

interface WsMessage {
  type: string
  data?: any
  message?: any
  text?: string
}

interface ChatMsg {
  id: string
  participantId: string
  nickname: string
  type: 'user' | 'ai'
  messageType: string // 'text' | 'system' | 'ai'
  content: string
  timestamp: string
}

interface HandRaise {
  id: string
  participantId: string
  nickname: string
  status: 'pending' | 'allowed' | 'dismissed'
}

interface OnlineParticipant {
  participantId: string
  nickname: string
  role: 'host' | 'member'
  color: string
}

// ── Helpers ─────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Format timestamp to short Chinese time */
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Group messages by time gap (5 minutes) */
const TIME_GAP_MS = 5 * 60 * 1000

function needsTimestamp(prev: ChatMsg | null, curr: ChatMsg): boolean {
  if (!prev) return true
  return (
    new Date(curr.timestamp).getTime() -
      new Date(prev.timestamp).getTime() >=
    TIME_GAP_MS
  )
}

/** localStorage key for persisting participantId per session */
function getParticipantKey(sessionId: string): string {
  return `virevo:participant:${sessionId}`
}

// ── Component ───────────────────────────────────────────────────

export function LiveSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Identity from URL params
  const nickname = searchParams.get('nickname') || '匿名'
  const role = (searchParams.get('role') || 'member') as 'host' | 'member'

  // State
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [connected, setConnected] = useState(false)
  const [handRaises, setHandRaises] = useState<HandRaise[]>([])
  const [onlineParticipants, setOnlineParticipants] = useState<
    OnlineParticipant[]
  >([])
  const [aiStreaming, setAiStreaming] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [endDialogOpen, setEndDialogOpen] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const myParticipantId = useRef<string | null>(null)
  const aiStreamingRef = useRef(false)
  const [inputValue, setInputValue] = useState('')

  const isHost = role === 'host'

  // ── Restore participantId from localStorage ───────────────────
  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(getParticipantKey(sessionId))
      if (saved) {
        myParticipantId.current = saved
      }
    }
  }, [sessionId])

  // ── Auto-scroll ───────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, aiStreaming])

  // ── WebSocket connect ─────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || wsRef.current) return

    const ws = createSessionWebSocket({
      sessionId,
      nickname,
      role,
    })
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        handleMessage(msg)
      } catch (err) {
        console.error('[WS] parse error:', err)
      }
    }

    ws.onclose = () => {
      setConnected(false)
    }

    ws.onerror = () => {
      setConnected(false)
    }

    return () => {
      if (ws.readyState < 2) {
        ws.close()
      }
      wsRef.current = null
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle incoming messages ──────────────────────────────────
  const handleMessage = (msg: WsMessage) => {
    switch (msg.type) {
      case 'joined': {
        // Set my participantId from server (persistent identity)
        if (msg.participant?.id) {
          myParticipantId.current = msg.participant.id
          if (sessionId) {
            localStorage.setItem(
              getParticipantKey(sessionId),
              msg.participant.id,
            )
          }
        }

        // Load existing messages
        if (msg.messages) {
          setMessages(
            msg.messages.map((m: any) => ({
              id: m.id,
              participantId: m.participantId,
              nickname: m.nickname,
              type: m.type,
              messageType: m.messageType || 'text',
              content: m.content,
              timestamp: m.timestamp,
            })),
          )
        }
        if (msg.participants) {
          setOnlineParticipants(
            msg.participants.map((p: any) => ({
              participantId: p.id,
              nickname: p.nickname,
              role: p.role,
              color: p.color,
            })),
          )
        }
        if (msg.handRaises) {
          setHandRaises(
            msg.handRaises.map((h: any) => ({
              id: h.id,
              participantId: h.participantId,
              nickname: '',
              status: h.status,
            })),
          )
        }
        break
      }

      case 'message': {
        const m = msg.message || msg.data
        if (!m) break
        setMessages((prev) => [
          ...prev,
          {
            id: m.id || genId(),
            participantId: m.participantId,
            nickname: m.nickname,
            type: m.type,
            messageType: m.messageType || 'text',
            content: m.content,
            timestamp: m.timestamp || new Date().toISOString(),
          },
        ])
        break
      }

      case 'summary-started':
        aiStreamingRef.current = true
        setAiStreaming(true)
        break

      case 'ai-chunk': {
        const text = msg.text ?? ''
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.type === 'ai' && aiStreamingRef.current) {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...last,
              content: last.content + text,
            }
            return updated
          }
          return [
            ...prev,
            {
              id: genId(),
              participantId: 'ai',
              nickname: 'AI 助手',
              type: 'ai' as const,
              messageType: 'ai',
              content: text,
              timestamp: new Date().toISOString(),
            },
          ]
        })
        break
      }

      case 'ai-done':
        aiStreamingRef.current = false
        setAiStreaming(false)
        break

      case 'hand-raised': {
        const h = msg.data?.hand || msg.data
        setHandRaises((prev) => [
          ...prev,
          {
            id: h.id || genId(),
            participantId: h.participantId,
            nickname: h.nickname || '',
            status: 'pending',
          },
        ])
        break
      }

      case 'hand-allowed':
        setHandRaises((prev) =>
          prev.map((h) =>
            h.participantId === msg.data?.participantId
              ? { ...h, status: 'allowed' as const }
              : h,
          ),
        )
        break

      case 'hand-cancelled':
        setHandRaises((prev) =>
          prev.filter((h) => h.participantId !== msg.data?.participantId),
        )
        break

      case 'participant-joined': {
        const p = msg.data?.participant
        if (p) {
          setOnlineParticipants((prev) => [
            ...prev,
            {
              participantId: p.id,
              nickname: p.nickname,
              role: p.role,
              color: p.color || getAvatarColor(p.nickname),
            },
          ])
        }
        break
      }

      case 'participant-left':
        setOnlineParticipants((prev) =>
          prev.filter((p) => p.participantId !== msg.data?.participantId),
        )
        break

      case 'session-ended':
        setSessionEnded(true)
        toast.info('讨论会已结束')
        break

      case 'error':
        toast.error(msg.message || '操作失败')
        break
    }
  }

  // ── Send message ──────────────────────────────────────────────
  const sendMessage = () => {
    const text = inputValue.trim()
    if (!wsRef.current || !text || sessionEnded) return
    wsRef.current.send(
      JSON.stringify({
        type: 'message',
        content: text,
      }),
    )
    setInputValue('')
    if (editorRef.current) {
      editorRef.current.textContent = ''
    }
  }

  // ── Raise hand ────────────────────────────────────────────────
  const handleRaiseHand = () => {
    if (!wsRef.current || sessionEnded) return
    wsRef.current.send(JSON.stringify({ type: 'raise-hand' }))
  }

  // ── Cancel hand ───────────────────────────────────────────────
  const handleCancelHand = () => {
    if (!wsRef.current) return
    wsRef.current.send(JSON.stringify({ type: 'cancel-hand' }))
  }

  // ── Allow hand (host) ─────────────────────────────────────────
  const handleAllowHand = (handId: string, participantId: string) => {
    if (!wsRef.current) return
    wsRef.current.send(
      JSON.stringify({ type: 'allow-hand', handId, participantId }),
    )
  }

  // ── Request AI summary (host) ─────────────────────────────────
  const handleRequestSummary = () => {
    if (!wsRef.current || aiStreaming || sessionEnded) return
    wsRef.current.send(JSON.stringify({ type: 'request-summary' }))
  }

  // ── End session (host) ────────────────────────────────────────
  const handleEndSession = () => {
    if (!wsRef.current) return
    wsRef.current.send(JSON.stringify({ type: 'end-session' }))
    setEndDialogOpen(false)
  }

  // ── Copy invite link ──────────────────────────────────────────
  const handleCopyInviteLink = async () => {
    if (!sessionId) return
    const link = `${window.location.origin}/virevo/sessions/${sessionId}/live?nickname=&role=member`
    await navigator.clipboard.writeText(link)
    toast.success('会议链接已复制')
  }

  // ── Computed ──────────────────────────────────────────────────
  const myHandRaised = useMemo(
    () =>
      handRaises.some(
        (h) =>
          h.participantId === myParticipantId.current &&
          h.status === 'pending',
      ),
    [handRaises],
  )

  const pendingHandRaises = useMemo(
    () => handRaises.filter((h) => h.status === 'pending'),
    [handRaises],
  )

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex size-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              navigate(
                `/virevo/brainstorm/projects/${searchParams.get('projectId') || ''}`,
              )
            }
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">实时讨论</h1>
              <Badge
                variant={connected ? 'default' : 'destructive'}
                className="text-[10px]"
              >
                {connected ? '已连接' : '未连接'}
              </Badge>
              {sessionEnded && (
                <Badge variant="secondary" className="text-[10px]">
                  已结束
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {nickname}
              {isHost && (
                <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  主持人
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UsersIcon className="size-3.5" />
            {onlineParticipants.length} 在线
          </div>
          <Separator orientation="vertical" className="h-4" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyInviteLink}
            title="复制会议链接"
          >
            <CopyIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Hand raises bar */}
      {isHost && pendingHandRaises.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-5 py-2">
          <HandWavingIcon className="size-4 text-yellow-500" />
          <span className="text-xs">举手发言:</span>
          {pendingHandRaises.map((h) => (
            <div key={h.id} className="flex items-center gap-1.5">
              <Badge variant="secondary" className="gap-1 text-xs">
                <div
                  className="size-3 rounded-full"
                  style={{
                    backgroundColor: getAvatarColor(h.nickname),
                  }}
                />
                {h.nickname}
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleAllowHand(h.id, h.participantId)}
                title="允许发言"
              >
                <HandPointingIcon className="size-3 text-green-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <ChatCircleDotsIcon className="mb-2 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">开始讨论吧！</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null
            const isSystem = msg.messageType === 'system'
            const isAi = msg.type === 'ai'
            const isMine =
              msg.participantId === myParticipantId.current &&
              !isSystem &&
              !isAi

            // ── Timestamp separator ──
            const showTimestamp = needsTimestamp(prev, msg)

            // ── System message ──
            if (isSystem) {
              return (
                <div key={msg.id}>
                  {showTimestamp && (
                    <div className="my-4 flex items-center justify-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-muted-foreground text-[10px]">
                        {formatTime(msg.timestamp)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className="flex items-center justify-center py-1">
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                      {msg.content}
                    </span>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id}>
                {showTimestamp && (
                  <div className="my-4 flex items-center justify-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-muted-foreground text-[10px]">
                      {formatTime(msg.timestamp)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}

                <div
                  className={`flex gap-2.5 py-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                    style={{
                      backgroundColor: isAi
                        ? '#6366F1'
                        : getAvatarColor(msg.nickname),
                    }}
                  >
                    {isAi ? (
                      <RobotIcon className="size-4" />
                    ) : (
                      msg.nickname.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex max-w-[80%] flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {!isMine && (
                      <span className="text-[10px] text-muted-foreground">
                        {msg.nickname}
                      </span>
                    )}

                    {isAi ? (
                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-4 text-sm shadow-[0_0_20px_rgba(99,102,241,0.06)] [&_*]:min-w-0">
                        <MarkdownContent content={msg.content} />
                        {aiStreaming &&
                          messages[messages.length - 1]?.id === msg.id && (
                            <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-indigo-400" />
                          )}
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isMine
                            ? 'rounded-tr-md bg-primary text-primary-foreground'
                            : 'rounded-tl-md bg-muted'
                          }`}
                      >
                        {msg.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom input bar */}
      {!sessionEnded && (
        <div className="shrink-0 px-4 pt-2 pb-4">
          <div className="mx-auto max-w-2xl rounded-xl border bg-background/95 shadow-lg backdrop-blur-sm">
            <div className="flex items-end gap-2 p-2">
              <Button
                variant={myHandRaised ? 'default' : 'ghost'}
                size="icon-sm"
                onClick={myHandRaised ? handleCancelHand : handleRaiseHand}
                title={myHandRaised ? '取消举手' : '举手发言'}
                disabled={!connected}
                className="shrink-0 rounded-lg"
              >
                <HandWavingIcon
                  className={`size-4 ${myHandRaised ? 'animate-bounce' : ''}`}
                />
              </Button>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                data-placeholder="输入消息，按 Enter 发送..."
                className="flex max-h-[160px] min-h-[36px] flex-1 overflow-y-auto rounded-lg border border-input bg-transparent px-3 py-2 text-sm break-words whitespace-pre-wrap outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                onInput={() => {
                  if (editorRef.current) {
                    setInputValue(editorRef.current.textContent || '')
                  }
                }}
              />

              <Button
                onClick={sendMessage}
                disabled={!connected || !inputValue.trim() || sessionEnded}
                size="icon-sm"
                className="shrink-0 rounded-lg"
              >
                <PaperPlaneRightIcon className="size-4" />
              </Button>
            </div>

            {isHost && (
              <div className="flex items-center justify-end gap-2 border-t px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRequestSummary}
                  disabled={aiStreaming || sessionEnded}
                  className="h-7 gap-1.5 rounded-lg text-xs"
                >
                  <SparkleIcon className="size-3" />
                  AI 总结
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEndDialogOpen(true)}
                  disabled={sessionEnded}
                  className="h-7 gap-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <StopCircleIcon className="size-3" />
                  结束讨论
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* End session dialog */}
      <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>结束讨论</AlertDialogTitle>
            <AlertDialogDescription>
              确定要结束这个讨论会吗？结束后所有人将无法继续发送消息。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndSession}>
              确认结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
