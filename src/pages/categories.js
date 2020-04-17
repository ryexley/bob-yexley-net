import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { IoMdFiling as CategoryIcon } from "react-icons/io/"
import { graphql } from "gatsby"
import { ThemeContext } from "../layouts"
import Article from "../components/Article/"
import Headline from "../components/Article/Headline"
import List from "../components/List"
import Seo from "../components/Seo"

const CategoriesPage = props => {
  const {
    data: {
      posts: { edges: posts },
    }
  } = props

  // Create category list
  const categories = {}

  posts.forEach(edge => {
    const {
      node: {
        frontmatter: { category }
      }
    } = edge

    if (category && category !== null && category.length > 0) {
      if (!categories[category]) {
        categories[category] = []
      }

      categories[category].push(edge)
    }
  })

  const categoryList = Object.keys(categories).map(key => {
    return [key, categories[key]]
  })

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Article theme={theme}>
            <header>
              <Headline title="Posts by Category" theme={theme} />
            </header>
            {categoryList.map(item => (
              <section key={item[0]}>
                <h2>
                  <CategoryIcon /> {item[0]}
                </h2>
                <List edges={item[1]} theme={theme} />
              </section>
            ))}

            <style jsx>{`
              h2 {
                margin: 0 0 0.5em;
                text-transform: capitalize;
              }

              h2 :global(svg) {
                height: 0.8em;
                fill: ${theme.color.brand.primary};
              }

              section :global(ul) {
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

CategoriesPage.propTypes = {
  data: PropTypes.object.isRequired
}

export default CategoriesPage

// eslint-disable-next-line no-undef
export const query = graphql`
  query CategoryPostsQuery {
    posts: allMarkdownRemark(
      filter: { fileAbsolutePath: { regex: "//posts/[0-9]+.*--/" } }
      sort: { fields: [fields___prefix], order: DESC }
    ) {
      edges {
        node {
          excerpt
          fields {
            slug
            prefix
          }
          frontmatter {
            title
            category
            cover {
              children {
                ... on ImageSharp {
                  fluid(maxWidth: 800, maxHeight: 360) {
                    ...GatsbyImageSharpFluid_withWebp
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`
