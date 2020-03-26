import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { HighlightedTechIcons } from "./HighlightedTechIcons"
import HeroImage from "./hero-image.jpg"

export const Hero = ({ theme, onMouseScrollHintClick }) => (
  <Fragment>
    <header>
      <h1>Front End Web and Distributed Software Developer</h1>
      <HighlightedTechIcons />
      <h2>
        Family-first husband and father of three, I believe a good work-life
        balance is essential to maintaining the focus and productivity needed to
        achieve great results. I believe in using the right tool to get the job
        done in the most effective and efficient manner possible. In my 20+
        years of experience, that has involved the use of various tools and
        platforms, but most recently my focus and specialization has been on
        native front-end web application development using HTML5, CSS3 and
        JavaScript connecting to flexible and powerful REST and microservices
        on the server. I&#39;m passionate about delivering high-quality,
        user-friendly solutions that deliver business value to my customers and
        clients on the most ubiquitous and accessible platform available to
        them: the web.
      </h2>
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
        flex-direction: column;
        height: 100vh;
        justify-content: center;
        min-height: 50rem;

        &::after {
          background: rgba(0, 0, 0, 0.25);
          content: '';
          display: flex;
          height: 100vh;
          min-height: 50rem;
          position: absolute;
          width: 100vw;
        }
      }

      h1 {
        animation: fade-in-down .7s;
        margin: 2rem;
        text-align: center;
      }

      h2 {
        animation: fade-in-down 1.3s;
        font-size: 1rem;
        font-weight: normal;
        line-height: 1.5rem;
        margin: 2rem;
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
        z-index: 10;
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
