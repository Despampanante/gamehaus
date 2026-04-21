import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import db from '../db'
import { SESSION_COOKIE, getSession } from '../session'

export type AuthUser = { id: number; username: string; email: string }

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

// ── Forward-auth path (Caddy / PocketID) ─────────────────────────────────────
// Caddy handles OIDC and injects trusted headers before the request reaches us.
// Nothing to verify — if the headers are present, we trust the upstream proxy.
function forwardAuthMiddleware() {
  return createMiddleware(async (c, next) => {
    const userHeader = process.env.AUTH_USER_HEADER ?? 'X-Forwarded-User'
    const emailHeader = process.env.AUTH_EMAIL_HEADER ?? 'X-Forwarded-Email'

    const username = c.req.header(userHeader)
    const email = c.req.header(emailHeader)

    if (!username || !email) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    db.run(
      `INSERT INTO users (username, email) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET username = excluded.username`,
      [username, email]
    )

    const user = db
      .query<AuthUser, [string]>(
        `SELECT id, username, email FROM users WHERE email = ?`
      )
      .get(email)!

    c.set('user', user)
    await next()
  })
}

// ── Session-auth path (OIDC mode) ─────────────────────────────────────────────
// The backend handles the OIDC flow itself (/api/auth/login → /api/auth/callback)
// and issues a session cookie. This middleware reads that cookie.
function sessionAuthMiddleware() {
  return createMiddleware(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const session = getSession(token)

    if (!session) {
      return c.json({ error: 'Session expired' }, 401)
    }

    c.set('user', {
      id: session.userId,
      username: session.username,
      email: session.email,
    })

    await next()
  })
}

// ── Exported middleware — routes never need to know which mode is active ──────
export const authMiddleware =
  process.env.OIDC_MODE === 'true'
    ? sessionAuthMiddleware()
    : forwardAuthMiddleware()
