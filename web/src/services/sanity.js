import client from '../sanityClient'
import { SanityMapper } from './sanity.mapper'

export class SanityService {
  constructor() {
    this.client = client
    this.mapper = new SanityMapper()
  }

  async fetchSiteSettings() {
    const query = '*[_type == "siteSettings"]'

    const rawSettings = await client.fetch(query)

    return this.mapper.mapSettings(rawSettings[0])
  }

  async fetchBlips() {
    const query = '*[_type == "blip" && _createdAt < now()]|order(_createdAt desc)'
    const rawBlips = await client.fetch(query)

    return rawBlips.map(blip => this.mapper.mapBlip(blip))
  }

  async fetchBlip(slug) {
    const parseSlug = createdAt => {
      const yyyy = Number(createdAt.slice(0,4))
      const MM = Number((createdAt.slice(4, 6) - 1)) // month *index*
      const dd = Number(createdAt.slice(6, 8))
      const HH = Number(createdAt.slice(8, 10))
      const mm = Number(createdAt.slice(10, 12))
      const ss = Number(createdAt.slice(12, 14))

      return new Date(yyyy, MM, dd, HH, mm, ss).toISOString().replace('.000', '')
    }

    const createdAt = parseSlug(slug)
    const query = `*[_type == "blip" && _createdAt == "${createdAt}"][0]`

    const blip = await client.fetch(query)

    return this.mapper.mapBlip(blip)
  }
}
