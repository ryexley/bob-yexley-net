<script context="module">
  import { SanityService } from '../../services/sanity'

  const sanity = new SanityService()

  export async function preload({ params }) {
    const { created } = params

    try {
      const blip = await sanity.fetchBlip(created)

      return { blip }
    } catch (error) {
      return this.error(500, error)
    }
  }
</script>

<script>
  export let blip
</script>

<article>{@html blip.body}</article>
