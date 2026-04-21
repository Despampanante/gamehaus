import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { startWatcher } from './watcher'
import { purgeExpiredSessions } from './session'
import games from './routes/games'
import me from './routes/me'
import auth from './routes/auth'

await startWatcher()
purgeExpiredSessions()

const app = new Hono()

app.use('*', logger())

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', auth)
app.route('/api/games', games)
app.route('/api/me', me)

export default {
  port: 3001,
  fetch: app.fetch,
}
