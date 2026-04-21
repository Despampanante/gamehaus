<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { beforeNavigate } from '$app/navigation'
  import type { PageData } from './$types'
  import type { GameModule } from '@shared/types'
  import { api } from '$lib/api'
  import Leaderboard from '$lib/components/Leaderboard.svelte'

  let { data }: { data: PageData } = $props()

  let container: HTMLDivElement
  let mod: GameModule | null = null
  let loadError = $state<string | null>(null)
  let scores = $state(data.scores)

  const SAVE_INTERVAL_MS = 15_000

  async function saveState() {
    if (!mod) return
    try { await api.putState(data.manifest.id, mod.getState()) } catch {}
  }

  async function submitScore() {
    if (!mod) return
    try { await api.postScore(data.manifest.id, mod.getScore()) } catch {}
  }

  async function refreshScores() {
    try { scores = await api.getScores(data.manifest.id) } catch {}
  }

  let saveTimer: ReturnType<typeof setInterval>

  onMount(async () => {
    try {
      // Dynamic import — Vite/nginx proxy serves /games/:id/game.js from the volume
      const imported = await import(/* @vite-ignore */ `/games/${data.manifest.id}/game.js`)
      mod = (imported.default ?? imported) as GameModule
      mod.init(container, data.savedState)

      saveTimer = setInterval(saveState, SAVE_INTERVAL_MS)
    } catch (e) {
      loadError = 'Failed to load game module. Check the browser console.'
      console.error(e)
    }
  })

  // Save state + submit score before navigating away
  beforeNavigate(async () => {
    clearInterval(saveTimer)
    await Promise.all([saveState(), submitScore()])
    await refreshScores()
    mod?.destroy?.()
  })

  onDestroy(() => {
    clearInterval(saveTimer)
    mod?.destroy?.()
  })
</script>

<svelte:head><title>{data.manifest.name} — Gamehaus</title></svelte:head>

<div class="shell">
  <div class="top-bar">
    <a href="/" class="back">← Games</a>
    <h1>{data.manifest.name}</h1>
    <span class="version">v{data.manifest.version}</span>
  </div>

  <div class="layout">
    <div class="game-area">
      {#if loadError}
        <div class="error">{loadError}</div>
      {:else}
        <div class="game-container" bind:this={container}></div>
      {/if}
    </div>

    <aside>
      <Leaderboard {scores} />
    </aside>
  </div>
</div>

<style>
  .shell { display: flex; flex-direction: column; gap: 1.25rem; }

  .top-bar {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .back { opacity: 0.5; font-size: 0.9rem; }
  .back:hover { opacity: 1; }
  h1 { margin: 0; font-size: 1.4rem; }
  .version { opacity: 0.35; font-size: 0.8rem; }

  .layout {
    display: grid;
    grid-template-columns: 1fr 220px;
    gap: 2rem;
    align-items: start;
  }

  .game-area {
    min-height: 400px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0,0,0,0.3);
  }

  .game-container { width: 100%; height: 100%; }

  .error {
    padding: 2rem;
    color: #f87171;
    font-size: 0.9rem;
  }

  @media (max-width: 640px) {
    .layout { grid-template-columns: 1fr; }
  }
</style>
