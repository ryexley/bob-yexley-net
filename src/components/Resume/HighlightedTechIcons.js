import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { FaJsSquare as JsIcon } from "react-icons/fa/"
import { FaHtml5 as HtmlIcon } from "react-icons/fa/"
import { FaCss3 as CssIcon } from "react-icons/fa/"
import { FaNodeJs as NodeJsIcon } from "react-icons/fa/"

const iconHeight = "3rem"

export const HighlightedTechIcons = () => (
  <Fragment>
    <svg
      focusable="false"
      aria-hidden="true"
      style={{ width: 0, height: 0, position: "absolute" }}>
      <filter xmlns="http://www.w3.org/2000/svg" id="shadow" height="130%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
        <feOffset dx="3" dy="3" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.5"/>
        </feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <linearGradient id="js-icon-color" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--js-start-color)" />
        <stop offset="75%" stopColor="var(--js-mid-color)" />
        <stop offset="100%" stopColor="var(--js-end-color)" />
      </linearGradient>
      <linearGradient id="html-icon-color" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--html-start-color" />
        <stop offset="75%" stopColor="var(--html-mid-color" />
        <stop offset="100%" stopColor="var(--html-end-color" />
      </linearGradient>
      <linearGradient id="css-icon-color" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--css-start-color" />
        <stop offset="75%" stopColor="var(--css-mid-color" />
        <stop offset="100%" stopColor="var(--css-end-color" />
      </linearGradient>
      <linearGradient id="node-js-icon-color" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--node-js-start-color" />
        <stop offset="75%" stopColor="var(--node-js-mid-color" />
        <stop offset="100%" stopColor="var(--node-js-end-color" />
      </linearGradient>
    </svg>
    <ul>
      <li className="icon js">
        <JsIcon style={{
          fill: "url(#js-icon-color)",
          filter: "url(#shadow)"
        }} />
      </li>
      <li className="icon html">
        <HtmlIcon style={{
          fill: "url(#html-icon-color)",
          filter: "url(#shadow)"
        }} />
      </li>
      <li className="icon css">
        <CssIcon style={{
          fill: "url(#css-icon-color)",
          filter: "url(#shadow)"
        }} />
      </li>
      <li className="icon nodejs">
        <NodeJsIcon style={{
          fill: "url(#node-js-icon-color)",
          filter: "url(#shadow)"
        }} />
      </li>
    </ul>
    <style jsx>{`
      --js-start-color: #EDDA68;
      --js-mid-color: #D7C65F;
      --js-end-color: #C2B255;

      --html-start-color: #D35736;
      --html-mid-color: #D96139;
      --html-end-color: #E06D3C;

      --css-start-color: #3372B1;
      --css-mid-color: #438EC5;
      --css-end-color: #51A5D5;

      --node-js-start-color: #3E863D;
      --node-js-mid-color: #5DA848;
      --node-js-end-color: #6FBB4E;

      ul {
        animation: fade-in-down 1s;
        display: flex;
        font-size: ${iconHeight};
        list-style-type: none;
        margin: 1rem;
        padding: 0;
      }

      li {
        height: ${iconHeight};
      }

      .icon {
        margin: 0 1rem;
        text-shadow: #fff 1px 0 10px;
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
    `}</style>
  </Fragment>
)
