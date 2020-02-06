import PropTypes from "prop-types"
import React, { Fragment } from "react"
import { graphql } from "gatsby"

require("prismjs/themes/prism-coy.css")
require("prismjs/plugins/line-numbers/prism-line-numbers.css")

import Seo from "../components/Seo"
import Article from "../components/Article"
import Post from "../components/Post"
import Hero from "../components/Post/Hero"
import { ThemeContext } from "../layouts"

const PostTemplate = props => {
  let { data: { post } } = props
  const {
    data: {
      // post,
      post: {
        frontmatter: {
          cover: {
            desktop: { resize: { src: postCoverDesktop } },
            tablet: { resize: { src: postCoverTablet } },
            mobile: { resize: { src: postCoverMobile } }
          }
        }
      },
      bgDesktop: { resize: { src: siteHeroDesktop } },
      bgTablet: { resize: { src: siteHeroTablet } },
      bgMobile: { resize: { src: siteHeroMobile } },
      site: { siteMetadata: { facebook } },
      authornote: { html: authorNote }
    },
    pageContext: { next, prev }
  } = props

  const heroImage = {
    postCoverDesktop,
    postCoverTablet,
    postCoverMobile,
    siteHeroDesktop,
    siteHeroTablet,
    siteHeroMobile
  }

  post = { ...post, heroImage }

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Fragment>
            <Hero post={post} theme={theme} />
            <Article theme={theme} className="post">
              <Post
                post={post}
                next={next}
                prev={prev}
                authornote={authorNote}
                facebook={facebook}
                theme={theme}
              />
            </Article>
          </Fragment>
        )}
      </ThemeContext.Consumer>

      <Seo data={post} facebook={facebook} />
    </Fragment>
  )
}

PostTemplate.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired
}

export default PostTemplate

// eslint-disable-next-line no-undef
export const postQuery = graphql`
  query PostBySlug($slug: String!) {
    post: markdownRemark(fields: { slug: { eq: $slug } }) {
      id
      html
      fields {
        slug
        prefix
      }
      frontmatter {
        title
        category
        tags
        cover {
          desktop: childImageSharp {
            resize(width: 1200, quality: 90, cropFocus: CENTER) {
              src
            }
          }
          tablet: childImageSharp {
            resize(width: 800, quality: 90, cropFocus: CENTER) {
              src
            }
          }
          mobile: childImageSharp {
            resize(width: 450, quality: 90, cropFocus: CENTER) {
              src
            }
          }
        }
      }
    }
    authornote: markdownRemark(fileAbsolutePath: { regex: "/author/" }) {
      id
      html
    }
    site {
      siteMetadata {
        facebook {
          appId
        }
      }
    }
    bgDesktop: imageSharp(fluid: {
      originalName: {
        regex: "/hero-background/"
      }
    }) {
      resize(width: 1200, quality: 90, cropFocus: CENTER) {
        src
      }
    }
    bgTablet: imageSharp(fluid: {
      originalName: {
        regex: "/hero-background/"
      }
    }) {
      resize(width: 800, height: 1100, quality: 90, cropFocus: CENTER) {
        src
      }
    }
    bgMobile: imageSharp(fluid: {
      originalName: {
        regex: "/hero-background/"
      }
    }) {
      resize(width: 450, height: 850, quality: 90, cropFocus: CENTER) {
        src
      }
    }
  }
`
