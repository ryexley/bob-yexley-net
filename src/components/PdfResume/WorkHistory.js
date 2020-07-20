import _ from "lodash"
import React, { Component, Fragment, useRef } from "react"
import PropTypes from "prop-types"
import classnames from "classnames"
import { isEmpty, isNotEmpty } from "@/utils"

function renderHeader({
  employer,
  employerUrl,
  startDate,
  endDate,
  positionTitle
}) {
  return (
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
          display: flex;
          flex-direction: column;
          margin: 0 0 0.5rem 0;
        }

        div {
          display: flex;

          &:first-child {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            margin: 0 0 0.5rem 0;

            div {
              margin-top: 0.25rem;
            }
          }
        }

        .position-title {
          font-size: 1.25rem;
          font-style: italic;
          font-weight: 300;
          margin: 0;
        }

        span {
          font-size: 0.85rem;
          margin-left: 0.25rem;

          &:nth-child(odd) {
            color: #ccc;
          }

          &:first-of-type {
            margin-left: 0;

            @from-width 500px {
              margin-left: 0.5rem;
            }
          }
        }

        h3 {
          font-weight: 400;
          margin: 0;

          a {
            border-bottom: 0;
          }
        }
      `}</style>
    </Fragment>
  )
}

renderHeader.propTypes = {
  employer: PropTypes.string,
  employerUrl: PropTypes.string,
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  positionTitle: PropTypes.string
}

function renderTechnologiesTools({ technologiesTools }) {
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

renderTechnologiesTools.propTypes = { technologiesTools: PropTypes.object }

function renderHighlights({ highlights }) {
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

          li {
            line-height: 1.5rem;
            margin-bottom: 0.75rem;
          }
        `}</style>
      </Fragment>
    )
  }

  return null
}

renderHighlights.propTypes = { highlights: PropTypes.object }

const FullDetailWorkHistoryItem = ({ workHistoryItem }) => {
  const {
    employer,
    positionTitle,
    startDate,
    endDate,
    summary,
    highlights
  } = workHistoryItem

  const refkey = `work-history-${_.kebabCase(employer)}`

  return (
    <Fragment key={refkey}>
      <section>
        <article>
          { renderHeader(workHistoryItem) }
          { renderTechnologiesTools(workHistoryItem) }
          <p>{summary}</p>
          { renderHighlights(workHistoryItem) }
        </article>
      </section>
      <style jsx>{`
        section {}

        p {
          margin: 1rem 0.25rem !important;
        }

        div {
          &.toggle {
            align-items: center;
            color: #ddd;
            cursor: pointer;
            font-size: 0.8rem;
            margin: 0.5rem 0;
            transition: color 250ms ease-in-out;

            &:hover {
              color: #777;
            }

            &.collapsed {
              color: #777;
            }
          }
        }

        :global(.work-item-toggle-icon) {
          color: #ddd;
          margin: 0 0.25rem 0 0;
        }

        article {
          margin: 0 0 2rem 0;
          overflow: hidden;
          transition: all 0.5s;

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

const SummaryWorkHistoryItem = ({ workHistoryItem }) => {
  const {
    employer,
    employerUrl,
    positionTitle,
    startDate,
    endDate
  } = workHistoryItem

  const refkey = `work-history-${_.kebabCase(employer)}`

  return (
    <Fragment key={refkey}>
      <div className="container">
        <div className="employer-title-timeframe">
          <div className="employer">
            {
              isNotEmpty(employerUrl) ?
                <a href={employerUrl}>
                  {employer}
                </a> :
                <span>{employer}</span>
            }
            <span> [{positionTitle}]</span>
          </div>
          <div className="timeframe">
            <span>from</span>
            <span>{startDate}</span>
            <span>to</span>
            <span>{endDate}</span>
          </div>
        </div>
        { renderTechnologiesTools(workHistoryItem) }
      </div>
      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          margin-bottom: 1rem;

          .employer-title-timeframe {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
          }

          .employer {
            font-weight: 400;
          }
        }

        .separator {
          margin: 0 0.5rem;
        }

        .timeframe {
          span {
            font-size: 0.85rem;
            margin-left: 0.25rem;

            &:nth-child(odd) {
              color: #ccc;
            }

            &:first-of-type {
              margin-left: 0;

              @from-width 500px {
                margin-left: 0.5rem;
              }
            }
          }
        }
      `}</style>
    </Fragment>
  )
}

const WorkHistoryItem = props => {
  const { data: workHistoryItem, showFullDetails } = props

  if (showFullDetails) {
    return <FullDetailWorkHistoryItem workHistoryItem={workHistoryItem} />
  }

  return <SummaryWorkHistoryItem workHistoryItem={workHistoryItem} />
}

export const WorkHistory = ({ data: workHistory }) => {
  return (
    <section className="resume-section">
      <h2 className="resume-section-heading">Professional Experience</h2>
      {workHistory.map(
        (workHistoryItem, index) => (
          <WorkHistoryItem
            key={`work-history-item-${index}`}
            data={workHistoryItem}
            showFullDetails={index < 3} />
        )
      )}
    </section>
  )
}

WorkHistory.propTypes = {
  data: PropTypes.array
}
