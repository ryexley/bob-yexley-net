import {FaTag} from "react-icons/fa/"
import PropTypes from "prop-types"
import React from "react"
import {graphql} from "gatsby"
import Seo from "../components/Seo"
import {ThemeContext} from "../layouts"
import Article from "../components/Article"
import Headline from "../components/Article/Headline"
import List from "../components/List"

const CategoryTemplate = props => {
  const {
    pageContext: {category},
    data: {
      allMarkdownRemark: {totalCount, edges},
      site: {
        siteMetadata: {facebook}
      }
    }
  } = props

  const renderPostCountMeta = () => {
    const multiplePosts = (totalCount > 1)
    const tense = multiplePosts ? "are" : "is"
    const noun = `post${multiplePosts ? "s" : ""}`

    return (
      <p className="meta">
        There {tense} <strong>{totalCount}</strong> {noun} in the category.
      </p>
    )
  }

  return (
    <React.Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Article theme={theme}>
            <header>
              <Headline theme={theme}>
                <span>Posts in category</span>
                <span className="category-name"><FaTag /> {category}</span>
              </Headline>
              { renderPostCountMeta() }
              <List edges={edges} theme={theme} />
            </header>
            <style jsx>{`
              .category-name {
                font-size: 2.5rem;
                text-transform: capitalize;
              }
            `}</style>
          </Article>
        )}
      </ThemeContext.Consumer>

      <Seo facebook={facebook} />
    </React.Fragment>
  )
}

CategoryTemplate.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired
}

export default CategoryTemplate

// eslint-disable-next-line no-undef
export const categoryQuery = graphql`
  query PostsByCategory($category: String) {
    allMarkdownRemark(
      limit: 1000
      sort: { fields: [fields___prefix], order: DESC }
      filter: { frontmatter: { category: { eq: $category } } }
    ) {
      totalCount
      edges {
        node {
          fields {
            slug
          }
          excerpt
          timeToRead
          frontmatter {
            title
            category
          }
        }
      }
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
