import type { LayoutLoad } from './$types'
import { api } from '$lib/api'

// Disable SSR — this is a fully client-side SPA via adapter-static
export const ssr = false
export const prerender = false

export const load: LayoutLoad = async () => {
  try {
    const user = await api.me()
    return { user }
  } catch {
    return { user: null }
  }
}
