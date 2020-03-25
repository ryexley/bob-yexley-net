export const selectResumeData = rawData => {
  const {
    toolsAndSkills: rawToolsAndSkills,
    skillProficiencyCollections: rawSkillProficiencyCollections,
    workHistory: rawWorkHistory
  } = rawData

  const toolsAndSkillsMap = rawToolsAndSkills.reduce((toolsAndSkills, rts) => {
    const { key, name, url } = rts

    return {
      ...toolsAndSkills,
      [key]: { name, url }
    }
  }, {})

  const skillProficiencyCollections = rawSkillProficiencyCollections.map(
    raw => {
      const { title, skillsProficiencies: rawSkillsProficiencies } = raw
      const skillsProficiencies = rawSkillsProficiencies.map(
        key => toolsAndSkillsMap[key]
      )

      return {
        title,
        skillsProficiencies
      }
    }
  )

  const workHistory = rawWorkHistory.map(raw => {
    const {
      employer,
      employerUrl,
      startDate,
      endDate,
      positionTitle,
      summary,
      technologiesTools: rawTechnologiesTools,
      highlights
    } = raw

    const technologiesTools = rawTechnologiesTools.map(
      key => toolsAndSkillsMap[key] || { name: key, url: "" }
    )

    return {
      employer,
      employerUrl,
      startDate,
      endDate,
      positionTitle,
      summary,
      technologiesTools,
      highlights
    }
  })

  return {
    toolsAndSkillsMap,
    skillProficiencyCollections,
    workHistory
  }
}
