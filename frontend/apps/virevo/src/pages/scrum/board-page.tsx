import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

export function BoardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sprint 看板</CardTitle>
          <CardDescription>任务看板 - 拖拽管理任务状态</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
