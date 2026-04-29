import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ChatCircleDotsIcon, ClockCounterClockwiseIcon, ListChecksIcon, PlusIcon } from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { api } from '@/lib/api'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.projects
      .get(id)
      .then(setProject)
      .catch(() => navigate('/virevo/brainstorm/projects'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleStartSession = async () => {
    const session = await api.sessions.create({
      projectId: id!,
      title: `${project?.name || '需求讨论会'}`,
    })
    navigate(`/virevo/brainstorm/projects/${id}/sessions/${session.id}`)
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{project?.name}</h1>
        <p className="text-muted-foreground text-sm">
          {project?.description || '暂无描述'}
        </p>
      </div>

      <Button onClick={handleStartSession}>
        <ChatCircleDotsIcon className="size-4" />
        开始讨论会
      </Button>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to={`/virevo/brainstorm/projects/${id}/sessions`}>
          <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <ChatCircleDotsIcon className="text-muted-foreground size-5" />
            <div>
              <p className="text-sm font-medium">讨论会</p>
              <p className="text-muted-foreground text-xs">
                AI 辅助需求讨论
              </p>
            </div>
          </div>
        </Link>
        <Link to={`/virevo/brainstorm/projects/${id}/minutes`}>
          <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <ClockCounterClockwiseIcon className="text-muted-foreground size-5" />
            <div>
              <p className="text-sm font-medium">会议记录</p>
              <p className="text-muted-foreground text-xs">
                查看会议纪要
              </p>
            </div>
          </div>
        </Link>
        <Link to={`/virevo/brainstorm/projects/${id}/reviews`}>
          <div className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <ListChecksIcon className="text-muted-foreground size-5" />
            <div>
              <p className="text-sm font-medium">评审</p>
              <p className="text-muted-foreground text-xs">
                需求评分与评审
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
