import React from "react"
import PropTypes from "prop-types"
import ReactMarkdown from "react-markdown"

export const Markdown = ({ content }) => {
  return (
    <ReactMarkdown>{content}</ReactMarkdown>
  )
}

Markdown.propTypes = {
  content: PropTypes.string
}
