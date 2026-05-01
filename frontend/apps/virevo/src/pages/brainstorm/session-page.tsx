import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  PaperPlaneRight,
  StopCircle,
  FileText,
  SpinnerGap,
  UserCircleIcon,
  RobotIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
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
  AlertDialogMedia,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@workspace/ui/components/sheet'
import { api } from '@/lib/api'
import { MarkdownContent } from '@/components/markdown-content'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Message {
  id: string
  content: string
  type: 'user' | 'ai'
  timestamp: string
  participantId: string
}

interface ExtractedEpic {
  id?: string
  title: string
  description: string
  features: {
    id?: string
    title: string
    description: string
    userStories: {
      id?: string
      title: string
      description: string
      acceptanceCriteria: string[]
    }[]
  }[]
}

const EXTRACT_STEPS = [
  '正在读取对话记录...',
  '正在分析需求结构...',
  '正在整理 Epic → Feature → User Story...',
  '正在保存结果...',
]

const SESSION_STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: '进行中', variant: 'default' },
  completing: { label: '正在生成纪要...', variant: 'secondary' },
  completed: { label: '已结束', variant: 'outline' },
}

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [sessionData, setSessionData] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [epics, setEpics] = useState<ExtractedEpic[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractStep, setExtractStep] = useState(0)
  const [ending, setEnding] = useState(false)
  const [showEndDialog, setShowEndDialog] = useState(false)
  const extractTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isReadOnly =
    !sessionData ||
    sessionData.status === 'completing' ||
    sessionData.status === 'completed'

  // Fetch session detail
  useEffect(() => {
    if (!sessionId) return
    api.sessions
      .get(sessionId)
      .then((data) => {
        setSessionData(data)
        setMessages(
          (data.messages || []).map((m: any) => ({
            id: m.id,
            content: m.content,
            type: m.type,
            timestamp: m.timestamp,
            participantId: m.participantId ?? m.type,
          })),
        )
      })
      .catch(() => navigate('/virevo/brainstorm/projects'))
  }, [sessionId, navigate])

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, streamingText])

  const projectName = sessionData?.project?.name ?? '项目'
  const sessionTitle = sessionData?.title ?? '讨论会'

  const handleSend = async () => {
    if (!input.trim() || sending || !sessionId || isReadOnly) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setStreamingText('')

    const userMsg: Message = {
      id: crypto.randomUUID(),
      content,
      type: 'user',
      timestamp: new Date().toISOString(),
      participantId: 'user',
    }
    setMessages((prev) => [...prev, userMsg])
    inputRef.current?.focus()

    const abort = new AbortController()

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: abort.signal,
        },
      )

      if (!res.ok) {
        console.error('[session] POST error:', res.status)
        setSending(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setSending(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:') || line.startsWith(':')) continue
          if (!line.startsWith('data:')) continue

          const dataStr = line.slice(5).trim()
          if (!dataStr) continue

          try {
            const event = JSON.parse(dataStr)

            if (event.text) {
              // Streaming chunk — accumulate and display in real-time
              fullText += event.text
              setStreamingText(fullText)
            } else if (event.saved) {
              // AI message fully saved to DB — finalize
              setStreamingText('')
              if (fullText) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    content: fullText,
                    type: 'ai',
                    timestamp: new Date().toISOString(),
                    participantId: 'ai',
                  },
                ])
              }
            }
          } catch {
            // non-JSON data, ignore
          }
        }
      }

      // If stream ended without a 'saved' event, still commit the text
      if (fullText && !streamingText) {
        // already committed via 'saved' event
      } else if (fullText) {
        setStreamingText('')
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            content: fullText,
            type: 'ai',
            timestamp: new Date().toISOString(),
            participantId: 'ai',
          },
        ])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[session] Fetch error:', err.message)
      }
    } finally {
      setSending(false)
    }
  }

  const handleEnd = async () => {
    setShowEndDialog(false)
    setEnding(true)
    try {
      await api.sessions.end(sessionId!)
      navigate(`/virevo/brainstorm/projects/${sessionData.projectId}`)
    } catch (err) {
      console.error('Failed to end session:', err)
      setEnding(false)
    }
  }

  const handleExtract = async () => {
    setExtracting(true)
    setExtractStep(0)
    setShowPanel(true)

    extractTimerRef.current = setInterval(() => {
      setExtractStep((prev) => Math.min(prev + 1, EXTRACT_STEPS.length - 1))
    }, 8000)

    try {
      const result = await api.sessions.extract(sessionId!)
      setEpics(result.epics ?? [])
    } catch (err) {
      console.error('Failed to extract requirements:', err)
      setEpics([])
    } finally {
      if (extractTimerRef.current) {
        clearInterval(extractTimerRef.current)
        extractTimerRef.current = null
      }
      setExtracting(false)
    }
  }

  useEffect(() => {
    return () => {
      if (extractTimerRef.current) clearInterval(extractTimerRef.current)
    }
  }, [])

  if (!sessionData) {
    return (
      <div className="flex h-[calc(100vh-var(--header-height)-1px)] items-center justify-center">
        <SpinnerGap className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statusInfo = SESSION_STATUS_LABEL[sessionData.status]

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-1px)]">
      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/virevo/brainstorm/projects"
              className="text-muted-foreground hover:text-foreground"
            >
              项目列表
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              to={`/virevo/brainstorm/projects/${sessionData.projectId}`}
              className="text-muted-foreground hover:text-foreground"
            >
              {projectName}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{sessionTitle}</span>
            {statusInfo && (
              <Badge variant={statusInfo.variant} className="ml-2">
                {sessionData.status === 'completing' && (
                  <SpinnerGap className="mr-1 size-3 animate-spin" />
                )}
                {statusInfo.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1">
          <div className="mx-auto max-w-2xl flex flex-col gap-1 p-4">
            {messages.length === 0 && !streamingText ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-lg">开始讨论吧</p>
                <p className="text-sm">AI 将帮助你梳理需求</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))
            )}

            {/* Streaming AI response */}
            {streamingText && (
              <ChatBubble
                message={{
                  id: 'streaming',
                  content: streamingText,
                  type: 'ai',
                  timestamp: new Date().toISOString(),
                  participantId: 'ai',
                }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator />

        {/* Input Bar */}
        <div className="flex items-center gap-2 p-4">
          <Button
            variant="outline"
            onClick={handleExtract}
            disabled={messages.length === 0 || sending || extracting || isReadOnly}
          >
            {extracting ? (
              <SpinnerGap className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            {extracting ? '整理中...' : '整理需求'}
          </Button>
          <Input
            ref={inputRef}
            placeholder={
              isReadOnly ? '讨论会已结束' : '输入你的想法...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && !e.shiftKey && handleSend()
            }
            disabled={sending || isReadOnly}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending || isReadOnly}
            size="icon"
          >
            <PaperPlaneRight className="size-4" />
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowEndDialog(true)}
            disabled={sending || ending || isReadOnly}
          >
            <StopCircle className="size-4" />
            结束
          </Button>
        </div>
      </div>

      {/* Requirements Sheet */}
      <Sheet open={showPanel} onOpenChange={setShowPanel}>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>需求结构</SheetTitle>
            <SheetDescription>
              {extracting
                ? 'AI 正在分析对话并提取需求...'
                : `共 ${epics.length} 个 Epic`}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4 pb-4">
            {extracting ? (
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <SpinnerGap className="size-4 animate-spin text-primary" />
                  <span>正在整理需求...</span>
                </div>
                <ul className="flex flex-col gap-2 text-xs">
                  {EXTRACT_STEPS.map((step, i) => (
                    <li
                      key={i}
                      className={
                        i <= extractStep
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {i <= extractStep ? '✓' : '○'} {step}
                    </li>
                  ))}
                </ul>
              </div>
            ) : epics.length === 0 ? (
              <p className="pt-2 text-muted-foreground text-xs">
                暂未提取到需求
              </p>
            ) : (
              <div className="flex flex-col gap-4 pt-2">
                {epics.map((epic, i) => (
                  <div key={epic.id ?? i} className="flex flex-col gap-2">
                    <div className="rounded bg-primary/10 px-3 py-2">
                      <p className="text-sm font-semibold text-primary">
                        Epic: {epic.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {epic.description}
                      </p>
                    </div>
                    {(epic.features ?? []).map((feature, j) => (
                      <div
                        key={feature.id ?? j}
                        className="ml-4 rounded bg-muted/50 px-3 py-2"
                      >
                        <p className="text-sm font-medium">
                          Feature: {feature.title}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {feature.description}
                        </p>
                        {(feature.userStories ?? []).map((story, k) => (
                          <div
                            key={story.id ?? k}
                            className="ml-4 mt-2 text-muted-foreground"
                          >
                            <p className="text-xs font-medium">
                              Story: {story.title}
                            </p>
                            <p className="text-xs">{story.description}</p>
                            {story.acceptanceCriteria.length > 0 && (
                              <ul className="ml-3 mt-1 list-disc text-xs">
                                {story.acceptanceCriteria.map((ac, l) => (
                                  <li key={l}>{ac}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* End Session Confirmation Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <WarningCircleIcon className="size-5 text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>结束本次讨论会？</AlertDialogTitle>
            <AlertDialogDescription>
              结束后，AI 将在后台自动生成会议纪要。你可以在项目详情的「会议记录」中查看。
              结束后无法继续发送消息。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>
              继续讨论
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleEnd} disabled={ending}>
              {ending ? (
                <>
                  <SpinnerGap className="size-4 animate-spin" />
                  结束中...
                </>
              ) : (
                '确认结束'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Chat Bubble Component ──────────────────────────────────────────

function ChatBubble({
  message,
  isStreaming = false,
}: {
  message: Message
  isStreaming?: boolean
}) {
  const isUser = message.type === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex gap-3 py-2 ${isUser ? '' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <UserCircleIcon className="size-5 text-primary" weight="fill" />
          </div>
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <RobotIcon className="size-5 text-muted-foreground" weight="fill" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {isUser ? '你' : 'AI 助手'}
          </span>
          <span className="text-muted-foreground text-xs">{time}</span>
        </div>
        <div className="min-w-0 rounded-lg px-3 py-2 text-sm">
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
          {isStreaming && (
            <span className="ml-0.5 inline-block animate-pulse text-muted-foreground">
              ▊
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
