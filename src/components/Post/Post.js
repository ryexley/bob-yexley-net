import React, { Fragment } from "react"
import PropTypes from "prop-types"

import Bodytext from "../Article/Bodytext"
import Meta from "./Meta"
import Author from "./Author"
import NextPrev from "./NextPrev"

const Post = props => {
  const {
    post: {
      html,
      fields: { prefix, slug },
      frontmatter: { title, category, tags }
    },
    authornote,
    next: nextPost,
    prev: prevPost,
    theme
  } = props

  return (
    <Fragment>
      <header>
        <Meta prefix={prefix} category={category} tags={tags} theme={theme} />
      </header>
      <Bodytext html={html} theme={theme} />
      <footer>
        <Author note={authornote} theme={theme} />
        <NextPrev next={nextPost} prev={prevPost} theme={theme} />
      </footer>
    </Fragment>
  )
}

Post.propTypes = {
  post: PropTypes.object.isRequired,
  authornote: PropTypes.string.isRequired,
  next: PropTypes.object,
  prev: PropTypes.object,
  theme: PropTypes.object.isRequired
}

export default Post
