<script context="module">
  import { SanityService } from '../services/sanity'
  import SapperLogo from '../components/sapper-logo'
  import Blips from '../components/blips.svelte'

  const sanity = new SanityService()

  export async function preload() {
    try {
      const blips = await sanity.fetchBlips()

      return { blips }
    } catch (error) {
      return this.error(500, error)
    }
  }
</script>

<script>
  export let blips = []
</script>

<style>
</style>

<svelte:head>
	<title>bob.yexley.net</title>
</svelte:head>

<Blips blips={blips} />
