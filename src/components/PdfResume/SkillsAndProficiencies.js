import _ from "lodash"
import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { isEmpty } from "@/utils"

export const SkillsAndProficiencies = ({ data }) => {
  const renderCollection = ({ title, skillsProficiencies }) => (
    <Fragment key={title}>
      <h3>{ title }</h3>
      <ul>
        { skillsProficiencies.map(({ name, url }) => {
          const dashCaseName = _.kebabCase(name)

          if (isEmpty(url)) {
            return (
              <li key={`skill-${dashCaseName}`}>
                {name}
              </li>
            )
          }

          return (
            <li key={`skill-${dashCaseName}`}>
              <a href={url}>{name}</a>
            </li>
          )
        })}
      </ul>
      <style jsx>{`
        h3 {
          margin: 0.25rem 0;
        }

        ul {
          display: flex;
          flex-wrap: wrap;
          list-style-type: none;
          margin: 0.5rem 0 1.5rem 0;
          padding: 0;
        }

        li {
          margin-right: 1rem;

          &:first-child {
            margin-left: 0;
          }
        }
      `}</style>
    </Fragment>
  )

  renderCollection.propTypes = {
    title: PropTypes.string,
    skillsProficiencies: PropTypes.array
  }

  return (
    <section className="resume-section">
      <h2 className="resume-section-heading">Skills and Proficiencies</h2>
      { data.map(collection => renderCollection(collection)) }
    </section>
  )
}

SkillsAndProficiencies.propTypes = {
  data: PropTypes.array
}
