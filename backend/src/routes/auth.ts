import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { randomBytes } from 'crypto'
import db from '../db'
import {
  SESSION_COOKIE,
  createSession,
  destroySession,
  getSession,
} from '../session'

// ── OIDC config ──────────────────────────────────────────────────────────────
// Set these env vars to activate the OIDC flow (OIDC_MODE=true also required).
//
//   OIDC_ISSUER        https://sso.example.com
//   OIDC_CLIENT_ID     <your client id>
//   OIDC_CLIENT_SECRET <your client secret>
//   OIDC_REDIRECT_URI  https://gamehaus.example.com/api/auth/callback

function oidcConfig() {
  const issuer = process.env.OIDC_ISSUER
  const clientId = process.env.OIDC_CLIENT_ID
  const clientSecret = process.env.OIDC_CLIENT_SECRET
  const redirectUri = process.env.OIDC_REDIRECT_URI

  if (!issuer || !clientId || !clientSecret || !redirectUri) return null
  return { issuer, clientId, clientSecret, redirectUri }
}

const auth = new Hono()

// GET /api/auth/login — redirect to OIDC provider
auth.get('/login', (c) => {
  if (process.env.OIDC_MODE !== 'true') {
    return c.json({ error: 'OIDC_MODE is not enabled' }, 400)
  }

  const cfg = oidcConfig()
  if (!cfg) {
    return c.json(
      { error: 'OIDC env vars not configured (see routes/auth.ts)' },
      501
    )
  }

  const state = randomBytes(16).toString('hex')
  setCookie(c, 'oidc_state', state, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 60 * 10,
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: 'openid profile email',
    state,
  })

  // TODO: fetch /.well-known/openid-configuration and use authorization_endpoint
  return c.redirect(`${cfg.issuer}/authorize?${params}`)
})

// GET /api/auth/callback — exchange code, create session
auth.get('/callback', async (c) => {
  if (process.env.OIDC_MODE !== 'true') {
    return c.json({ error: 'OIDC_MODE is not enabled' }, 400)
  }

  const cfg = oidcConfig()
  if (!cfg) {
    return c.json({ error: 'OIDC env vars not configured' }, 501)
  }

  const { code, state } = c.req.query()
  const storedState = getCookie(c, 'oidc_state')

  if (!code || !state || state !== storedState) {
    return c.json({ error: 'Invalid OAuth state' }, 400)
  }

  deleteCookie(c, 'oidc_state', { path: '/' })

  // TODO: fetch /.well-known/openid-configuration and use token_endpoint
  const tokenRes = await fetch(`${cfg.issuer}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    return c.json({ error: 'Token exchange failed' }, 502)
  }

  const tokens = await tokenRes.json<{ access_token: string; id_token?: string }>()

  // TODO: validate id_token signature via JWKS; for now trust userinfo endpoint
  const userRes = await fetch(`${cfg.issuer}/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    return c.json({ error: 'Userinfo fetch failed' }, 502)
  }

  const info = await userRes.json<{ sub: string; preferred_username?: string; email: string }>()

  db.run(
    `INSERT INTO users (username, email) VALUES (?, ?)
     ON CONFLICT(email) DO UPDATE SET username = excluded.username`,
    [info.preferred_username ?? info.sub, info.email]
  )

  const user = db
    .query<{ id: number }, [string]>(
      `SELECT id FROM users WHERE email = ?`
    )
    .get(info.email)!

  const token = createSession(user.id)

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return c.redirect('/')
})

// POST /api/auth/logout — destroy session cookie
auth.post('/logout', (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) destroySession(token)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

export default auth
