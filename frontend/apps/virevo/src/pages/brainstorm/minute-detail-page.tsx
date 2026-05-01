import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { api } from '@/lib/api'
import { MarkdownContent } from '@/components/markdown-content'

interface MinuteDetail {
  id: string
  sessionId: string
  projectId: string
  sessionDate: string
  summary: string
  participants: string[]
  proposedRequirements: unknown[]
  openQuestions: string[]
  actionItems: unknown[]
  createdAt: string
}

export function MinuteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [minute, setMinute] = useState<MinuteDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const projectId = searchParams.get('projectId')

  useEffect(() => {
    if (!id) return
    api.minutes
      .get(id)
      .then((data) => setMinute(data))
      .catch(() => {
        if (projectId) {
          navigate(`/virevo/brainstorm/projects/${projectId}`)
        } else {
          navigate('/virevo/brainstorm/projects')
        }
      })
      .finally(() => setLoading(false))
  }, [id, projectId, navigate])

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-72" />
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (!minute) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        纪要未找到
      </div>
    )
  }

  const dateStr = new Date(minute.sessionDate).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-6 p-6">
        {/* Breadcrumb */}
        <nav className="flex shrink-0 items-center gap-2 text-sm">
          <Link
            to="/virevo/brainstorm/projects"
            className="text-muted-foreground hover:text-foreground"
          >
            项目列表
          </Link>
          {projectId && (
            <>
              <span className="text-muted-foreground">/</span>
              <Link
                to={`/virevo/brainstorm/projects/${projectId}`}
                className="text-muted-foreground hover:text-foreground"
              >
                会议记录
              </Link>
            </>
          )}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">纪要详情</span>
        </nav>

        {/* Header */}
        <div className="shrink-0">
          <p className="text-muted-foreground text-sm">{dateStr}</p>
          <h1 className="mt-1 text-2xl font-semibold">会议纪要</h1>
        </div>

        {/* Content */}
        <div className="min-w-0">
          <MarkdownContent content={minute.summary} />
        </div>
      </div>
    </div>
  )
}
