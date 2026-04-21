import type { LayoutLoad } from './$types'

export const load: LayoutLoad = async ({ fetch }) => {
  try {
    const res = await fetch('/api/me')
    if (res.ok) return { user: await res.json() }
  } catch {}
  return { user: null }
}
