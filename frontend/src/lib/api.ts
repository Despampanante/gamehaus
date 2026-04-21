import type { GameManifest } from '@shared/types'

export type User = { id: number; username: string; email: string }
export type ScoreEntry = { username: string; score: number; created_at: number }

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  me:         ()                        => req<User>('/api/me'),
  games:      ()                        => req<GameManifest[]>('/api/games'),
  getState:   (id: string)              => req<{ state: unknown }>(`/api/games/${id}/state`),
  putState:   (id: string, state: unknown) =>
    req<{ ok: boolean }>(`/api/games/${id}/state`, { method: 'PUT', ...json({ state }) }),
  getScores:  (id: string)              => req<ScoreEntry[]>(`/api/games/${id}/scores`),
  postScore:  (id: string, score: number) =>
    req<{ ok: boolean }>(`/api/games/${id}/scores`, { method: 'POST', ...json({ score }) }),
  logout:     ()                        =>
    req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
}
