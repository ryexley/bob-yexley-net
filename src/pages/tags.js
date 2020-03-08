import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { IoMdPricetag as TagIcon } from "react-icons/io/"
import { graphql } from "gatsby"
import { ThemeContext } from "../layouts"
import Article from "../components/Article/"
import Headline from "../components/Article/Headline"
import List from "../components/List"
import Seo from "../components/Seo"

const TagsPage = ({ data }) => {
  const {
    posts: { edges: posts },
    site: {
      siteMetadata: { facebook }
    }
  } = data

  const tags = {}

  posts.forEach(edge => {
    const {
      node: {
        frontmatter: {
          tags: postTags
        }
      }
    } = edge

    postTags.forEach(tag => {
      if (tag && tag !== null && tag.length > 0) {
        if (!tags[tag]) {
          tags[tag] = []
        }

        tags[tag].push(edge)
      }
    })
  })

  const tagList = Object.keys(tags).map(key => {
    return [key, tags[key]]
  })

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Article theme={theme}>
            <header>
              <Headline title="Posts by Tag" theme={theme} />
            </header>
            {tagList.map(item => (
              <section key={item[0]}>
                <h2><TagIcon /> {item[0]}</h2>
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
      <Seo facebook={facebook} />
    </Fragment>
  )
}

TagsPage.propTypes = {
  data: PropTypes.object.isRequired
}

export default TagsPage

// eslint-disable-next-line no-undef
export const query = graphql`
  query TagPostsQuery {
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
            tags
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
    site {
      siteMetadata {
        facebook {
          appId
        }
      }
    }
  }
`
