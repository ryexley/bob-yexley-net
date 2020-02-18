import React from "react"
import PropTypes from "prop-types"
import kebabCase from "lodash/kebabCase"
import { Link } from "gatsby"
import { format } from "date-fns"

import { IoMdCalendar as CalendarIcon } from "react-icons/io/"
import { IoMdFiling as CategoryIcon } from "react-icons/io/"
import { IoMdPricetags as TagsIcon } from "react-icons/io/"

const Meta = props => {
  const { prefix, category, tags, theme } = props
  const renderTags = (tags && (tags.length > 0))

  const TagLinks = () => tags.map(tag => (
    <Link
      to={`/tag/${kebabCase(tag)}`} key={tag}
      title={`see other posts tagged with "${tag}"`}>
      {tag}
    </Link>
  ))

  return (
    <div className="meta">
      <span className="date">
        <CalendarIcon size={18} /> {format(new Date(prefix), "MMMM do, yyyy")}
      </span>
      {category && (
        <span className="category">
          <CategoryIcon size={18} />
          <Link
            to={`/category/${kebabCase(category)}`}
            title={`see other posts in the "${category}" category`}>
            {category}
          </Link>
        </span>
      )}
      {renderTags && (
        <span className="tag-links">
          <TagsIcon size={18} />
          <TagLinks />
        </span>
      )}
      <style jsx>{`
        .meta {
          display: flex;
          flex-flow: row wrap;
          font-size: 0.8em;
          margin: ${theme.space.m} 0;
          background: transparent;

          :global(svg) {
            fill: ${theme.icon.color};
            margin: ${theme.space.inline.xs};
          }

          span {
            align-items: center;
            display: flex;
            text-transform: uppercase;
            margin: ${theme.space.xs} ${theme.space.s} ${theme.space.xs} 0;

            :global(a) {}

            &:last-child {
              margin-right: 0;
            }
          }

          .date {
            color: ${theme.color.neutral.gray.f};
          }

          .category {
            margin-left: auto;
          }

          .tag-links {
            :global(a) {
              margin-right: 0.25rem;
            }

            :global(a:not(:last-child)) {
              &:after {
                content: ", ";
              }
            }
          }

          :global(a) {
            border-bottom: 1px solid ${theme.color.neutral.gray.f};

            &:hover {
              color: ${theme.color.brand.primary};
              border-bottom: 1px solid ${theme.color.brand.primary};
            }
          }
        }

        @from-width tablet {
          .meta {
            margin: ${`${theme.space.m} 0 ${theme.space.m}`};
          }
        }
      `}</style>
    </div>
  )
}

Meta.propTypes = {
  prefix: PropTypes.string.isRequired,
  category: PropTypes.string,
  tags: PropTypes.arrayOf(PropTypes.string),
  theme: PropTypes.object.isRequired
}

export default Meta
