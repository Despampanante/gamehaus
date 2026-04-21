import { randomBytes } from 'crypto'
import db from './db'

export const SESSION_COOKIE = 'gh_session'
const TTL = 60 * 60 * 24 * 7 // 7 days in seconds

export type SessionUser = { userId: number; username: string; email: string }

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('hex')
  const expires = Math.floor(Date.now() / 1000) + TTL

  db.run(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
    [token, userId, expires]
  )

  return token
}

export function getSession(token: string): SessionUser | null {
  const row = db
    .query<
      { user_id: number; username: string; email: string; expires_at: number },
      [string]
    >(
      `SELECT s.user_id, u.username, u.email, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token)

  if (!row) return null

  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    db.run(`DELETE FROM sessions WHERE token = ?`, [token])
    return null
  }

  return { userId: row.user_id, username: row.username, email: row.email }
}

export function destroySession(token: string) {
  db.run(`DELETE FROM sessions WHERE token = ?`, [token])
}

// Periodic cleanup — called once at startup so expired rows don't pile up
export function purgeExpiredSessions() {
  db.run(`DELETE FROM sessions WHERE expires_at < unixepoch()`)
}
