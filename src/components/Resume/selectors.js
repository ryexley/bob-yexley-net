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

  return {
    toolsAndSkillsMap,
    skillProficiencyCollections,
    workHistory: rawWorkHistory
  }
}
