import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSSEOptions {
  /** Called when a default (unnamed) SSE event is received */
  onMessage?: (data: string) => void
  /** Called when the SSE connection opens */
  onOpen?: () => void
  /** Called when an SSE error occurs */
  onError?: (error: Event) => void
  /** Called when the SSE connection closes */
  onClose?: () => void
}

export function useSSE(url: string | null, options?: UseSSEOptions) {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    if (!url) return

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onopen = () => {
      setConnected(true)
      options?.onOpen?.()
    }

    es.onmessage = (event) => {
      options?.onMessage?.(event.data)
    }

    es.onerror = () => {
      setConnected(false)
      options?.onError?.(new Event('error'))
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      setConnected(false)
      options?.onClose?.()
    }
  }, [url])

  return { connected, disconnect }
}
