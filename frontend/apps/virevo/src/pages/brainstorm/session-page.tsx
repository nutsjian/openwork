import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  PaperPlaneRight,
  StopCircle,
  FileText,
  SpinnerGap,
} from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Separator } from '@workspace/ui/components/separator'
import { api } from '@/lib/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Message {
  id: string
  content: string
  type: 'user' | 'ai'
  timestamp: string
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
  const extractTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch session detail (includes project info for breadcrumb + messages)
  useEffect(() => {
    if (!sessionId) return
    api.sessions
      .get(sessionId)
      .then((data) => {
        setSessionData(data)
        setMessages(data.messages || [])
      })
      .catch(() => navigate('/virevo/brainstorm/projects'))
  }, [sessionId, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const projectName = sessionData?.project?.name ?? '项目'
  const sessionTitle = sessionData?.title ?? '讨论会'

  const handleSend = async () => {
    if (!input.trim() || sending || !sessionId) return
    const content = input.trim()
    setInput('')
    setSending(true)
    setStreamingText('')

    // Add user message to UI immediately
    const userMsg: Message = {
      id: crypto.randomUUID(),
      content,
      type: 'user',
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    inputRef.current?.focus()

    // POST to server and consume the SSE response stream
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
        const errBody = await res.text()
        console.error('[session] POST error:', res.status, errBody)
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines from the buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event:') || line.startsWith(':')) {
            // skip event type lines and SSE comments
            continue
          }
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim()
            if (!dataStr) continue

            try {
              const event = JSON.parse(dataStr)

              if (event.type === 'step-result' && event.id === 'ai-turn') {
                // ai-turn completed — use the final output
                setStreamingText('')
                const aiMessage = event.output?.aiMessage
                if (aiMessage) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      content: aiMessage,
                      type: 'ai',
                      timestamp: new Date().toISOString(),
                    },
                  ])
                }
              } else if (event.type === 'done') {
                setStreamingText('')
              } else if (event.type === 'error') {
                console.error('[session] Stream error:', event.error)
                setStreamingText('')
              }
            } catch {
              // non-JSON data, ignore
            }
          }
        }
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
    if (!confirm('确定要结束本次讨论会吗？')) return
    setSending(true)
    try {
      await api.sessions.end(sessionId!)
    } catch (err) {
      console.error('Failed to end session:', err)
    } finally {
      setSending(false)
    }
  }

  const handleExtract = async () => {
    setExtracting(true)
    setExtractStep(0)
    setShowPanel(true)

    // Simulate progress steps while waiting for the API
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

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (extractTimerRef.current) clearInterval(extractTimerRef.current)
    }
  }, [])

  if (!sessionData) {
    return <div className="p-6 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-1px)]">
      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
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
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            {messages.length === 0 && !streamingText ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-lg">开始讨论吧</p>
                <p className="text-sm">AI 将帮助你梳理需求</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {/* Streaming indicator */}
            {streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2 text-sm">
                  {streamingText}
                  <span className="animate-pulse text-muted-foreground">
                    ▊
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator />

        {/* Input Bar */}
        <div className="flex items-center gap-2 p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExtract}
            disabled={messages.length === 0 || sending || extracting}
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
            placeholder="输入你的想法..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && !e.shiftKey && handleSend()
            }
            disabled={sending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            size="icon"
          >
            <PaperPlaneRight className="size-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEnd}
            disabled={sending}
          >
            <StopCircle className="size-4" />
            结束
          </Button>
        </div>
      </div>

      {/* Requirements Panel */}
      {showPanel && (
        <div className="w-80 border-l">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="text-sm font-semibold">需求结构</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPanel(false)}
            >
              关闭
            </Button>
          </div>
          <ScrollArea className="h-[calc(100%-49px)] p-3">
            {extracting ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <SpinnerGap className="size-4 animate-spin text-primary" />
                  <span>正在整理需求...</span>
                </div>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
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
              <p className="text-muted-foreground text-xs">
                暂未提取到需求
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {epics.map((epic, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="rounded bg-primary/10 px-2 py-1">
                      <p className="text-xs font-semibold text-primary">
                        Epic: {epic.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {epic.description}
                      </p>
                    </div>
                    {epic.features.map((feature, j) => (
                      <div
                        key={j}
                        className="ml-3 rounded bg-muted/50 px-2 py-1"
                      >
                        <p className="text-xs font-medium">
                          Feature: {feature.title}
                        </p>
                        {feature.userStories.map((story, k) => (
                          <div key={k} className="ml-3 mt-1 text-muted-foreground">
                            <p className="text-xs">
                              Story: {story.title}
                            </p>
                            {story.acceptanceCriteria.length > 0 && (
                              <ul className="ml-2 list-disc text-xs">
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
        </div>
      )}
    </div>
  )
}
