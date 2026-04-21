import { createMiddleware } from 'hono/factory'
import db from '../db'

export type AuthUser = { id: number; username: string; email: string }

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const userHeader = process.env.AUTH_USER_HEADER ?? 'X-Forwarded-User'
  const emailHeader = process.env.AUTH_EMAIL_HEADER ?? 'X-Forwarded-Email'

  const username = c.req.header(userHeader)
  const email = c.req.header(emailHeader)

  if (!username || !email) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Auto-create or update user on first/changed identity
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
