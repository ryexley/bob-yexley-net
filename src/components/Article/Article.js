import React from "react"
import PropTypes from "prop-types"
import classnames from "classnames"
import { isNotEmpty } from "../../utils"

const Article = props => {
  const { children, theme, className } = props
  const { space: { default: themePadding } } = theme
  const classes = classnames("article", {
    [className]: isNotEmpty(className)
  })

  const tabletPadding = `calc(${themePadding}) calc(${themePadding} * 2)`
  const desktopPadding = `calc(${themePadding} * 2 + 90px) 0 calc(${themePadding} * 2)`

  return (
    <React.Fragment>
      <article className={classes}>{children}</article>

      <style jsx>{`
        .article {
          padding: ${theme.space.inset.default};
          margin: 0 auto;
        }

        @from-width tablet {
          .article {
            padding: ${tabletPadding};
            max-width: ${theme.text.maxWidth.tablet};
          }
        }

        @from-width desktop {
          .article {
            padding: ${desktopPadding};
            max-width: ${theme.text.maxWidth.desktop};

            &.post {
              padding-top: 0;
            }
          }
        }
      `}</style>
    </React.Fragment>
  )
}

Article.propTypes = {
  children: PropTypes.node.isRequired,
  theme: PropTypes.object.isRequired,
  className: PropTypes.string
}

export default Article
