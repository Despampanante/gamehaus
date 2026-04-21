<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Gamehaus</title></svelte:head>

<h1>Games</h1>

{#if data.games.length === 0}
  <p class="empty">No games available yet. Drop a folder into the games volume.</p>
{:else}
  <div class="grid">
    {#each data.games as game}
      <a href="/games/{game.id}" class="card">
        <h2>{game.name}</h2>
        <p>{game.description}</p>
        <span class="version">v{game.version}</span>
      </a>
    {/each}
  </div>
{/if}

<style>
  h1 { font-size: 1.6rem; font-weight: 700; margin: 0 0 1.5rem; }
  .empty { opacity: 0.5; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 1.25rem;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    background: rgba(255,255,255,0.03);
    transition: background 0.15s, border-color 0.15s;
  }
  .card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.2); }
  .card h2 { margin: 0; font-size: 1.1rem; }
  .card p { margin: 0; font-size: 0.85rem; opacity: 0.6; flex: 1; }
  .version { font-size: 0.75rem; opacity: 0.35; }
</style>
