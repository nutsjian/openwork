import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

export function DocDetailPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>文档详情</CardTitle>
          <CardDescription>查看项目的结构化文档</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
