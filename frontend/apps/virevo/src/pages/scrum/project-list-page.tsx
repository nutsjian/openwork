import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'

export function ScrumProjectListPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Scrum 项目</CardTitle>
          <CardDescription>管理 Scrum 项目和 Sprint</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
