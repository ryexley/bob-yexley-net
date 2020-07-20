import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { Markdown } from "@cmp/Resume/Markdown"

const ExtraItem = ({ heading, body }) => {
  return (
    <Fragment>
      <li>
        <h3>{heading}</h3>
        <Markdown content={body} />
      </li>
      <style jsx>{`
        h3 {
          margin: 0;
        }

        li {
          margin-bottom: 2rem;
        }
      `}</style>
    </Fragment>
  )
}

export const More = ({ data }) => {
  return (
    <section className="resume-section">
      <h2 className="resume-section-heading">Still Curious? Need More?</h2>
      <ul>
        {data.map((item, index) => (
          <ExtraItem {...item} key={`extra-item-${index}`} />
        ))}
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

More.propTypes = {
  data: PropTypes.array
}
