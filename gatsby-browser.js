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

/*
function renderImageCaptions() {
  const contentImages = document.querySelectorAll(".bodytext img")
  // console.log({ contentImages })
  contentImages.forEach(image => {
    console.log({ image })
    const imageAlt = image.getAttribute("alt")
    const imageTitle = image.getAttribute("title")
    const div = document.createElement("div")
    const figure = document.createElement("figure")
    const figCaption = document.createElement("figcaption")

    figCaption.innerText = (imageTitle || imageAlt)
    div.appendChild(image)
    figure.appendChild(div)
    figure.appendChild(figCaption)
    console.log('img parent?', figure)
    // image.parentElement.innerHTML = figure
  })
}
*/

function renderDomUpdates() {
  openExternalLinksInNewWindow()
}

export function onInitialClientRender() {
  renderDomUpdates()
}

export function onRouteUpdate({ location }) {
  renderDomUpdates()
}
