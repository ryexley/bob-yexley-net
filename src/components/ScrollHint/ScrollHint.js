import React, { Fragment } from "react"
import PropTypes from "prop-types"
import classnames from "classnames"

// Adapted from https://codepen.io/chrissimmons/pen/GrLQWp
export const ScrollHint = ({ className, onScrollHintClick, style }) => {
  const classes = classnames("scroll-hint-container", className)

  return (
    <Fragment>
      <div
        role="button"
        className={classes}
        onClick={onScrollHintClick}
        style={style}>
        <div className="mouse-hint">
          <div className="scroll"></div>
        </div>
      </div>
      <style jsx>{`
        .scroll-hint-container {
          --size: 4rem;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 50%;
          bottom: 4rem;
          cursor: pointer;
          height: var(--size);
          left: calc(50% - 2rem);
          position: absolute;
          width: var(--size);
          z-index: 4;
        }

        .mouse-hint {
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          box-sizing: border-box;
          height: 2.25rem;
          left: calc(50% - 0.6875rem);
          position: absolute;
          top: calc(50% - 1.125rem);
          transition: opacity .5s ease;
          width: 1.375rem;
          -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=0)";

          .scroll {
            animation: scroll-hint-animation 2s linear infinite;
            background: white;
            border-radius: 50%;
            left: 0.3125rem;
            height: 0.5rem;
            opacity: 0;
            pointer-events: none;
            position: absolute;
            width: 0.5rem;
            top: 0.3125rem;
            -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=0)";
          }
        }

        @keyframes fade-in-down {
          0% {
            opacity: 0;
            transform: translateY(-2rem);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scroll-hint-animation {
          60% {
            opacity: 0.5;
            -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=50)";
          }
          100% {
            opacity: 0;
            -ms-filter: "progid:DXImageTransform.Microsoft.Alpha(Opacity=0)";
            transform: translateY(14px);
          }
        }
      `}</style>
    </Fragment>
  )
}

ScrollHint.propTypes = {
  className: PropTypes.string,
  onScrollHintClick: PropTypes.func,
  style: PropTypes.object
}
