<script lang="ts">
  import type { LayoutData } from './$types'
  import { api } from '$lib/api'
  import { goto } from '$app/navigation'

  let { data, children }: { data: LayoutData; children: any } = $props()

  async function logout() {
    await api.logout()
    goto('/')
  }
</script>

<header>
  <a href="/" class="brand">Gamehaus</a>
  <nav>
    {#if data.user}
      <span class="user">{data.user.username}</span>
      <button onclick={logout}>Logout</button>
    {/if}
  </nav>
</header>

<main>
  {@render children()}
</main>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #0f0f13;
    color: #e8e8ec;
    min-height: 100vh;
  }
  :global(a) { color: inherit; text-decoration: none; }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .brand { font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em; }
  nav { display: flex; align-items: center; gap: 1rem; }
  .user { opacity: 0.6; font-size: 0.9rem; }
  button {
    background: none;
    border: 1px solid rgba(255,255,255,0.15);
    color: inherit;
    padding: 0.3rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  button:hover { background: rgba(255,255,255,0.07); }
  main { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
</style>
