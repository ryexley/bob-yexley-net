<script>
  import Card from './card'
  export let blips = []
</script>

<style>
  .blips {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  .blip {
    margin: 0 0 1.5rem 0;
  }

  :global(.blip .card) {
    background-color: var(--color-dark-40);
    color: var(--color-text-primary);
  }

  .blip > a {
    text-decoration: none;
  }

  .blip-content {
    font-size: 0.85rem;
    margin: 1rem;
  }

  :global(.blip-content > p:first-child) {
    margin-top: 0;
  }

  :global(.blip-content > p:last-child) {
    margin-bottom: 0;
  }

  .no-blips {}
</style>

{#if blips && blips.length}
  <ul class="blips">
    {#each blips as blip}
      <li class="blip">
        <a rel='prefetch' href="/blip/{blip.slug}">
          <Card>
            <div class="blip-content">
              {@html blip.body}
            </div>
          </Card>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <div class="no-blips">No blips</div>
{/if}
