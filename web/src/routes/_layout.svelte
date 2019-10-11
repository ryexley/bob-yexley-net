<script context="module">
  import { SanityService } from '../services/sanity'

  const sanity = new SanityService()

  export async function preload() {
    try {
      const settings = await sanity.fetchSiteSettings()

      return { settings }
    } catch (error) {
      return this.error(500, error)
    }
  }
</script>

<script>
	import Nav from '../components/Nav.svelte'

	export let segment
  export let settings
</script>

<style>
  header {
    align-items: center;
    color: var(--color-theme-primary);
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 0 auto;
    max-width: var(--bp-tablet-wide);
    padding: 2rem 0;
  }

  header a {
    text-decoration: none;
  }

  header h2 {
    font-size: 1rem;
  }

	main {
    display: flex;
    flex-direction: column;
		max-width: var(--bp-tablet-wide);
		background-color: var(--color-dark-0);
		margin: 0 auto;
	}
</style>

<svelte:head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,600,700|Raleway:100,200,300,400,500,600,700">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono">
</svelte:head>

<!-- <Nav {segment}/> -->
<header>
  <h1><a href="/">{settings.title}</a></h1>
  <h2>{settings.description}</h2>
</header>
<main>
	<slot></slot>
</main>
