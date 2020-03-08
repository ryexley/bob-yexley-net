import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { isNotEmpty } from "../../utils"

export const SkillsAndProficiencies = ({ data }) => {
  console.log({ data })

  const renderCollection = ({ title, skillsProficiencies }) => (
    <Fragment key={title}>
      <h3>{ title }</h3>
      <ul>
        { skillsProficiencies.map(({ name, url }) => {
          const key = `skill-${name.toLowerCase().replace(" ", "-").replace(".", "-").replace("/", "-")}`

          if (isNotEmpty(url)) {
            return (
              <li key={key} className={key}>
                <a href={url}>{ name }</a>
              </li>
            )
          } else {
            return (
              <li key={key} className={key}>
                { name }
              </li>
            )
          }
        })}
      </ul>
      <style jsx>{`
        ul {
          display: flex;
          flex-wrap: wrap;
          list-style-type: none;
          margin: 0.5rem 0;
          padding: 0;
        }

        li {
          background: #f7fafb;
          border: 1px solid #e3edf3;
          border-radius: 1rem;
          font-size: 0.85rem;
          margin: 0 0.5rem 0.5rem 0;
          padding: 0.25rem 0.75rem;

          &:first-child {
            margin-left: 0;
          }

          a {
            border-bottom: 0;
            text-decoration: none;

            &:after {
              top: 0;
            }
          }
        }
      `}</style>
    </Fragment>
  )

  return (
    <Fragment>
      <h2>Skills and Proficiencies</h2>
      { data.map(collection => renderCollection(collection)) }
    </Fragment>
  )
}
