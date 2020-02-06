import React, { Component, Fragment } from "react"
import PropTypes from "prop-types"

class Hero extends Component {
  state = {
    backgroundImageOffset: 0,
    titleOffset: 0,
    titleOpacity: 1
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
      const calculatedOpacity = ((100 - (pageYOffset * 0.25)) / 100)

      this.setState(() => ({
        backgroundImageOffset: (pageYOffset * 0.25),
        titleOffset: -(pageYOffset * 0.35),
        titleOpacity: (calculatedOpacity > 0) ? calculatedOpacity : 0
      }))
    }
  }

  render() {
    const {
      post: {
        heroImage,
        frontmatter: {
          title
        }
      },
      theme
    } = this.props

    const {
      backgroundImageOffset,
      titleOffset,
      titleOpacity
    } = this.state

    const titleStyle = {
      bottom: titleOffset,
      opacity: titleOpacity
    }

    return (
      <Fragment>
        <header style={{ backgroundPositionY: backgroundImageOffset }}>
          <h1 className="post-hero-title" style={titleStyle}>{title}</h1>
        </header>

        <style jsx>{`
          header {
            align-items: center;
            background-image: url(${heroImage.postCoverMobile});
            background-size: cover;
            display: flex;
            flex-flow: column nowrap;
            justify-content: center;
            margin-top: -${theme.header.height.default};
            min-height: 50vh;
            overflow: hidden;
            padding-top: ${theme.header.height.default};
          }

          h1 {
            font-size: ${theme.font.size.xxl};
            position: relative;
            text-align: center;
            text-shadow: 0px 2px 2px rgba(0, 0, 0, 0.5);
          }

          .post-hero-title {
            color: ${theme.color.neutral.white};
          }

          @from-width tablet {
            header {
              background-image: url(${heroImage.postCoverTablet});
            }

            h1 {
              font-size: ${`calc(${theme.font.size.xl} * 1.2)`};
              margin: 0 5rem;
            }
          }

          @from-width desktop {
            header {
              background-image: url(${heroImage.postCoverDesktop});
            }

            h1 {
              font-size: ${`calc(${theme.font.size.xl} * 1.4)`};
              margin: 0 10rem;
              margin-top: 2.5rem;
            }
          }
        `}</style>
      </Fragment>
    )
  }
}

Hero.propTypes = {
  post: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired
}

export default Hero
