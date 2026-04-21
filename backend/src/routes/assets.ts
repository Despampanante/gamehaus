import { Hono } from 'hono'

const GAMES_DIR = process.env.GAMES_DIR ?? './games'

const assets = new Hono()

// Serves game JS/JSON files with no auth — public static assets.
// Path-traversal and extension are validated before any FS access.
assets.get('/:gameId/:file', async (c) => {
  const gameId = c.req.param('gameId')
  const file = c.req.param('file')

  if (!/^[\w-]+$/.test(gameId) || !/^[\w.-]+\.(js|json)$/.test(file)) {
    return c.json({ error: 'Not found' }, 404)
  }

  const bunFile = Bun.file(`${GAMES_DIR}/${gameId}/${file}`)
  if (!(await bunFile.exists())) return c.json({ error: 'Not found' }, 404)

  const contentType = file.endsWith('.js')
    ? 'application/javascript'
    : 'application/json'

  return new Response(bunFile.stream(), { headers: { 'Content-Type': contentType } })
})

export default assets
