import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

export function ProjectDetailPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>项目详情</CardTitle>
          <CardDescription>查看项目详情、讨论会、会议记录和评审</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
