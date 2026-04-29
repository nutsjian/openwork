const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error: ${res.status}`)
  }

  return res.json()
}

// ── Projects ─────────────────────────────────────────────────────

export const api = {
  projects: {
    list: () => request<any[]>('/projects'),
    get: (id: string) => request<any>(`/projects/${id}`),
    create: (data: { name: string; description?: string }) =>
      request<any>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<any>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  sessions: {
    listByProject: (projectId: string) =>
      request<any[]>(
        `/sessions?projectId=${projectId}`,
      ),
    create: (data: { projectId: string; title?: string }) =>
      request<any>('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) => request<any>(`/sessions/${id}`),
    sendMessage: (id: string, content: string) =>
      request<any>(`/sessions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    skip: (id: string) =>
      request<any>(`/sessions/${id}/skip`, { method: 'POST' }),
    end: (id: string) =>
      request<any>(`/sessions/${id}/end`, { method: 'POST' }),
    extract: (id: string) =>
      request<{ epics: any[] }>(`/sessions/${id}/extract`, {
        method: 'POST',
      }),
  },

  minutes: {
    listByProject: (projectId: string) =>
      request<any[]>(`/projects/${projectId}/minutes`),
    get: (id: string) => request<any>(`/minutes/${id}`),
  },
}
