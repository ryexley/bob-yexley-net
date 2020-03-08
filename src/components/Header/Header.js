import { Link } from "gatsby"
import PropTypes from "prop-types"
import React, { Component, Fragment } from "react"
import classnames from "classnames"
import VisibilitySensor from "react-visibility-sensor"

import { ScreenWidthContext, FontLoadedContext } from "../../layouts"
import config from "../../../content/meta/config"
import Menu from "../Menu"

import avatar from "../../images/jpg/avatar.jpg"

class Header extends Component {
  state = { fixed: false }

  visibilitySensorChange = val => {
    if (val) {
      this.setState({ fixed: false })
    } else {
      this.setState({ fixed: true })
    }
  }

  render() {
    const { pages, path, theme } = this.props
    const { fixed } = this.state

    const {
      gravatarImgMd5,
      siteTitle,
      headerTitle,
      headerSubTitle
    } = config

    const logoImageSource = gravatarImgMd5 == "" ? avatar : gravatarImgMd5

    const classes = classnames("header", {
      fixed: this.state.fixed,
      homepage: this.props.path === "/",
      resume: this.props.path === "/resume",
      subpage: this.props.path !== "/"
    })

    return (
      <Fragment>
        <header className={classes}>
          <Link to="/" className="logoType">
            <div className="logo">
              <img
                src={logoImageSource}
                alt={siteTitle} />
            </div>
            <div className="type">
              <h1>{headerTitle}</h1>
              <h2>{headerSubTitle}</h2>
            </div>
          </Link>
          <FontLoadedContext.Consumer>
            {loaded => (
              <ScreenWidthContext.Consumer>
                {width => (
                  <Menu
                    path={path}
                    fixed={fixed}
                    screenWidth={width}
                    fontLoaded={loaded}
                    pages={pages}
                    theme={theme}
                  />
                )}
              </ScreenWidthContext.Consumer>
            )}
          </FontLoadedContext.Consumer>
        </header>
        <VisibilitySensor onChange={this.visibilitySensorChange}>
          <div className="sensor" />
        </VisibilitySensor>
        <style jsx>{`
          .header {
            align-items: center;
            justify-content: center;
            background-color: rgba(255, 255, 255, 0.9);
            display: flex;
            height: ${theme.header.height.default};
            position: relative;
            top: 0;
            width: 100%;
            align-items: center;
            transition: all 500ms ease-in-out;

            :global(a) {
              border-bottom: 1px solid transparent;
            }

            :global(a.logoType) {
              align-items: center;
              display: flex;
              flex-direction: "column";
              color: ${theme.text.color.primary};

              .logo {
                flex-shrink: 0;
              }
            }

            &.homepage, &.resume {
              position: absolute;
              background-color: rgba(0, 0, 0, 0.25);
              height: ${theme.header.height.homepage};
            }

            &.subpage {
              background-color: rgba(0, 0, 0, 0.5);
            }
          }

          h1 {
            font-size: ${theme.font.size.m};
            font-weight: ${theme.font.weight.standard};
            margin: ${theme.space.stack.xs};
          }

          h2 {
            font-weight: ${theme.font.weight.standard};
            font-size: ${theme.font.size.xxs};
            letter-spacing: 0;
            margin: 0;
          }

          .logo {
            border-radius: 50%;
            border: 1px solid #eee;
            display: inline-block;
            height: 44px;
            margin: ${theme.space.inline.default};
            overflow: hidden;
            width: 44px;
            transition: all 0.5s;

            .homepage & {
              height: 60px;
              width: 60px;
            }

            img {
              width: 100%;
            }
          }

          .sensor {
            display: block;
            position: absolute;
            bottom: 0;
            z-index: 1;
            left: 0;
            right: 0;
            height: 1px;
            top: ${path === "/" ? theme.header.height.homepage : theme.header.height.default};
          }

          @from-width tablet {
            .header {
              padding: ${theme.space.inset.l};

              &.homepage {
                height: ${theme.header.height.homepage};
              }
            }
          }

          @below desktop {
            .header.homepage, .header.subpage {
              .logo {
                border: none;
              }

              :global(a.logoType),

              h1 {
                color: ${theme.color.neutral.white};
              }

              h2 {
                color: ${theme.color.neutral.gray.d};
              }
            }
          }

          @from-width desktop {
            .header {
              align-items: center;
              background-color: rgba(255, 255, 255, 0.9);
              display: flex;
              position: absolute;
              top: 0;
              width: 100%;
              justify-content: space-between;
              transition: padding 0.5s;

              &.fixed {
                height: ${theme.header.height.fixed};
                background-color: rgba(255, 255, 255, 0.9);
                left: 0;
                padding: 0 ${theme.space.m};
                position: fixed;
                top: 0;
                transition: all 500ms ease-in-out;
                width: 100%;
                z-index: 1;

                h1 {
                  margin: ${theme.space.stack.xxs};
                }

                h2 {
                  display: none;
                }
              }

              &.homepage:not(.fixed) {
                :global(a.logoType),

                h1 {
                  color: ${theme.color.neutral.white};
                }

                h2 {
                  color: ${theme.color.neutral.gray.d};
                }
              }

              &.subpage:not(.fixed) {
                :global(a.logoType),

                h1 {
                  color: ${theme.color.neutral.white};
                }

                h2 {
                  color: ${theme.color.neutral.gray.d};
                }
              }
            }

            .header :global(a.logoType) {
              text-align: left;
              flex-direction: row;
              flex-shrink: 0;
              width: auto;
            }

            .logo {
              margin: ${theme.space.inline.default};

              .fixed & {
                height: 36px;
                width: 36px;
              }

              .header.homepage:not(.fixed) & {
                border: none;
              }

              .header.subpage:not(.fixed) & {
                border: none;
              }
            }

            h2 {
              animation-duration: ${theme.time.duration.default};
              animation-name: h2Entry;
            }

            @keyframes h2Entry {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
          }
        `}</style>
      </Fragment>
    )
  }
}

Header.propTypes = {
  pages: PropTypes.array.isRequired,
  path: PropTypes.string.isRequired,
  theme: PropTypes.object.isRequired
}

export default Header
