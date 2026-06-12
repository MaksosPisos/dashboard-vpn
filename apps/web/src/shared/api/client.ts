const API_URL = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body != null && options.body !== '') {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message ?? 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

export const api = {
  get<T>(path: string, token?: string | null) {
    return request<T>(path, { method: 'GET' }, token)
  },
  post<T>(path: string, body?: unknown, token?: string | null) {
    return request<T>(
      path,
      { method: 'POST', body: body ? JSON.stringify(body) : undefined },
      token,
    )
  },
  patch<T>(path: string, body?: unknown, token?: string | null) {
    return request<T>(
      path,
      { method: 'PATCH', body: body ? JSON.stringify(body) : undefined },
      token,
    )
  },
  delete<T>(path: string, token?: string | null) {
    return request<T>(path, { method: 'DELETE' }, token)
  },
}
