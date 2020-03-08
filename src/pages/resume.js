import React, { Fragment } from "react"
import { StaticQuery, graphql } from "gatsby"
import PropTypes from "prop-types"
import { ThemeContext } from "../layouts"
import { Hero } from "../components/Resume/Hero"
import { SkillsAndProficiencies } from "../components/Resume/SkillsAndProficiencies"

const Resume = ({
  data: {
    allDataJson: {
      edges: [data]
    }
  }
}) => {
  const { node: resumeData } = data
  const {
    skillProficiencyCollections,
    workHistory
  } = resumeData

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Fragment>
            <Hero theme={ theme } />
            <main className="resume-content">
              <SkillsAndProficiencies data={skillProficiencyCollections} />
            </main>
            <style jsx>{`
              .resume-content {
                padding: 2rem;
              }

              @from-width desktop {
                .resume-content {
                  margin: 0 auto;
                  max-width: 50rem;
                }
              }
            `}</style>
          </Fragment>
        )}
      </ThemeContext.Consumer>
    </Fragment>
  )
}

Resume.propTypes = {
  data: PropTypes.object.isRequired
}

export default Resume

// eslint-disable-next-line no-undef
export const query = graphql`
  query ResumeQuery {
    allDataJson {
      edges {
        node {
          skillProficiencyCollections {
            title
            skillsProficiencies {
              name
              url
            }
          }
          workHistory {
            employer
            employerUrl
            startDate
            endDate
            positionTitle
            description
            highlights
          }
        }
      }
    }
    site {
      siteMetadata {
        facebook {
          appId
        }
      }
    }
  }
`
