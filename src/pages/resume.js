import React, { Component, Fragment, createRef } from "react"
import { graphql } from "gatsby"
import PropTypes from "prop-types"
import { ThemeContext } from "@/layouts"
import Seo from "@cmp/Seo"
import { Hero } from "@cmp/Resume/Hero"
import { Contact } from "@cmp/Resume/Contact"
import { selectResumeData } from "@cmp/Resume/selectors"
import { SkillsAndProficiencies } from "@cmp/Resume/SkillsAndProficiencies"
import { WorkHistory } from "@cmp/Resume/WorkHistory"
import { CodeSamples } from "@cmp/Resume/CodeSamples"
import { More } from "@cmp/Resume/More"

class Resume extends Component {
  separator = createRef()

  scrollToContent = e => {
    this.separator.current.scrollIntoView({
      block: "start",
      behavior: "smooth"
    })
  }

  render() {
    const {
      data: {
        allDataJson: { edges: [data] }
      }
    } = this.props
    const { node: resumeData } = data
    const {
      pageTitle,
      title,
      intro,
      contactInfo,
      skillProficiencyCollections,
      workHistory,
      codeSamples,
      extraStuff
    } = selectResumeData(resumeData)
    const seoData = {
      frontmatter: { title: pageTitle }
    }

    return (
      <Fragment>
        <ThemeContext.Consumer>
          {theme => (
            <Fragment>
              <Seo data={seoData} />
              <Hero
                theme={ theme }
                title={title}
                intro={intro}
                onMouseScrollHintClick={this.scrollToContent} />
              <hr ref={this.separator} />
              <Contact data={contactInfo} />
              <main className="resume-content">
                <SkillsAndProficiencies data={skillProficiencyCollections} />
                <WorkHistory data={workHistory} />
                <CodeSamples data={codeSamples} />
                <More data={extraStuff} />
              </main>
              <style jsx>{`
                :root {
                  --resume-heading-color: #747490;

                  h3 {
                    color: var(--resume-heading-color);
                  }
                }

                hr {
                  border: 0;
                  margin: -3.125rem 0 3.125rem 0;
                }

                .resume-content {
                  color: #747474;
                  padding: 2rem;
                }

                :global(.resume-content p) {
                  line-height: 1.5rem;
                }

                :global(.resume-section) {
                  margin: 0 0 5rem 4rem;
                  margin: 0 0 5rem 0;
                  position: relative;
                }

                :global(.resume-section-heading) {
                  color: var(--resume-heading-color);
                  font-size: 2rem;
                  left: 0;
                  margin: 2rem 0;
                  padding: 2rem 0;
                  position: absolute;
                  /* text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.25); */
                  top: 0;
                  transform: rotate(90deg);
                  transform-origin: 0 0;
                  white-space: nowrap;

                  &:first-of-type {
                    margin-top: 0;
                  }
                }

                @from-width desktop {
                  .resume-content {
                    margin: 0 auto;
                    max-width: 50rem;
                  }

                  :global(.resume-section) {
                    margin-left: 0 0 5rem 0;
                  }
                }

                @below desktop {
                  :global(.resume-section-heading) {
                    padding: 0;
                    position: relative;
                    transform: none;

                    &:first-of-type {
                      margin-top: 0;
                    }
                  }
                }
              `}</style>
            </Fragment>
          )}
        </ThemeContext.Consumer>
      </Fragment>
    )
  }
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
          pageTitle
          title
          intro
          contactInfo {
            email
            phoneNumber
          }
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
          codeSamples {
            intro
            items {
              name
              url
              technologiesTools
              description
            }
          }
          extraStuff {
            heading
            body
          }
        }
      }
    }
  }
`
