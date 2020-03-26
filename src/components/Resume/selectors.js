export const selectResumeData = rawData => {
  const {
    title,
    intro,
    toolsAndSkills: rawToolsAndSkills,
    skillProficiencyCollections: rawSkillProficiencyCollections,
    workHistory: rawWorkHistory,
    codeSamples: rawCodeSamples,
    extraStuff
  } = rawData

  const toolsAndSkillsMap = rawToolsAndSkills.reduce((toolsAndSkills, rts) => {
    const { key, name, url } = rts

    return {
      ...toolsAndSkills,
      [key.toLowerCase()]: { name, url }
    }
  }, {})

  const skillProficiencyCollections = rawSkillProficiencyCollections.map(
    raw => {
      const { title, skillsProficiencies: rawSkillsProficiencies } = raw
      const skillsProficiencies = rawSkillsProficiencies.map(
        key => toolsAndSkillsMap[key.toLowerCase()] || { name: key, url: "" }
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
      key => toolsAndSkillsMap[key.toLowerCase()] || { name: key, url: "" }
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

  const codeSamples = {
    intro: rawCodeSamples.intro,
    items: rawCodeSamples.items.map(raw => {
      const {
        name,
        url,
        technologiesTools: rawTechnologiesTools,
        description
      } = raw

      return {
        name,
        url,
        technologiesTools: rawTechnologiesTools.map(
          key => toolsAndSkillsMap[key.toLowerCase()] || { name: key, url: "" }
        ),
        description
      }
    })
  }

  return {
    title,
    intro,
    toolsAndSkillsMap,
    skillProficiencyCollections,
    workHistory,
    codeSamples,
    extraStuff
  }
}
