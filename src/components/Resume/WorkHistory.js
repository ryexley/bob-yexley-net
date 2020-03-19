import _ from "lodash"
import React, { Fragment } from "react"
import PropTypes from "prop-types"
import classnames from "classnames"
import { isNotEmpty } from "@/utils"
import { Badge } from "@/components/Resume/Badge"

export const WorkHistory = ({ data: workHistory }) => {
  const renderHeader = ({
    employer,
    employerUrl,
    startDate,
    endDate,
    positionTitle
  }) => (
    <Fragment>
      <header>
        <div>
          {
            isNotEmpty(employerUrl) ?
              <h3>
                <a href={employerUrl}>
                  {employer}
                </a>
              </h3> :
              <h3>{employer}</h3>
          }
          <div>
            <span>from</span>
            <span>{startDate}</span>
            <span>to</span>
            <span>{endDate}</span>
          </div>
        </div>
        <div className="position-title">{positionTitle}</div>
      </header>
      <style jsx>{`
        header {
          background: #f7f7f7;
          border: 1px solid #eee;
          border-radius: 0.5rem;
          display: flex;
          flex-direction: column;
          margin: 0 0 0.5rem 0;
          padding: 0.5rem;
        }

        div {
          display: flex;

          &:first-child {
            justify-content: space-between;
            margin: 0 0 0.5rem 0;
          }

          &.position-title {
            font-style: italic;
          }
        }

        span {
          font-size: 0.85rem;
          margin-left: 0.5rem;

          &:nth-child(odd) {
            color: #ccc;
          }
        }

        h3 {
          a {
            border-bottom: 0;
          }
        }
      `}</style>
    </Fragment>
  )

  const renderTechnologiesTools = ({
    technologiesTools
  }) => (
    <Fragment>
      <ul>
        { technologiesTools.map(({ name, url }) => {
          const dashCaseName = _.kebabCase(name)

          return (
            <li key={`item-${dashCaseName}`}>
              <Badge
                className={`badge-${dashCaseName}`}
                label={name}
                url={url} />
            </li>
          )
        })}
      </ul>
      <style jsx>{`
        ul {
          display: flex;
          flex-wrap: wrap;
          list-style-type: none;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </Fragment>
  )

  const renderHighlights = highlights => {
    if (isNotEmpty(highlights)) {
      return (
        <Fragment>
          <ul>
            { highlights.map((item, index) => (
              <li key={`highlight-${index}`}>{item}</li>
            ))}
          </ul>
          <style jsx>{`
            ul {
              list-style-type: circle;
              padding: 0 0 0 1.5rem;
            }
          `}</style>
        </Fragment>
      )
    }

    return null
  }

  const renderWorkHistoryItem = (workHistoryItem, expanded) => {
    console.log({ expanded })

    const {
      employer,
      positionTitle,
      startDate,
      endDate,
      summary,
      highlights
    } = workHistoryItem

    const classes = classnames({ collapsed: !expanded })

    return (
      <Fragment key={`work-history-${_.kebabCase(employer)}`}>
        <section>
          <div className="toggle">
            {`${employer} // ${positionTitle} // from ${startDate} to ${endDate}`}
          </div>
          <article className={classes}>
            { renderHeader(workHistoryItem) }
            { renderTechnologiesTools(workHistoryItem) }
            <p>{summary}</p>
            { renderHighlights(highlights) }
          </article>
        </section>
        <style jsx>{`
          section {}

          div {
            &.toggle {
              cursor: pointer;
              display: ${expanded ? "none" : "block"};
              font-size: 0.8rem;
              margin: 0.25rem 0;
            }
          }

          article {
            margin: 0 0 3rem 0;

            &.collapsed {
              height: 0;
              margin: 0;
              opacity: 0;
            }
          }

          p {
            margin: 1rem 0;
          }
        `}</style>
      </Fragment>
    )
  }

  return (
    <Fragment>
      <h2 className="resume-section-heading">Work History</h2>
      { workHistory.map(
        (workHistoryItem, index) => renderWorkHistoryItem(workHistoryItem, index < 3)
      ) }
    </Fragment>
  )
}
