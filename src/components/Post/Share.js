import React, { Fragment } from "react"
import PropTypes from "prop-types"

import config from "../../../content/meta/config"

const PostShare = props => {
  const {
    post: {
      fields: { slug },
      frontmatter: { title }
    },
    theme
  } = props

  const url = config.siteUrl + config.pathPrefix + slug

  const iconSize = 36

  const dev = process.env.NODE_ENV === "development"

  return !dev ? (
    <Fragment>
      <div className="share">
        <span className="label">SHARE</span>
        <div className="links">
        </div>
      </div>

      {/* --- STYLES --- */}
      <style jsx>{`
        .share {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .links {
          display: flex;
          flex-direction: row;

          :global(.SocialMediaShareButton) {
            margin: 0 0.8em;
            cursor: pointer;
          }
        }

        .label {
          font-size: 1.2em;
          margin: 0 1em 1em;
        }

        @from-width tablet {
          .share {
            flex-direction: row;
            margin: ${theme.space.inset.l};
          }
          .label {
            margin: ${theme.space.inline.m};
          }
        }
      `}</style>
    </Fragment>
  ) : null
}

PostShare.propTypes = {
  post: PropTypes.object.isRequired,
  theme: PropTypes.object.isRequired
}

export default PostShare
