import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

export function DocsProjectListPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>项目文档</CardTitle>
          <CardDescription>查看所有项目的文档收集状态</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
