import { FaTag } from "react-icons/fa/"
import PropTypes from "prop-types"
import React, { Fragment } from "react"
import { graphql } from "gatsby"
import Seo from "../components/Seo"
import { ThemeContext } from "../layouts"
import Article from "../components/Article"
import Headline from "../components/Article/Headline"
import List from "../components/List"

const CategoryTemplate = props => {
  const {
    pageContext: { category },
    data: {
      allMarkdownRemark: { totalCount, edges }
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
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Article theme={theme}>
            <header>
              <Headline theme={theme}>
                <div>Posts in category</div>
                <div className="category-name"><FaTag /> {category}</div>
              </Headline>
              { renderPostCountMeta() }
            </header>
            <List edges={edges} theme={theme} />
            <style jsx>{`
              .category-name {
                font-size: 2.5rem;
                margin-top: 1rem;
                text-transform: capitalize;
              }

              :global(ul) {
                padding-left: 1.75rem;
                padding-top: 0;

                :global(a) {
                  border-bottom: 1px solid ${theme.color.neutral.gray.f};

                  &:hover {
                    color: ${theme.color.brand.primary};
                    border-bottom: 1px solid ${theme.color.brand.primary};
                  }
                }
              }
            `}</style>
          </Article>
        )}
      </ThemeContext.Consumer>
      <Seo />
    </Fragment>
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
  }
`
