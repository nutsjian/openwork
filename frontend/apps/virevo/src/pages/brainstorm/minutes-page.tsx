import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { api } from '@/lib/api'

export function MinutesPage() {
  const { id } = useParams<{ id: string }>()
  const [minutes, setMinutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.minutes
      .list(id)
      .then(setMinutes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="p-6 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">会议记录</h1>
        <p className="text-muted-foreground text-sm">
          查看所有讨论会的会议纪要
        </p>
      </div>

      {minutes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">暂无会议记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {minutes.map((minute: any) => (
            <Card key={minute.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {new Date(minute.sessionDate).toLocaleDateString('zh-CN')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {minute.summary}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
