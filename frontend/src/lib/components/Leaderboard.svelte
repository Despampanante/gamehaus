<script lang="ts">
  import type { ScoreEntry } from '$lib/api'

  let { scores }: { scores: ScoreEntry[] } = $props()

  function fmt(ts: number) {
    return new Date(ts * 1000).toLocaleDateString()
  }
</script>

<div class="leaderboard">
  <h3>Leaderboard</h3>
  {#if scores.length === 0}
    <p class="empty">No scores yet — be the first!</p>
  {:else}
    <ol>
      {#each scores as entry, i}
        <li>
          <span class="rank">#{i + 1}</span>
          <span class="name">{entry.username}</span>
          <span class="score">{entry.score.toLocaleString()}</span>
          <span class="date">{fmt(entry.created_at)}</span>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .leaderboard { margin-top: 1.5rem; }
  h3 { margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
  ol { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
  li { display: grid; grid-template-columns: 2rem 1fr auto auto; gap: 0.75rem; align-items: center; padding: 0.4rem 0.6rem; border-radius: 6px; background: rgba(255,255,255,0.04); font-size: 0.9rem; }
  .rank { opacity: 0.4; font-variant-numeric: tabular-nums; }
  .score { font-variant-numeric: tabular-nums; font-weight: 600; }
  .date { opacity: 0.4; font-size: 0.8rem; }
  .empty { opacity: 0.5; font-size: 0.9rem; }
</style>
