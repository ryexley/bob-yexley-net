import _ from "lodash"
import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { isNotEmpty } from "@/utils"
import { Badge } from "@/components/Resume/Badge"

export const SkillsAndProficiencies = ({ data }) => {
  const renderCollection = ({ title, skillsProficiencies }) => (
    <Fragment key={title}>
      <h3>{ title }</h3>
      <ul>
        { skillsProficiencies.map(({ name, url }) => {
          const dashCaseName = _.kebabCase(name)

          return (
            <li key={`skill-${dashCaseName}`}>
              <Badge
                className={`badge-${dashCaseName}`}
                label={name}
                url={url} />
            </li>
          )
        })}
      </ul>
      <style jsx>{`
        h3 {
          margin: 0.75rem 0;
        }

        ul {
          display: flex;
          flex-wrap: wrap;
          list-style-type: none;
          margin: 0.5rem 0 1.5rem 0;
          padding: 0;
        }

        li {
          &:first-child {
            margin-left: 0;
          }
        }
      `}</style>
    </Fragment>
  )

  return (
    <section className="resume-section">
      <h2 className="resume-section-heading">Skills and Proficiencies</h2>
      { data.map(collection => renderCollection(collection)) }
    </section>
  )
}
