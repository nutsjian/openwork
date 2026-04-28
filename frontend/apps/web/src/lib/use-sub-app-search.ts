import { useCallback, useEffect, useRef, useState } from 'react'

type Listener = () => void

const listeners = new Set<Listener>()

export function useSubAppSearchOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const listener = () => setOpen((o) => !o)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const toggle = useCallback(() => {
    listeners.forEach((l) => l())
  }, [])

  return { open, setOpen, toggle }
}

export function useSubAppSearchShortcut() {
  const toggleRef = useRef<() => void>(() => {})

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggleRef.current()
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return toggleRef
}
