import { z } from "zod"

export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const blipTagSchema = z.object({
  blip_id: z.string(),
  tag_id: z.string().uuid(),
  created_at: z.string(),
})

export type Tag = z.infer<typeof tagSchema>
export type BlipTag = z.infer<typeof blipTagSchema>

export const validateTag = tagSchema.parse
export const validateBlipTag = blipTagSchema.parse
