import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { SidebarTrigger } from '@workspace/ui/components/sidebar'
import { useSubAppSearchOpen } from '@/lib/use-sub-app-search'

export function SiteHeader() {
  const { toggle } = useSubAppSearchOpen()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ms-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <h1 className="text-base font-medium">Workspace</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hidden h-8 gap-2 sm:flex"
            onClick={toggle}
          >
            <MagnifyingGlassIcon className="size-4" />
            <span>搜索子应用</span>
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sm:hidden"
            onClick={toggle}
          >
            <MagnifyingGlassIcon className="size-4" />
            <span className="sr-only">搜索子应用</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
