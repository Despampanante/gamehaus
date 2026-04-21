import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { getManifests, getManifest } from '../watcher'
import db from '../db'

const games = new Hono()

games.use('*', authMiddleware)

games.get('/', (c) => c.json(getManifests()))

games.get('/:id', (c) => {
  const gameId = c.req.param('id')
  const manifest = getManifest(gameId)
  
  if (!manifest) {
    return c.json({ error: 'Game not found' }, 404)
  }
  
  return c.json(manifest)
})

games.get('/:id/state', (c) => {
  const user = c.get('user')
  const gameId = c.req.param('id')

  const row = db
    .query<{ state: string }, [number, string]>(
      `SELECT state FROM game_states WHERE user_id = ? AND game_id = ?`
    )
    .get(user.id, gameId)

  return c.json({ state: row ? JSON.parse(row.state) : null })
})

games.put('/:id/state', async (c) => {
  const user = c.get('user')
  const gameId = c.req.param('id')
  const body = await c.req.json<{ state: unknown }>()

  db.run(
    `INSERT INTO game_states (user_id, game_id, state, updated_at)
     VALUES (?, ?, ?, unixepoch())
     ON CONFLICT(user_id, game_id) DO UPDATE SET
       state      = excluded.state,
       updated_at = excluded.updated_at`,
    [user.id, gameId, JSON.stringify(body.state)]
  )

  return c.json({ ok: true })
})

games.get('/:id/scores', (c) => {
  const gameId = c.req.param('id')

  const rows = db
    .query<{ username: string; score: number; created_at: number }, [string]>(
      `SELECT u.username, s.score, s.created_at
       FROM scores s
       JOIN users u ON u.id = s.user_id
       WHERE s.game_id = ?
       ORDER BY s.score DESC
       LIMIT 10`
    )
    .all(gameId)

  return c.json(rows)
})

games.post('/:id/scores', async (c) => {
  const user = c.get('user')
  const gameId = c.req.param('id')
  const body = await c.req.json<{ score: unknown }>()

  if (typeof body.score !== 'number' || body.score < 0) {
    return c.json({ error: 'score must be a non-negative number' }, 400)
  }

  if (!getManifest(gameId)) {
    return c.json({ error: 'unknown game' }, 404)
  }

  db.run(
    `INSERT INTO scores (user_id, game_id, score) VALUES (?, ?, ?)`,
    [user.id, gameId, body.score]
  )

  return c.json({ ok: true })
})

export default games
