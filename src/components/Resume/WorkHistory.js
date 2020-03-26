import _ from "lodash"
import React, { Component, Fragment, useRef } from "react"
import PropTypes from "prop-types"
import classnames from "classnames"
import {
  FaChevronDown as ExpandIcon,
  FaChevronUp as CollapseIcon
} from "react-icons/fa/"
import { isNotEmpty } from "@/utils"
import { Badge } from "@/components/Resume/Badge"

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
          background: #f7f7f7;
          border: 1px solid #eee;
          border-radius: 0.5rem;
          display: flex;
          flex-direction: column;
          margin: 0 0 0.5rem 0;
          padding: 0.5rem 0.75rem;
        }

        div {
          display: flex;

          &:first-child {
            justify-content: space-between;
            margin: 0 0 0.5rem 0;
          }

          &.position-title {
            color: #069;
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
            color: #09c;
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

class WorkHistoryItem extends Component {
  constructor(props) {
    super(props)

    const { expanded } = this.props

    this.state = {
      expanded
    }
  }

  toggle() {
    this.setState(({ expanded }) => ({ expanded: !expanded }))
  }

  render() {
    const { data: workHistoryItem, expanded: showToggle } = this.props
    const { expanded } = this.state
    const {
      employer,
      positionTitle,
      startDate,
      endDate,
      summary,
      highlights
    } = workHistoryItem

    const classes = classnames({ collapsed: !expanded })
    const refkey = `work-history-${_.kebabCase(employer)}`
    const workHistoryItemRef = React.createRef()
    const toggleClasses = classnames("toggle", { collapsed: !expanded })

    return (
      <Fragment key={refkey}>
        <section>
          <div className={toggleClasses} onClick={() => this.toggle()}>
            {expanded ? <CollapseIcon className="work-item-toggle-icon" /> : <ExpandIcon className="work-item-toggle-icon" />}
            {`{ ${startDate} ↠ ${endDate} } ${employer} [ ${positionTitle} ] `}
          </div>
          <article className={classes} ref={workHistoryItemRef}>
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
              display: ${showToggle ? "none" : "flex"};
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
            margin: 0 0 3rem 0;
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
            expanded={index < 3} />
        )
      )}
    </section>
  )
}

WorkHistory.propTypes = {
  data: PropTypes.array
}
