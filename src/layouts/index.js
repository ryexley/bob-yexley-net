import "typeface-open-sans"
import FontFaceObserver from "fontfaceobserver"
import PropTypes from "prop-types"
import React from "react"
import {graphql, StaticQuery} from "gatsby"

import {getScreenWidth, timeoutThrottlerHandler} from "../utils/helpers"
import Footer from "../components/Footer/"
import Header from "../components/Header"

export const ThemeContext = React.createContext(null)
export const ScreenWidthContext = React.createContext(0)
export const FontLoadedContext = React.createContext(false)

import themeObjectFromYaml from "../theme/theme.yaml"

class Layout extends React.Component {
  constructor() {
    super()

    this.state = {
      font400loaded: false,
      font600loaded: false,
      screenWidth: 0,
      headerMinimized: false,
      theme: themeObjectFromYaml
    }

    if (typeof window !== "undefined") {
      this.loadFont("font400", "Cabin", 400)
      this.loadFont("font600", "Cabin", 600)
    }
  }

  timeouts = {};

  componentDidMount() {
    this.setState({
      screenWidth: getScreenWidth()
    })
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.resizeThrottler, false)
    }
  }

  resizeThrottler = () => {
    return timeoutThrottlerHandler(
      this.timeouts,
      "resize",
      100,
      this.resizeHandler
    )
  };

  resizeHandler = () => {
    this.setState({screenWidth: getScreenWidth()})
  };

  isHomePage = () => {
    if (this.props.location.pathname === "/") {
      return true
    }

    return false
  };

  loadFont = (name, family, weight) => {
    const font = new FontFaceObserver(family, {
      weight
    })

    font.load(null, 10000).then(
      () => {
        this.setState({[`${name}loaded`]: true})
      },
      () => {
        console.log(`${name} is not available`)
      }
    )
  };

  renderStyle = () => <style jsx="true">{`
    main {
      min-height: 80vh;
    }
  `}</style>

  renderGlobalStyle = () => <style jsx="true">{`
    html {
      box-sizing: border-box;
    }

    *,
    *:after,
    *:before {
      box-sizing: inherit;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: ${
        this.state.font400loaded ?
          "Cabin, sans-serif;" :
          "Helvetica, Arial, sans-serif;"
        };
    }

    h1,
    h2,
    h3 {
      font-weight: ${this.state.font600loaded ? 600 : 400};
      line-height: 1.1;
      margin: 0;
    }

    p {
      margin: 0;
    }

    strong {
      font-weight: ${this.state.font600loaded ? 600 : 400};
    }

    a {
      border-bottom: 1px solid ${this.state.theme.color.brand.primary};
      color: #666;
      text-decoration: none;
      transition: all 250ms ease-in-out;
    }

    a:hover {
      border-bottom: 1px solid transparent;
    }

    a[href^="http"] {
      margin: 0 0.1rem 0 0;
    }

    a[href^="http"]:after {
      content: "⧉";
      display: inline-block;
      font-size: 0.85rem;
      margin: 0 0 0 0.25rem;
      position: relative;
      top: -0.25rem;
      transform: rotate(90deg);
      vertical-align: baseline;
      transition: all 250ms ease-in-out;
    }

    a[href^="http"]:hover:after {
      transform: rotate(90deg) scale(1.2);
    }

    main {
      width: auto;
      display: block;
    }

    hr {
      background: transparent;
      border-top: 0;
      border-left: 0;
      border-right: 0;
      border-bottom: 1px solid #eee;
      color: transparent;
      margin: 2rem 0;
    }

    /*
    hr:after {
      background: #fff;
      bottom: -1.65625rem;
      color: #eee;
      content: "\\272A";
      display: block;
      font-size: 1.5rem;
      height: 1.625rem;
      padding: 5px 0 0 4px;
      position: absolute;
      left: 50%;
      width: 1.625rem;
    }
    */
  `}</style>

  render() {
    return (
      <StaticQuery
        query={graphql`
          query LayoutQuery {
            pages: allMarkdownRemark(
              filter: { fileAbsolutePath: {
                regex: "//pages//"
              },
              fields: {
                prefix: {
                  regex: "/^\\d+$/"
                }
              }
            }
              sort: { fields: [fields___prefix], order: ASC }
            ) {
              edges {
                node {
                  fields {
                    slug
                    prefix
                  }
                  frontmatter {
                    title
                    menuTitle
                  }
                }
              }
            }
            footnote: markdownRemark(fileAbsolutePath: {
              regex: "/footnote/"
            }) {
              id
              html
            }
          }
        `}

        render={data => {
          const {children} = this.props
          const {
            footnote: {html: footnoteHTML},
            pages: {edges: pages}
          } = data

          return (
            <ThemeContext.Provider value={this.state.theme}>
              <FontLoadedContext.Provider value={this.state.font400loaded}>
                <ScreenWidthContext.Provider value={this.state.screenWidth}>
                  <React.Fragment>
                    <Header
                      path={this.props.location.pathname}
                      pages={pages}
                      theme={this.state.theme} />
                    <main>{children}</main>
                    <Footer html={footnoteHTML} theme={this.state.theme} />
                    { this.renderStyle() }
                    { this.renderGlobalStyle() }
                  </React.Fragment>
                </ScreenWidthContext.Provider>
              </FontLoadedContext.Provider>
            </ThemeContext.Provider>
          )
        }}
      />
    )
  }
}

Layout.propTypes = {
  children: PropTypes.object.isRequired,
  data: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired
}

export default Layout
