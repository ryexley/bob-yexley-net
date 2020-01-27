/*
|| Implement Gatsby's Browser APIs in this file.
|| See: https://www.gatsbyjs.org/docs/browser-apis/
*/

function openExternalLinksInNewWindow() {
  if (window) {
    const host = window.location.hostname
    const externalLinks = [].slice.call(document.links).filter(l => !l.href.includes(host))

    externalLinks.forEach(link => {
      link.setAttribute("target", "_blank")
      link.setAttribute("rel", "noopener noreferrer")
      link.setAttribute("title", "This is an external link, and will open in a new window")
    })
  }
}

function renderDomUpdates() {
  openExternalLinksInNewWindow()
}

export function onInitialClientRender() {
  renderDomUpdates()
}

export function onRouteUpdate({ location }) {
  renderDomUpdates()
}
