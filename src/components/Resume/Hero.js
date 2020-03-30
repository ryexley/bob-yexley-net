import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { ScrollHint } from "@cmp/ScrollHint"
import { HighlightedTechIcons } from "./HighlightedTechIcons"
import HeroImage from "./hero-image.jpg"

export const Hero = ({ theme, title, intro, onMouseScrollHintClick }) => (
  <Fragment>
    <header>
      <h1>{title}</h1>
      <HighlightedTechIcons />
      <h2>{intro}</h2>
      <ScrollHint
        className="scroll-hint"
        onScrollHintClick={onMouseScrollHintClick} />
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
        margin-top: ${`-calc(${theme.header.height.homepage} + ${theme.space.inset.l})`};
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
