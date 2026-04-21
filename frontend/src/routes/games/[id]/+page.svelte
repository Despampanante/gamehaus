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
  let saveStatus = $state<'idle' | 'saving' | 'saved'>('idle')

  const SAVE_INTERVAL_MS = 15_000
  const gameId = data.manifest.id
  
  // Cross-tab communication
  let bc: BroadcastChannel | null = null
  let lastLocalMove = Date.now() // Track when user last played

  async function saveState() {
    if (!mod) return
    try {
      const state = mod.getState()
      await api.putState(gameId, state)
      // Notify other tabs that state was saved
      bc?.postMessage({ type: 'state-saved', gameId })
      lastLocalMove = Date.now()
    } catch {}
  }

  let saveStatusTimer: ReturnType<typeof setTimeout>

  async function manualSave() {
    if (!mod || saveStatus === 'saving') return
    saveStatus = 'saving'
    lastLocalMove = Date.now() // Mark as active
    await saveState()
    saveStatus = 'saved'
    clearTimeout(saveStatusTimer)
    saveStatusTimer = setTimeout(() => (saveStatus = 'idle'), 2000)
  }

  async function submitScore() {
    if (!mod) return
    const score = mod.getScore()
    // Only submit if score > 0 (avoid cluttering leaderboard with 0s)
    if (score > 0) {
      try {
        await api.postScore(gameId, score)
        // Notify other tabs of new score
        bc?.postMessage({ type: 'score-submitted', gameId })
      } catch {}
    }
  }

  async function refreshScores() {
    try { scores = await api.getScores(gameId) } catch {}
  }

  let saveTimer: ReturnType<typeof setInterval>

  onMount(async () => {
    try {
      // Set up cross-tab communication
      bc = new BroadcastChannel(`gamehaus-game-${gameId}`)
      bc.onmessage = async (event) => {
        if (event.data.type === 'score-submitted') {
          await refreshScores()
        }
      }

      // Load game module from the entry point specified in the manifest
      const imported = await import(/* @vite-ignore */ data.manifest.entry)
      mod = (imported.default ?? imported) as GameModule
      mod.init(container, data.savedState)

      saveTimer = setInterval(saveState, SAVE_INTERVAL_MS)
    } catch (e) {
      loadError = 'Failed to load game module. Check the browser console.'
      console.error(e)
    }
  })

  // Save state before navigating away. Only submit score when the game actually
  // ended — prevents a leaderboard entry on every mid-game page reload.
  beforeNavigate(async () => {
    clearInterval(saveTimer)
    const state = mod?.getState() as Record<string, unknown> | undefined
    const ended = state?.over || state?.won
    await saveState()
    if (ended) {
      await submitScore()
      await refreshScores()
    }
    mod?.destroy?.()
  })

  onDestroy(() => {
    clearInterval(saveTimer)
    bc?.close()
    mod?.destroy?.()
  })
</script>

<svelte:head><title>{data.manifest.name} — Gamehaus</title></svelte:head>

<div class="shell">
  <div class="top-bar">
    <a href="/" class="back">← Games</a>
    <h1>{data.manifest.name}</h1>
    <span class="version">v{data.manifest.version}</span>
    <button
      class="save-btn"
      class:saved={saveStatus === 'saved'}
      onclick={manualSave}
      disabled={!mod || saveStatus === 'saving'}
    >
      {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
    </button>
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
  .save-btn {
    margin-left: auto;
    background: none;
    border: 1px solid rgba(255,255,255,0.15);
    color: inherit;
    padding: 0.3rem 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    min-width: 4.5rem;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .save-btn:hover:not(:disabled) { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.25); }
  .save-btn:disabled { opacity: 0.4; cursor: default; }
  .save-btn.saved { border-color: #4ade80; color: #4ade80; }

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
