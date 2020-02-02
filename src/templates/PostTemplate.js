import PropTypes from "prop-types"
import React, { Fragment } from "react"
import { MDXRenderer } from "gatsby-plugin-mdx"
import { graphql } from "gatsby"
require("prismjs/themes/prism-coy.css")

import Seo from "../components/Seo"
import Article from "../components/Article"
import Post from "../components/Post"
import { ThemeContext } from "../layouts"

const PostTemplate = props => {
  const {
    data: {
      post,
      authornote: { body: authorNote },
      site: {
        siteMetadata: { facebook }
      }
    },
    pageContext: { next, prev }
  } = props

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Article theme={theme}>
            <Post
              post={post}
              next={next}
              prev={prev}
              authornote={authorNote}
              facebook={facebook}
              theme={theme}
            />
          </Article>
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
    post: mdx(fields: { slug: { eq: $slug } }) {
      id
      body
      fields {
        slug
        prefix
      }
      frontmatter {
        title
        category
        cover {
          childImageSharp {
            resize(width: 300) {
              src
            }
          }
        }
      }
    }
    authornote: mdx(fileAbsolutePath: { regex: "/author/" }) {
      id
      body
    }
    site {
      siteMetadata {
        facebook {
          appId
        }
      }
    }
  }
`
