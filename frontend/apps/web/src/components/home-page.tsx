import { Button } from '@workspace/ui/components/button'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'
import { SectionCards } from '@/components/section-cards'
import data from '@/app/dashboard/data.json'

export function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 text-sm leading-loose shadow-sm">
              <div>
                <h1 className="font-medium text-lg">OpenWork ready!</h1>
                <p>AI-powered development workspace.</p>
                <p>
                  Start building with shared components and tools.
                </p>
                <Button className="mt-2">Get Started</Button>
              </div>
              <div className="text-muted-foreground font-mono text-xs">
                (Press <kbd>d</kbd> to toggle dark mode)
              </div>
            </div>
          </div>
          <SectionCards />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive />
          </div>
          <DataTable data={data} />
        </div>
      </div>
    </div>
  )
}
