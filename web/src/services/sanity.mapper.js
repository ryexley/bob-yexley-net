import MarkItDown from 'markdown-it'
import MarkdownCitation from 'markdown-it-citation'
import { addHours, format, parseISO } from 'date-fns'

export class SanityMapper {
  constructor() {
    this.md = this.initMarkdownParser()
  }

  initMarkdownParser() {
    const md = new MarkItDown()
    md.use(MarkdownCitation, { marker: '--' })

    return md
  }

  mapSettings(raw) {
    const {
      title,
      description
    } = raw

    return {
      title,
      description
    }
  }

  mapBlip(raw) {
    const createdDate = parseISO(raw._createdAt)
    const timezoneOffsetHours = (createdDate.getTimezoneOffset() / 60)

    return {
      ...raw,
      body: this.md.render(raw.body),
      slug: format(createdDate, 'yyyyMMddHHmmss')
    }
  }
}
