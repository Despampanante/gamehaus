import type { PageLoad } from './$types'
import { api } from '$lib/api'

export const load: PageLoad = async () => {
  const games = await api.games()
  return { games }
}
