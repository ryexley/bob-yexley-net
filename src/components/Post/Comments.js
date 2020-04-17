import React from "react"
import PropTypes from "prop-types"

const Comments = props => {
  const { slug, theme } = props

  return (
    <React.Fragment>
      <div id="post-comments" className="comments">
      </div>

      {/* --- STYLES --- */}
      <style jsx>{`
        .comments {
          margin: 0 -8px ${theme.space.default};
        }
      `}</style>
    </React.Fragment>
  )
}

Comments.propTypes = {
  slug: PropTypes.string.isRequired,
  facebook: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired
}

export default Comments
