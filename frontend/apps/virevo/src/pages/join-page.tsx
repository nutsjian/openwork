import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  CheckCircleIcon,
} from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { api } from '@/lib/api'

export function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [projectName, setProjectName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    if (!token) return
    api.members
      .resolveInvite(token)
      .then((data) => {
        setProjectName(data.project?.name || '项目')
        setMemberName(data.member?.name || '')
        setProjectId(data.project?.id || '')
      })
      .catch(() => {
        setError('邀请链接无效或已过期')
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleGoToProject = () => {
    if (projectId) {
      navigate(`/virevo/brainstorm/projects/${projectId}`)
    }
  }

  if (loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground text-sm">验证邀请链接...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" onClick={() => navigate('/virevo')}>
          <ArrowLeftIcon className="size-4" />
          返回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="flex size-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 p-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircleIcon className="size-6 text-green-600" />
            </div>
            <h1 className="text-lg font-semibold">已加入项目</h1>
            <p className="text-muted-foreground text-center text-sm">
              <span className="font-medium text-foreground">{memberName}</span>
              {' '}，你已成功加入项目「
              {projectName}」
            </p>
          </div>

          <Button onClick={handleGoToProject} className="w-full">
            <EnvelopeIcon className="size-4" />
            进入项目
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => navigate('/virevo')}
          >
            <ArrowLeftIcon className="size-3.5" />
            返回首页
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
