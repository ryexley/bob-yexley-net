import _ from "lodash"
import React, { Fragment } from "react"
import PropTypes from "prop-types"
import classnames from "classnames"
import { FaJs as JsIcon } from "react-icons/fa/"
import { FaHtml5 as HtmlIcon } from "react-icons/fa/"
import { FaCss3 as CssIcon } from "react-icons/fa/"
import { FaNodeJs as NodeJsIcon } from "react-icons/fa/"
import { FaReact as ReactIcon } from "react-icons/fa/"
import { FaVuejs as VueIcon } from "react-icons/fa/"
import { FaGitAlt as GitIcon } from "react-icons/fa/"
import { FaGithub as GitHubIcon } from "react-icons/fa/"
import { FaTerminal as TerminalIcon } from "react-icons/fa/"
import { DiSublime as SublimeTextIcon } from "react-icons/di/"
import { FaDatabase as SqlIcon } from "react-icons/fa/"
import { AiFillDatabase as NoSqlIcon } from "react-icons/ai/"
import { DiRedis as RedisIcon } from "react-icons/di/"
import { FaDocker as DockerIcon } from "react-icons/fa/"
import { DiVisualstudio as VsCodeIcon } from "react-icons/di/"
import { FaSass as SassIcon } from "react-icons/fa/"
import { isNotEmpty } from "../../utils"

export const Badge = ({ label, url, className, children }) => {
  const classes = classnames("badge", className)

  const badgeIconMap = {
    "java-script": JsIcon,
    "html": HtmlIcon,
    "css": CssIcon,
    "node-js": NodeJsIcon,
    "react": ReactIcon,
    "vue-js": VueIcon,
    "git-hub": GitHubIcon,
    "git": GitIcon,
    "sublime-text": SublimeTextIcon,
    "terminal-command-line": TerminalIcon,
    "sql": SqlIcon,
    "no-sql": NoSqlIcon,
    "redis": RedisIcon,
    "docker": DockerIcon,
    "vs-code": VsCodeIcon,
    "sass": SassIcon
  }

  const renderIcon = name => {
    const Icon = badgeIconMap[name]

    if (Icon) {
      return <Icon />
    }

    return null
  }

  const renderBadge = () => {
    if (isNotEmpty(children)) {
      return (
        <Fragment>
          <span className={classes}>
            { children }
          </span>
        </Fragment>
      )
    }

    if (isNotEmpty(url)) {
      return (
        <Fragment>
          <span className={classes}>
            { renderIcon(_.kebabCase(label)) } <a href={url}>{label}</a>
          </span>
        </Fragment>
      )
    }

    return (
      <Fragment>
        <span className={classes}>
          {label}
        </span>
      </Fragment>
    )
  }

  return (
    <Fragment>
      { renderBadge() }
      <style jsx global>{`
        :root {
          --color-white: #fff;
          --color-background: var(--color-white);
        }

        .badge {
          align-items: center;
          background: #f7fafb;
          border: 1px solid #e3edf3;
          border-radius: 1rem;
          display: flex;
          font-size: 0.85rem;
          margin: 0 0.5rem 0.5rem 0;
          padding: 0.3rem 0.75rem 0.25rem 0.75rem;

          svg {
            margin-right: 0.5rem;
          }

          a {
            border-bottom: 0;
            display: flex;
            height: 1rem;
            text-decoration: none;

            &:hover {
              border-bottom: 0;
            }

            &::after {
              margin-left: 0.5rem !important;
              top: 0 !important;
            }
          }
        }

        .badge-java-script {
          background: #EDDA68;
          background-image: linear-gradient(135deg, #EDDA68 60%, #D7C65F);
          border: 1px solid var(--color-background);
          color: #000;

          a {
            color: #000;
          }
        }

        .badge-html {
          background: #F06529;
          background-image: linear-gradient(135deg, #F06529, #E34C26);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-background);
          }
        }

        .badge-css {
          background: #438EC5;
          background-image: linear-gradient(135deg, #438EC5 10%, #51A5D5);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-node-js {
          background: #5DA848;
          background-image: linear-gradient(135deg, #5DA848 10%, #6FBB4E);
          border: 1px solid var(--color-);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-react {
          background: #61DAFB;
          background-image: linear-gradient(135deg, #61DAFB 50%, #4FB2CD);
          border: 1px solid var(--color-background);
          color: #282C34;

          a {
            color: #282C34;
          }
        }

        .badge-redux {
          background: #764ABC;
          background-image: linear-gradient(135deg, #764ABC 50%, #563689);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-vue-js,
        .badge-vuex {
          background: #41B883;
          border: 1px solid #35495E;
          color: #35495E;

          a {
            color: var(--color-white);
          }
        }

        .badge-svelte {
          background: #FF3E00;
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-sapper {
          background: #159794;
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-webpack {
          background: #1C78C0;
          background-image: linear-gradient(135deg, #1C78C0, #8ED6FB);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-mocha {
          background: #8D6748;
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-jest {
          background: #984A60;
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-gatsby {
          background: #452475;
          background-image: linear-gradient(135deg, #452475 10%, #542C85);
          border: 1px solid #131217;
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-es-lint {
          background: #4B32C3;
          background-image: linear-gradient(135deg, #8080F2, #4B32C3);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-docker {
          background: #579EE8;
          background-image: linear-gradient(135deg, #579EE8, #0E65C9);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-sublime-text {
          background: #4B4B4B;
          border: 1px solid #FF9800;
          color: #FF9800;

          a {
            color: #FF9800;
          }
        }

        .badge-git {
          background: #EEEEE6;
          border: 1px solid #F54D27;
          color: #F54D27;

          a {
            color: #F54D27;
          }
        }

        .badge-git-hub {
          background: #24292E;
          border: 1px solid #F6F8FA;
          color: #F6F8FA;

          a {
            color: #F6F8FA;
          }
        }

        .badge-terminal-command-line {
          background: #212A2F;
          border: 1px solid #0DE828;
          color: #0DE828;

          a {
            color: #0DE828;
          }
        }

        .badge-redis {
          background: #D92B21;
          background-image: linear-gradient(135deg, #D92B21, #A41F16);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-rabbit-mq {
          background: #FF6600;
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-vs-code {
          background: #52A8EC;
          background-image: linear-gradient(135deg, #3273B2, #52A8EC);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-sass {
          background: #CF649A;
          background-image: linear-gradient(135deg, #CF649A, #BF4080);
          border: 1px solid var(--color-background);
          color: var(--color-white);

          a {
            color: var(--color-white);
          }
        }

        .badge-electron {
          background: #2F3241;
          background-image: linear-gradient(135deg, #2F3241, #2B2E3B);
          border: 1px solid #9FEAF9;
          color: #9FEAF9;

          a {
            color: #9FEAF9;
          }
        }
      `}</style>
    </Fragment>
  )
}

Badge.propTypes = {
  label: PropTypes.string,
  url: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node
}
