import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  ListChecksIcon,
  PlusIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'
import { api } from '@/lib/api'

interface Session {
  id: string
  title: string
  status: string
  createdAt: string
  endedAt: string | null
}

interface Minute {
  id: string
  sessionDate: string
  summary: string
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [minutes, setMinutes] = useState<Minute[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.projects.get(id),
      api.sessions.listByProject(id),
      api.minutes.listByProject(id),
    ])
      .then(([proj, sess, mins]) => {
        setProject(proj)
        setSessions(sess)
        setMinutes(mins)
      })
      .catch(() => navigate('/virevo/brainstorm/projects'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleStartSession = async () => {
    if (!id || starting) return
    setStarting(true)
    try {
      const session = await api.sessions.create({
        projectId: id,
        title: `${project?.name || '需求讨论会'}`,
      })
      navigate(`/virevo/sessions/${session.id}`)
    } catch (err) {
      console.error('Failed to start session:', err)
      setStarting(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">加载中...</div>
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <span className="size-1.5 rounded-full bg-green-500" />
            进行中
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircleIcon className="size-3" />
            已结束
          </span>
        )
      default:
        return (
          <span className="text-muted-foreground text-xs">{status}</span>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/virevo/brainstorm/projects"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            ← 项目列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{project?.name}</h1>
          <p className="text-muted-foreground text-sm">
            {project?.description || '暂无描述'}
          </p>
        </div>
        <Button onClick={handleStartSession} disabled={starting}>
          <PlusIcon className="size-4" />
          {starting ? '创建中...' : '开始新的讨论会'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sessions">
        <TabsList variant="line">
          <TabsTrigger value="sessions">
            <ChatCircleDotsIcon className="size-3.5" />
            讨论会 ({sessions.length})
          </TabsTrigger>
          <TabsTrigger value="minutes">
            <ClockCounterClockwiseIcon className="size-3.5" />
            会议记录 ({minutes.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <ListChecksIcon className="size-3.5" />
            评审
          </TabsTrigger>
        </TabsList>

        {/* Tab: Sessions */}
        <TabsContent value="sessions">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  暂无讨论会，点击上方按钮开始
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() =>
                    navigate(`/virevo/sessions/${session.id}`)
                  }
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{session.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(session.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    {statusLabel(session.status)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Minutes */}
        <TabsContent value="minutes">
          {minutes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">暂无会议记录</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {minutes.map((minute) => (
                <Card key={minute.id}>
                  <CardContent className="p-4">
                    <p className="mb-2 text-sm font-medium">
                      {new Date(minute.sessionDate).toLocaleDateString('zh-CN')}
                    </p>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                        {minute.summary.length > 300
                          ? minute.summary.substring(0, 300) + '...'
                          : minute.summary}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Reviews */}
        <TabsContent value="reviews">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ListChecksIcon className="text-muted-foreground mb-2 size-8" />
              <p className="text-muted-foreground text-sm">
                评审功能即将上线
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
