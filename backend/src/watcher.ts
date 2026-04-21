import { readdir } from 'fs/promises'
import { watch } from 'fs'
import { join } from 'path'
import type { GameManifest } from '../../shared/types'

const GAMES_DIR = process.env.GAMES_DIR ?? './games'

let manifests = new Map<string, GameManifest>()

async function loadManifests() {
  const entries = await readdir(GAMES_DIR, { withFileTypes: true })
  const next = new Map<string, GameManifest>()

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const manifest = await Bun.file(
        join(GAMES_DIR, entry.name, 'manifest.json')
      ).json<GameManifest>()
      // Ensure entry field is set to the asset path
      manifest.entry = `/games/${manifest.id}/game.js`
      next.set(manifest.id, manifest)
    } catch {
      // directory has no valid manifest.json — skip silently
    }
  }

  manifests = next
  console.log(`[watcher] loaded ${manifests.size} game(s)`)
}

export function getManifests(): GameManifest[] {
  return [...manifests.values()]
}

export function getManifest(id: string): GameManifest | undefined {
  return manifests.get(id)
}

export async function startWatcher() {
  await loadManifests()

  watch(GAMES_DIR, { recursive: true }, async (_event, filename) => {
    if (filename?.endsWith('manifest.json')) {
      await loadManifests()
    }
  })
}
