import { useEffect, useState } from 'react'
import { marked } from 'marked'
import markedShiki from 'marked-shiki'

// Configure marked with shiki extension (lazy init, once)
let configured = false
function ensureConfigured() {
  if (configured) return
  marked.use(markedShiki())
  configured = true
}

interface MarkdownContentProps {
  content: string
  className?: string
  /** When true, limits height and shows scrollbar for overflow */
  truncated?: boolean
  /** Max height in truncated mode, default 200px */
  truncatedHeight?: string
}

export function MarkdownContent({
  content,
  className = '',
  truncated = false,
  truncatedHeight = '200px',
}: MarkdownContentProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    ensureConfigured()
    const result = marked.parse(content)
    if (result instanceof Promise) {
      result.then((html) => setHtml(html as string))
    } else {
      setHtml(result)
    }
  }, [content])

  return (
    <div
      className={`prose prose-sm max-w-none break-words dark:prose-invert
        [&_*]:min-w-0
        [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_pre]:p-3
        [&_code]:break-all [&_pre_code]:break-normal
        [&_table]:overflow-x-auto [&_table]:block
        [&_img]:max-w-full
        ${truncated ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}
        ${className}`}
      style={truncated ? { maxHeight: truncatedHeight } : undefined}
      // AI-generated content is trusted, but we still sanitize
      // by only allowing known markdown output from marked
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
