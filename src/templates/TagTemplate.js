import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { IoMdPricetag as TagIcon } from "react-icons/io/"
import { graphql } from "gatsby"
import Seo from "../components/Seo"
import { ThemeContext } from "../layouts"
import Article from "../components/Article"
import Headline from "../components/Article/Headline"
import List from "../components/List"

const TagTemplate = ({ pageContext, data }) => {
  const { tag } = pageContext
  const { edges } = data.allMarkdownRemark

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Article theme={theme}>
            <header>
              <Headline theme={theme}>
                <div>Posts tagged with</div>
                <div className="tag-name"><TagIcon /> {tag}</div>
              </Headline>
            </header>
            <List edges={edges} theme={theme} />
            <style jsx>{`
              .tag-name {
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

TagTemplate.propTypes = {
  data: PropTypes.object.isRequired,
  pageContext: PropTypes.object.isRequired
}

export default TagTemplate

// eslint-disable-next-line no-undef
export const tagQuery = graphql`
  query PostsByTag($tag: String) {
    allMarkdownRemark(
      limit: 2000
      sort: { fields: [fields___prefix], order: DESC }
      filter: { frontmatter: { tags: { in: [$tag] } } }
    ) {
      totalCount
      edges {
        node {
          fields {
            slug
          }
          frontmatter {
            title
          }
        }
      }
    }
  }
`
