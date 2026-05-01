import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CaretDownIcon,
  CaretRightIcon,
  StarIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Badge } from '@workspace/ui/components/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { api } from '@/lib/api'

interface Project {
  id: string
  name: string
}

interface BacklogEpic {
  id: string
  title: string
  description: string
  averageScore: number
  reviewCount: number
  backlogStatus: string
  createdAt: string
  features: {
    id: string
    title: string
    description: string
    userStories: {
      id: string
      title: string
      description: string
      acceptanceCriteria: string[]
    }[]
  }[]
}

export function BacklogPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [epics, setEpics] = useState<BacklogEpic[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setEpics([])
      return
    }
    api.epics
      .backlog(selectedProjectId)
      .then(setEpics)
      .catch(() => setEpics([]))
  }, [selectedProjectId])

  const toggleEpic = (id: string) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (loading) {
    return <div className="p-6 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/virevo/brainstorm/projects"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            ← 项目列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Backlog</h1>
          <p className="text-muted-foreground text-sm">
            已评审通过的需求条目
          </p>
        </div>
        <div className="w-64">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {!selectedProjectId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">请选择一个项目查看 Backlog</p>
          </CardContent>
        </Card>
      ) : epics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircleIcon className="text-muted-foreground mb-2 size-8" />
            <p className="text-muted-foreground text-sm">
              暂无已准入的需求
            </p>
            <button
              type="button"
              className="mt-2 text-xs text-primary hover:underline"
              onClick={() => navigate(`/virevo/brainstorm/projects/${selectedProjectId}`)}
            >
              前往评审 →
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs">
            共 {epics.length} 个 Epic
          </p>

          {epics.map((epic) => {
            const isExpanded = expandedEpics.has(epic.id)
            const totalStories = epic.features.reduce(
              (sum, f) => sum + (f.userStories?.length || 0),
              0,
            )

            return (
              <Card key={epic.id}>
                <CardContent className="p-4">
                  {/* Epic header */}
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() => toggleEpic(epic.id)}
                  >
                    <div className="flex items-start gap-2">
                      {isExpanded ? (
                        <CaretDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <CaretRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{epic.title}</p>
                          <Badge variant="default" className="bg-green-600 px-1.5 py-0 text-[10px]">
                            admitted
                          </Badge>
                        </div>
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {epic.description}
                        </p>
                        <p className="text-muted-foreground text-[10px]">
                          {epic.features.length} 个功能点 · {totalStories} 个用户故事
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StarIcon weight="fill" className="size-3.5 text-amber-400" />
                      <span className="text-xs font-medium">
                        {epic.averageScore.toFixed(1)}
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 space-y-3 border-l-2 border-muted pl-4">
                      {epic.features.map((feature) => (
                        <div key={feature.id}>
                          <p className="text-xs font-medium">{feature.title}</p>
                          {feature.description && (
                            <p className="text-muted-foreground mt-0.5 text-[11px]">
                              {feature.description}
                            </p>
                          )}
                          {feature.userStories?.length > 0 && (
                            <div className="mt-1.5 ml-3 space-y-1.5">
                              {feature.userStories.map((story) => (
                                <div key={story.id} className="rounded-md bg-muted/50 px-2.5 py-1.5">
                                  <p className="text-[11px] font-medium">{story.title}</p>
                                  {story.description && (
                                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                                      {story.description}
                                    </p>
                                  )}
                                  {story.acceptanceCriteria?.length > 0 && (
                                    <ul className="mt-1 space-y-0.5">
                                      {story.acceptanceCriteria.map((ac, i) => (
                                        <li
                                          key={i}
                                          className="text-muted-foreground text-[10px]"
                                        >
                                          <span className="mr-1">✓</span>
                                          {ac}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
