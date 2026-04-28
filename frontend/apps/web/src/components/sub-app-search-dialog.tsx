import { useNavigate } from 'react-router-dom'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@workspace/ui/components/command'
import { subApps } from '@/lib/sub-apps-registry'
import { useSubAppSearchOpen, useSubAppSearchShortcut } from '@/lib/use-sub-app-search'

export function SubAppSearchDialog() {
  const { open, setOpen } = useSubAppSearchOpen()
  const navigate = useNavigate()

  useSubAppSearchShortcut()

  const handleSelect = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="搜索子应用..." />
        <CommandList>
          <CommandEmpty>未找到子应用</CommandEmpty>
          <CommandGroup heading="子应用">
            {subApps.map((app) => (
              <CommandItem
                key={app.id}
                value={`${app.name} ${app.id}`}
                onSelect={() => handleSelect(app.path)}
              >
                <app.icon className="size-4" />
                <div className="flex flex-col">
                  <span>{app.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {app.description}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
