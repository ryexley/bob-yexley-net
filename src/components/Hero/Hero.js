import React, { Component, Fragment } from "react"
import PropTypes from "prop-types"
import { ScrollHint } from "@cmp/ScrollHint"
import config from "../../../content/meta/config"

class Hero extends Component {
  state = {
    backgroundImageOffset: 0,
    titleOffset: 0,
    titleOpacity: 1,
    scrollHintOpacity: 1
  }

  componentDidMount = () => {
    if (window) {
      window.addEventListener("scroll", this.parallaxShift)
    }
  }

  componentWillUnmount = () => {
    if (window) {
      window.removeEventListener("scroll", this.parallaxShift)
    }
  }

  parallaxShift = () => {
    if (window) {
      const { pageYOffset } = window
      const calculatedTitleOpacity = ((100 - (pageYOffset * 0.085)) / 100)
      const calculatedScrollHintOpacity = ((100 - (pageYOffset * 0.15)) / 100)

      this.setState(() => ({
        backgroundImageOffset: (pageYOffset * 0.25),
        titleOffset: -(pageYOffset * 0.4),
        titleOpacity: (calculatedTitleOpacity > 0) ? calculatedTitleOpacity : 0,
        scrollHintOpacity: (calculatedScrollHintOpacity > 0) ? calculatedScrollHintOpacity : 0
      }))
    }
  }

  render() {
    const { scrollToContent, backgrounds, theme } = this.props
    const {
      backgroundImageOffset,
      titleOffset,
      titleOpacity,
      scrollHintOpacity
    } = this.state

    const titleStyle = {
      bottom: titleOffset,
      opacity: titleOpacity
    }

    return (
      <Fragment>
        <section
          className="hero"
          style={{ backgroundPositionY: backgroundImageOffset }}>
          <h1 style={titleStyle}>{ config.siteDescription }</h1>
          <ScrollHint
            className=""
            onScrollHintClick={scrollToContent}
            style={{ opacity: scrollHintOpacity }} />
        </section>

        <style jsx>{`
          .hero {
            align-items: center;
            background: ${theme.hero.background};
            background-image: url(${backgrounds.mobile});
            background-size: cover;
            color: ${theme.text.color.primary.inverse};
            display: flex;
            flex-flow: column nowrap;
            height: 100px;
            justify-content: center;
            min-height: 100vh;
            overflow: hidden;
            padding: ${theme.space.inset.l};
            padding-top: ${theme.header.height.homepage};
          }

          h1 {
            text-align: center;
            font-size: ${theme.hero.h1.size};
            margin: ${theme.space.stack.l};
            color: ${theme.hero.h1.color};
            line-height: ${theme.hero.h1.lineHeight};
            position: relative;
            text-remove-gap: both 0 "Cabin";
            text-shadow: 0px 2px 2px rgba(0, 0, 0, 0.5);

            :global(strong) {
              position: relative;

              &::after,
              &::before {
                content: "›";
                color: ${theme.text.color.attention};
                margin: 0 ${theme.space.xs} 0 0;
                text-shadow: 0 0 ${theme.space.s} ${theme.color.neutral.gray.k};
              }
              &::after {
                content: "‹";
                margin: 0 0 0 ${theme.space.xs};
              }
            }
          }

          @from-width tablet {
            .hero {
              background-image: url(${backgrounds.tablet});
            }

            h1 {
              max-width: 90%;
              font-size: ${`calc(${theme.hero.h1.size} * 1.3)`};
            }

            button {
              font-size: ${theme.font.size.l};
            }
          }

          @from-width desktop {
            .hero {
              background-image: url(${backgrounds.desktop});
              background-position: center center;
              background-size: cover;
            }

            h1 {
              max-width: 80%;
              font-size: ${`calc(${theme.hero.h1.size} * 1.5)`};
            }

            button {
              font-size: ${theme.font.size.xl};
            }
          }
        `}</style>
      </Fragment>
    )
  }
}

Hero.propTypes = {
  scrollToContent: PropTypes.func.isRequired,
  backgrounds: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired
}

export default Hero
