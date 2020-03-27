import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { HighlightedTechIcons } from "./HighlightedTechIcons"
import HeroImage from "./hero-image.jpg"

export const Hero = ({ theme, title, intro, onMouseScrollHintClick }) => (
  <Fragment>
    <header>
      <h1>{title}</h1>
      <HighlightedTechIcons />
      <h2>{intro}</h2>
      <div
        role="button"
        className="scroll-hint-container"
        onClick={onMouseScrollHintClick}>
        {/* https://codepen.io/chrissimmons/pen/GrLQWp */}
        <div className="mouse-hint">
          <div className="scroll"></div>
        </div>
      </div>
    </header>
    <style jsx>{`
      header {
        align-items: center;
        background: ${theme.hero.background};
        background-color: ${theme.color.neutral.gray.j};
        background-image: url(${HeroImage});
        background-position: center;
        background-size: cover;
        background-repeat: no-repeat;
        color: ${theme.color.neutral.gray.a};
        display: flex;
        flex-flow: column nowrap;
        justify-content: center;
        min-height: 100vh;
        position: relative;

        &::after {
          background: rgba(0, 0, 0, 0.25);
          content: '';
          display: flex;
          height: 100%;
          min-height: 100vh;
          position: absolute;
          top: 0;
          width: 100vw;
        }
      }

      h1 {
        animation: fade-in-down .7s;
        margin: 2rem;
        margin-top: ${`calc(${theme.header.height.homepage} + 5rem)`};
        text-align: center;
      }

      h2 {
        animation: fade-in-down 1.3s;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.5rem;
        margin: 2rem;
        margin-bottom: 12rem;
      }

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

      @from-width desktop {
        h2 {
          max-width: 50rem;
        }
      }
    `}</style>
  </Fragment>
)

Hero.propTypes = {
  theme: PropTypes.object,
  title: PropTypes.string,
  intro: PropTypes.string,
  onMouseScrollHintClick: PropTypes.func
}
