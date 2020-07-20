import _ from "lodash"
import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { Markdown } from "@cmp/Resume/Markdown"
import { isEmpty } from "@/utils"

const TechnologiesTools = ({ data: technologiesTools }) => {
  return (
    <Fragment>
      <ul>
        { technologiesTools.map(({ name, url }) => {
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
        ul {
          display: flex;
          flex-wrap: wrap;
          font-size: 0.75rem;
          list-style-type: none;
          margin: 0;
          padding: 0;
        }

        li {
          margin-right: 0.5rem;
        }
      `}</style>
    </Fragment>
  )
}

TechnologiesTools.propTypes = {
  data: PropTypes.array
}

const CodeSample = ({ name, url, technologiesTools, description }) => (
  <li>
    <h3><a href={url}>{name}</a></h3>
    <TechnologiesTools data={technologiesTools} />
    <Markdown content={description} />
    <style jsx>{`
      li {
        margin-bottom: 1rem;

        h3 {
          margin: 0;

          a {
            border-bottom: 0;
          }
        }
      }
    `}</style>
  </li>
)

CodeSample.propTypes = {
  name: PropTypes.string,
  url: PropTypes.string,
  technologiesTools: PropTypes.array,
  description: PropTypes.string
}

export const CodeSamples = ({ data }) => {
  const {
    intro,
    items
  } = data

  return (
    <section className="resume-section">
      <h2 className="resume-section-heading">Wanna See Some Code?</h2>
      <Markdown content={intro} />
      <ul>
        {items.map(item => <CodeSample {...item} key={`item-${item.name}`} />)}
      </ul>
      <style jsx>{`
        ul {
          list-style-type: none;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </section>
  )
}

CodeSamples.propTypes = {
  data: PropTypes.object
}
