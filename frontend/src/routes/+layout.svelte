<script lang="ts">
  import type { LayoutData } from './$types'
  let { data, children } = $props<{ data: LayoutData; children: any }>()
</script>

<nav>
  <a href="/">Gamehaus</a>
  {#if data.user}
    <span>{data.user.email}</span>
    <a href="/logout">Logout</a>
  {/if}
</nav>

{@render children()}
