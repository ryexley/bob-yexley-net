import { z } from "zod"

export const blipSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable(),
    content: z.string().nullable(), // allow null for drafts
    user_id: z.string().nullable(),
    parent_id: z.string().nullable(),
    published: z.boolean(),
    moderation_status: z.enum([
      "auto-approved",
      "pending",
      "approved",
      "rejected",
      "flagged",
    ]),
    tags: z.array(z.string()).optional(),
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
