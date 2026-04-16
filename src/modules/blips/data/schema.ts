import { z } from "zod"
import { blipReactionSummarySchema } from "@/modules/blips/data/reactions-schema"

export const BLIP_TYPES = {
  ROOT: "root",
  UPDATE: "update",
  COMMENT: "comment",
} as const

export const blipTypeSchema = z.enum([
  BLIP_TYPES.ROOT,
  BLIP_TYPES.UPDATE,
  BLIP_TYPES.COMMENT,
])
export type BlipType = z.infer<typeof blipTypeSchema>

export const blipAuthorSchema = z.object({
  profile_id: z.string().uuid().nullable(),
  display_name: z.string().nullable(),
  avatar_seed: z.string().nullable(),
  avatar_version: z.number().int().positive().nullable(),
})
export type BlipAuthor = z.infer<typeof blipAuthorSchema>

export const blipSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    content: z.string().nullable(), // allow null for drafts
    user_id: z.string().nullable(),
    parent_id: z.string().nullable(),
    blip_type: blipTypeSchema,
    allow_comments: z.boolean().default(true).optional(),
    updates_count: z.number().int().nonnegative().optional(),
    comments_count: z.number().int().nonnegative().optional(),
    published: z.boolean(),
    moderation_status: z.enum([
      "auto-approved",
      "pending",
      "approved",
      "rejected",
      "flagged",
    ]),
    tags: z.array(z.string()).optional(),
    reactions_count: z.number().int().nonnegative().optional(),
    my_reaction_count: z.number().int().nonnegative().optional(),
    reactions: z.array(blipReactionSummarySchema).optional(),
    author: blipAuthorSchema.optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .refine(
    data =>
      !data.published || (data.content !== null && data.content.trim() !== ""),
    {
      message: "Published blips must have content",
      path: ["content"],
    },
  )
  .refine(
    data => {
      // Additional rule: auto-approved blips must be published
      return data.moderation_status !== "auto-approved" || data.published
    },
    {
      message: "Auto-approved blips must be published",
      path: ["published"],
    },
  )

export type Blip = z.infer<typeof blipSchema>

// https://zod.dev/basics?id=handling-errors
// Explains the difference between parse and safeParse
export const validateBlip = blipSchema.parse
export const safeValidateBlip = blipSchema.safeParse
