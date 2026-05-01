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
    create: (data: {
      projectId: string
      title?: string
      creatorMemberId?: string
    }) =>
      request<any>('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) => request<any>(`/sessions/${id}`),
    join: (
      sessionId: string,
      data: { projectMemberId: string; nickname: string },
    ) =>
      request<{ participantId: string }>(`/sessions/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    markRead: (sessionId: string, participantId: string) =>
      request<{ success: boolean }>(`/sessions/${sessionId}/read`, {
        method: 'POST',
        body: JSON.stringify({ participantId }),
      }),
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

  epics: {
    listByProject: (projectId: string) =>
      request<any[]>(`/projects/${projectId}/epics`),
    score: (epicId: string, data: { projectMemberId: string; score: number; comment?: string }) =>
      request<{ averageScore: number; reviewCount: number }>(`/epics/${epicId}/score`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    reviews: (epicId: string) =>
      request<any[]>(`/epics/${epicId}/reviews`),
    admit: (epicId: string) =>
      request<{ success: boolean }>(`/epics/${epicId}/admit`, { method: 'POST' }),
    reject: (epicId: string) =>
      request<{ success: boolean }>(`/epics/${epicId}/reject`, { method: 'POST' }),
    backlog: (projectId: string) =>
      request<any[]>(`/projects/${projectId}/backlog`),
  },

  members: {
    list: (projectId: string) =>
      request<any[]>(`/projects/${projectId}/members`),
    add: (projectId: string, data: { name: string; email?: string }) =>
      request<any>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    remove: (projectId: string, memberId: string) =>
      request<void>(`/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
      }),
    createInvite: (projectId: string) =>
      request<{ token: string }>(`/projects/${projectId}/invite`, {
        method: 'POST',
      }),
    resolveInvite: (token: string) =>
      request<{ token: string; member: any; project: any }>(
        `/join/${token}`,
      ),
  },
}

// ── WebSocket ────────────────────────────────────────────────────

export function createSessionWebSocket(params: {
  sessionId: string
  nickname: string
  role: 'host' | 'member'
}) {
  const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/api/v1/ws?sessionId=${params.sessionId}&nickname=${encodeURIComponent(params.nickname)}&role=${params.role}`
  return new WebSocket(wsUrl)
}

// ── Avatar color ─────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#EA580C',
  '#CA8A04', '#16A34A', '#0891B2', '#2563EB', '#9333EA',
]

export function getAvatarColor(nickname: string): string {
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
