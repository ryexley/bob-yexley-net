import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"
import { selectResumeData } from "@cmp/Resume/selectors"
import { PdfResumeLayout } from "@/layouts/pdf-resume"
import { SkillsAndProficiencies } from "@cmp/PdfResume/SkillsAndProficiencies"
import { WorkHistory } from "@cmp/PdfResume/WorkHistory"
import { CodeSamples } from "@cmp/PdfResume/CodeSamples"
import { More } from '@cmp/PdfResume/More'

const PdfResume = ({ data: { allDataJson: { edges: [data] } } }) => {
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

  return (
    <PdfResumeLayout>
      <header>
        <ul>
          <li className="full-name">{contactInfo.name}</li>
          <li>
            <a href={contactInfo.website}>
              {contactInfo.website}
            </a>
          </li>
        </ul>
        <ul>
          <li>
            <a href={`mailto:${contactInfo.email}`}>
              {contactInfo.email}
            </a>
          </li>
          <li>
            <a href={`tel:${contactInfo.phoneNumber}`}>
              {contactInfo.phoneNumber}
            </a>
          </li>
        </ul>
      </header>
      <article className="intro">
        <h1>{title}</h1>
        <p>{intro}</p>
      </article>
      <SkillsAndProficiencies data={skillProficiencyCollections} />
      <WorkHistory data={workHistory} />
      <CodeSamples data={codeSamples} />
      <More data={extraStuff} />
      <footer>

      </footer>
      <style jsx>{`
        header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2.5rem;

          .full-name {
            font-size: 2rem;
            font-weight: 300;
            margin-bottom: 0.25rem;
          }

          ul {
            list-style-type: none;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </PdfResumeLayout>
  )
}

PdfResume.propTypes = {
  data: PropTypes.object.isRequired
}

export default PdfResume

// eslint-disable-next-line no-undef
export const query = graphql`
  query PdfResumeQuery {
    allDataJson {
      edges {
        node {
          pageTitle
          title
          intro
          contactInfo {
            name
            email
            phoneNumber
            website
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
