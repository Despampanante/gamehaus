import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'

const me = new Hono()

me.use('*', authMiddleware)

me.get('/', (c) => c.json(c.get('user')))

export default me
