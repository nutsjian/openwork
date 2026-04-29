import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon } from '@phosphor-icons/react'
import {
  Button,
} from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { api } from '@/lib/api'

export function ProjectListPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    api.projects.list().then(setProjects).catch(console.error)
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    const project = await api.projects.create({ name, description })
    setProjects((prev) => [...prev, project])
    setOpen(false)
    setName('')
    setDescription('')
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">需求讨论</h1>
          <p className="text-muted-foreground text-sm">
            管理和创建 AI 辅助的需求讨论项目
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <PlusIcon className="size-4" />
            新建项目
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新项目</DialogTitle>
              <DialogDescription>
                创建一个需求讨论项目，开始 AI 辅助的需求梳理
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">项目名称</label>
                <Input
                  placeholder="例如：用户管理系统重构"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">项目描述</label>
                <Input
                  placeholder="简要描述项目背景和目标"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button onClick={handleCreate} disabled={!name.trim()}>
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">还没有项目，点击上方按钮创建</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/virevo/brainstorm/projects/${project.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || '暂无描述'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-muted-foreground text-xs">
                    {project.status === 'brainstorming'
                      ? '讨论中'
                      : project.status}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
