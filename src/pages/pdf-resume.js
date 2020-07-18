import React, { Fragment } from "react"
import PropTypes from "prop-types"
import { graphql } from "gatsby"
import { selectResumeData } from "@cmp/Resume/selectors"
import { PdfResumeLayout } from "@/layouts/pdf-resume"

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
      <p>{contactInfo.name}: {title}</p>
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
