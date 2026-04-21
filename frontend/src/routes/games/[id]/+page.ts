import type { PageLoad } from './$types'
import { api } from '$lib/api'
import { error } from '@sveltejs/kit'

export const load: PageLoad = async ({ params }) => {
  const { id } = params

  const [games, stateRes, scores] = await Promise.all([
    api.games(),
    api.getState(id),
    api.getScores(id),
  ])

  const manifest = games.find((g) => g.id === id)
  if (!manifest) throw error(404, `Game "${id}" not found`)

  return { manifest, savedState: stateRes.state, scores }
}
