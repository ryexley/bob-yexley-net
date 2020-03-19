import React, { Fragment } from "react"
import { StaticQuery, graphql } from "gatsby"
import PropTypes from "prop-types"
import { ThemeContext } from "@/layouts"
import { Hero } from "@cmp/Resume/Hero"
import { selectResumeData } from "@cmp/Resume/selectors"
import { SkillsAndProficiencies } from "@cmp/Resume/SkillsAndProficiencies"
import { WorkHistory } from "@cmp/Resume/WorkHistory"

const Resume = ({
  data: {
    allDataJson: {
      edges: [data]
    }
  }
}) => {
  const { node: resumeData } = data
  const {
    toolsAndSkillsMap,
    skillProficiencyCollections,
    workHistory
  } = selectResumeData(resumeData)

  return (
    <Fragment>
      <ThemeContext.Consumer>
        {theme => (
          <Fragment>
            <Hero theme={ theme } />
            <main className="resume-content">
              <SkillsAndProficiencies data={skillProficiencyCollections} />
              <WorkHistory data={workHistory} />
            </main>
            <style jsx>{`
              :root {
                --resume-heading-color: #444;
              }

              .resume-content {
                padding: 2rem;
              }

              :global(.resume-section-heading) {
                border-bottom: 1px solid #eee;
                color: var(--resume-heading-color);
                font-size: 2rem;
                margin: 2rem 0;

                &:first-of-type {
                  margin-top: 0;
                }
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
          toolsAndSkills {
            key
            name
            url
          }
          skillProficiencyCollections {
            title
            skillsProficiencies
          }
          workHistory {
            employer
            employerUrl
            startDate
            endDate
            positionTitle
            summary
            technologiesTools
            highlights
          }
        }
      }
    }
  }
`
