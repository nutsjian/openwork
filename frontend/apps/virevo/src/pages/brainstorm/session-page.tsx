import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PaperPlaneRight, StopCircle, FileText } from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { ScrollArea } from '@workspace/ui/components/scroll-area'
import { Separator } from '@workspace/ui/components/separator'
import { api } from '@/lib/api'

interface Message {
  id: string
  content: string
  type: 'user' | 'ai'
  timestamp: string
}

interface ExtractedEpic {
  title: string
  description: string
  features: {
    title: string
    description: string
    userStories: {
      title: string
      description: string
      acceptanceCriteria: string[]
    }[]
  }[]
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [epics, setEpics] = useState<ExtractedEpic[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    api.sessions
      .get(id)
      .then((data) => setMessages(data.messages || []))
      .catch(console.error)
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)

    // Optimistically add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      content,
      type: 'user',
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const result = await api.sessions.sendMessage(id!, content)
      // Add AI response if available from workflow
      if (result.aiMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            content: result.aiMessage,
            type: 'ai',
            timestamp: new Date().toISOString(),
          },
        ])
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleEnd = async () => {
    if (!confirm('确定要结束本次讨论会吗？')) return
    try {
      await api.sessions.end(id!)
    } catch (err) {
      console.error('Failed to end session:', err)
    }
  }

  const handleExtract = async () => {
    try {
      const result = await api.sessions.extract(id!)
      setEpics(result.epics)
      setShowPanel(true)
    } catch (err) {
      console.error('Failed to extract requirements:', err)
    }
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-1px)]">
      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            {messages.length === 0 ? (
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
            disabled={messages.length === 0}
          >
            <FileText className="size-4" />
            整理需求
          </Button>
          <Input
            ref={inputRef}
            placeholder="输入你的想法..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
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
            {epics.length === 0 ? (
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
