import { Hono } from 'hono'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())

app.get('/api/health', (c) => c.json({ ok: true }))

// Routes will be wired in Step 2
// import games from './routes/games'
// import me from './routes/me'
// app.route('/api/games', games)
// app.route('/api/me', me)

export default {
  port: 3001,
  fetch: app.fetch,
}
