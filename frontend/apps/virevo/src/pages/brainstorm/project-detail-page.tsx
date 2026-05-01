import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  ListChecksIcon,
  PlusIcon,
  CheckCircleIcon,
  UsersIcon,
  CopyIcon,
  TrashIcon,
  HandWavingIcon,
  StarIcon,
  CaretDownIcon,
  CaretRightIcon,
  ArrowBendUpRightIcon,
  ProhibitIcon,
} from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
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
import { api, getAvatarColor } from '@/lib/api'
import { toast } from 'sonner'

/** Strip markdown syntax for plain text preview */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/- \[x\]/gi, '☑')
    .replace(/- \[ \]/gi, '☐')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

interface Session {
  id: string
  title: string
  status: string
  createdAt: string
  endedAt: string | null
  lastMessageAt: string | null
  lastMessagePreview: string
}

interface Minute {
  id: string
  sessionDate: string
  summary: string
}

interface Member {
  id: string
  name: string
  email: string | null
  role: 'owner' | 'member'
  joinedAt: string
}

interface EpicWithTree {
  id: string
  title: string
  description: string
  averageScore: number
  reviewCount: number
  backlogStatus: string
  features: FeatureWithStories[]
}

interface FeatureWithStories {
  id: string
  title: string
  description: string
  userStories: { id: string; title: string; description: string; acceptanceCriteria: string[] }[]
}

// ── Star Rating Component ───────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}) {
  const [hover, setHover] = useState(0)
  const iconSize = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-transform hover:scale-110`}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => onChange?.(star)}
        >
          <StarIcon
            weight={star <= (hover || value) ? 'fill' : 'regular'}
            className={`${iconSize} ${star <= (hover || value) ? 'text-amber-400' : 'text-muted-foreground/40'}`}
          />
        </button>
      ))}
    </div>
  )
}

// ── Epic Card Component ──────────────────────────────────────────

function EpicCard({
  epic,
  members,
  onScore,
  onAdmit,
  onReject,
}: {
  epic: EpicWithTree
  members: Member[]
  onScore: (epicId: string, score: number) => void
  onAdmit: (epicId: string) => void
  onReject: (epicId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const canAdmit = epic.averageScore >= 3.5 && epic.reviewCount > 0 && epic.backlogStatus === 'pending'
  const isAdmitted = epic.backlogStatus === 'admitted'
  const isRejected = epic.backlogStatus === 'rejected'

  const statusBadge = isAdmitted ? (
    <Badge variant="default" className="bg-green-600 text-[10px]">已准入</Badge>
  ) : isRejected ? (
    <Badge variant="secondary" className="text-[10px]">已拒绝</Badge>
  ) : canAdmit ? (
    <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">可准入</Badge>
  ) : null

  return (
    <Card className={isRejected ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{epic.title}</p>
              {statusBadge}
            </div>
            <p className="text-muted-foreground line-clamp-2 text-xs">
              {epic.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <StarRating value={Math.round(epic.averageScore)} readonly size="sm" />
              <span className="text-xs font-medium">
                {epic.averageScore > 0 ? epic.averageScore.toFixed(1) : '-'}
              </span>
            </div>
            <span className="text-muted-foreground text-[10px]">
              {epic.reviewCount} 人评审
            </span>
          </div>
        </div>

        {/* Feature/Story tree */}
        {epic.features.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <CaretDownIcon className="size-3" />
              ) : (
                <CaretRightIcon className="size-3" />
              )}
              {epic.features.length} 个功能点
            </button>

            {expanded && (
              <div className="mt-2 ml-2 space-y-2 border-l-2 border-muted pl-3">
                {epic.features.map((feature) => (
                  <div key={feature.id}>
                    <p className="text-xs font-medium">{feature.title}</p>
                    {feature.userStories?.length > 0 && (
                      <div className="mt-1 ml-3 space-y-1">
                        {feature.userStories.map((story) => (
                          <div key={story.id} className="text-muted-foreground text-[11px]">
                            <span className="mr-1">•</span>
                            {story.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {epic.backlogStatus === 'pending' && (
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">你的评分：</span>
              <StarRating value={0} onChange={(v) => onScore(epic.id, v)} size="sm" />
            </div>
            {canAdmit && (
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => onReject(epic.id)}
                >
                  <ProhibitIcon className="size-3" />
                  拒绝
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onAdmit(epic.id)}
                >
                  <ArrowBendUpRightIcon className="size-3" />
                  准入 Backlog
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Component ──────────────────────────────────────────────

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [minutes, setMinutes] = useState<Minute[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [epics, setEpics] = useState<EpicWithTree[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  // Member dialog state
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Reject dialog
  const [rejectDialogEpicId, setRejectDialogEpicId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.projects.get(id),
      api.sessions.listByProject(id),
      api.minutes.listByProject(id),
      api.members.list(id),
      api.epics.listByProject(id),
    ])
      .then(([proj, sess, mins, mems, epc]) => {
        setProject(proj)
        setSessions(sess)
        setMinutes(mins)
        setMembers(mems)
        setEpics(epc)
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

  const handleAddMember = async () => {
    if (!id || !newMemberName.trim()) return
    setAddingMember(true)
    try {
      await api.members.add(id, {
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || undefined,
      })
      const updated = await api.members.list(id)
      setMembers(updated)
      setMemberDialogOpen(false)
      setNewMemberName('')
      setNewMemberEmail('')
      toast.success('成员已添加')
    } catch (err) {
      toast.error('添加成员失败')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!id) return
    try {
      await api.members.remove(id, memberId)
      setMembers(members.filter((m) => m.id !== memberId))
      toast.success('成员已移除')
    } catch {
      toast.error('移除成员失败')
    }
  }

  const handleCopyInviteLink = async () => {
    if (!id) return
    try {
      const { token } = await api.members.createInvite(id)
      const link = `${window.location.origin}/virevo/join/${token}`
      await navigator.clipboard.writeText(link)
      toast.success('邀请链接已复制到剪贴板')
    } catch {
      toast.error('生成邀请链接失败')
    }
  }

  // ── Review actions ───────────────────────────────────────────

  const handleScore = async (epicId: string, score: number) => {
    // Use first member as current user (no auth system)
    const currentMemberId = members[0]?.id
    if (!currentMemberId) {
      toast.error('请先添加项目成员')
      return
    }
    try {
      const result = await api.epics.score(epicId, {
        projectMemberId: currentMemberId,
        score,
      })
      toast.success(`已打 ${score} 分`)
      // Refresh epics
      const updated = await api.epics.listByProject(id!)
      setEpics(updated)
    } catch {
      toast.error('打分失败')
    }
  }

  const handleAdmit = async (epicId: string) => {
    try {
      await api.epics.admit(epicId)
      toast.success('已准入 Backlog')
      const updated = await api.epics.listByProject(id!)
      setEpics(updated)
    } catch {
      toast.error('准入失败')
    }
  }

  const handleReject = async (epicId: string) => {
    try {
      await api.epics.reject(epicId)
      toast.success('已拒绝')
      setRejectDialogEpicId(null)
      const updated = await api.epics.listByProject(id!)
      setEpics(updated)
    } catch {
      toast.error('操作失败')
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

  const pendingEpics = epics.filter((e) => e.backlogStatus === 'pending')
  const admittedEpics = epics.filter((e) => e.backlogStatus === 'admitted')
  const rejectedEpics = epics.filter((e) => e.backlogStatus === 'rejected')

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
          <h1 className="mt-1 text-2xl font-semibold">{project?.name}</h1>
          <p className="text-muted-foreground text-sm">
            {project?.description || '暂无描述'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleStartSession} disabled={starting}>
            <PlusIcon className="size-4" />
            {starting ? '创建中...' : '开始讨论'}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!id || starting) return
              setStarting(true)
              try {
                const session = await api.sessions.create({
                  projectId: id,
                  title: `${project?.name || '需求讨论会'}`,
                })
                navigate(
                  `/virevo/sessions/${session.id}/live?projectId=${id}&nickname=${encodeURIComponent('创建者')}&role=host`,
                )
              } catch (err) {
                console.error('Failed to start live session:', err)
                setStarting(false)
              }
            }}
            disabled={starting}
          >
            <HandWavingIcon className="size-4" />
            {starting ? '创建中...' : '多人实时讨论'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sessions">
        <TabsList variant="line">
          <TabsTrigger value="sessions">
            <ChatCircleDotsIcon className="size-3.5" />
            讨论会 ({sessions.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <ListChecksIcon className="size-3.5" />
            评审 ({pendingEpics.length})
            {admittedEpics.length > 0 && (
              <Badge variant="default" className="ml-1 bg-green-600 px-1.5 py-0 text-[10px]">
                {admittedEpics.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="minutes">
            <ClockCounterClockwiseIcon className="size-3.5" />
            会议记录 ({minutes.length})
          </TabsTrigger>
          <TabsTrigger value="members">
            <UsersIcon className="size-3.5" />
            成员 ({members.length})
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
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium">{session.title}</p>
                        {session.lastMessagePreview && (
                          <p className="text-muted-foreground line-clamp-1 text-xs">
                            {session.lastMessagePreview}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          {session.lastMessageAt
                            ? new Date(session.lastMessageAt).toLocaleString('zh-CN')
                            : new Date(session.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusLabel(session.status)}
                        {session.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(
                                `/virevo/sessions/${session.id}/live?projectId=${id}&nickname=${encodeURIComponent('成员')}&role=member`,
                              )
                            }}
                          >
                            <ChatCircleDotsIcon className="size-3" />
                            进入
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Reviews */}
        <TabsContent value="reviews">
          {epics.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListChecksIcon className="text-muted-foreground mb-2 size-8" />
                <p className="text-muted-foreground text-sm">
                  暂无需求，请先在讨论会中提取需求
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Admitted */}
              {admittedEpics.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-medium text-green-600">
                    已准入 Backlog ({admittedEpics.length})
                  </h3>
                  {admittedEpics.map((epic) => (
                    <EpicCard
                      key={epic.id}
                      epic={epic}
                      members={members}
                      onScore={handleScore}
                      onAdmit={handleAdmit}
                      onReject={(eid) => setRejectDialogEpicId(eid)}
                    />
                  ))}
                </div>
              )}

              {/* Pending */}
              {pendingEpics.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    待评审 ({pendingEpics.length})
                  </h3>
                  {pendingEpics.map((epic) => (
                    <EpicCard
                      key={epic.id}
                      epic={epic}
                      members={members}
                      onScore={handleScore}
                      onAdmit={handleAdmit}
                      onReject={(eid) => setRejectDialogEpicId(eid)}
                    />
                  ))}
                </div>
              )}

              {/* Rejected */}
              {rejectedEpics.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    已拒绝 ({rejectedEpics.length})
                  </h3>
                  {rejectedEpics.map((epic) => (
                    <EpicCard
                      key={epic.id}
                      epic={epic}
                      members={members}
                      onScore={handleScore}
                      onAdmit={handleAdmit}
                      onReject={(eid) => setRejectDialogEpicId(eid)}
                    />
                  ))}
                </div>
              )}
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
                <Card
                  key={minute.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() =>
                    navigate(
                      `/virevo/brainstorm/minutes/${minute.id}?projectId=${id}`,
                    )
                  }
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {new Date(minute.sessionDate).toLocaleDateString('zh-CN')}
                      </p>
                      <span className="text-muted-foreground text-xs">
                        查看详情 →
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {stripMarkdown(minute.summary)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Members */}
        <TabsContent value="members">
          <div className="flex flex-col gap-4">
            {/* Actions */}
            <div className="flex gap-2">
              <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogTrigger
                  render={<Button variant="outline" size="sm" />}
                >
                  <PlusIcon className="size-3.5" />
                  添加成员
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加项目成员</DialogTitle>
                    <DialogDescription>
                      直接添加成员到项目中
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      <Label>昵称 *</Label>
                      <Input
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="输入昵称"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>邮箱 (可选)</Label>
                      <Input
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="输入邮箱"
                        type="email"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddMember}
                      disabled={!newMemberName.trim() || addingMember}
                    >
                      {addingMember ? '添加中...' : '添加'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyInviteLink}
              >
                <CopyIcon className="size-3.5" />
                复制邀请链接
              </Button>
            </div>

            {/* Member list */}
            {members.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <UsersIcon className="text-muted-foreground mb-2 size-8" />
                  <p className="text-muted-foreground text-sm">
                    暂无成员，点击上方按钮添加或分享邀请链接
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                          style={{
                            backgroundColor: getAvatarColor(member.name),
                          }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium">
                            {member.name}
                            {member.role === 'owner' && (
                              <span className="ml-2 text-muted-foreground text-xs">
                                创建者
                              </span>
                            )}
                          </p>
                          {member.email && (
                            <p className="text-muted-foreground text-xs">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </div>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <TrashIcon className="size-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reject confirmation dialog */}
      <AlertDialog
        open={!!rejectDialogEpicId}
        onOpenChange={(open) => !open && setRejectDialogEpicId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>拒绝需求</AlertDialogTitle>
            <AlertDialogDescription>
              确定要拒绝这个需求吗？拒绝后可以重新评审。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectDialogEpicId && handleReject(rejectDialogEpicId)}
            >
              确认拒绝
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
