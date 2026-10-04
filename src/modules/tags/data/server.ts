import { z } from "zod"
import type { AdminTagRecord, AdminTagsQueryResult, AdminTagUpdateResult, MergeTagsResult } from "./types"
import { getAdminClient } from "@/lib/vendor/supabase/admin"
import { getServerClient } from "@/lib/vendor/supabase/server"
import { selectUserProfileRecord } from "@/lib/vendor/supabase/user-profile"
import { slugify } from "@/util/formatters"

type TagRow = {
  id: string
  name: string
  description: string | null
  cover_image: string | null
  created_at: string
  updated_at: string
}

type TagWithCountRow = TagRow & {
  blip_count: number
}

const adminTagUpdateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(4000).optional().nullable(),
  coverImage: z.string().max(1000).optional().nullable(),
})

const mergeTagsSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
})

async function canCurrentRequestAccessAdminTags(): Promise<boolean> {
  const supabase = await getServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return false
  }

  const { data: profile, error: profileError } = await selectUserProfileRecord(
    supabase,
    user.id,
  )

  if (profileError || !profile) {
    return false
  }

  return profile.role === "admin" || profile.role === "superuser"
}

const mapAdminTagRecord = (row: TagWithCountRow): AdminTagRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  coverImage: row.cover_image,
  blipCount: row.blip_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function loadAdminTags(): Promise<AdminTagsQueryResult> {
  const authorized = await canCurrentRequestAccessAdminTags()
  if (!authorized) {
    return {
      authorized: false,
      tags: [],
      error: null,
    }
  }

  try {
    const adminClient = getAdminClient()
    
    const { data, error } = await adminClient
      .from("tags")
      .select(`
        id,
        name,
        description,
        cover_image,
        created_at,
        updated_at,
        blip_tags!inner(count)
      `)
      .order("name", { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    const tags: AdminTagRecord[] = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      coverImage: row.cover_image,
      blipCount: Array.isArray(row.blip_tags) ? row.blip_tags.length : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return {
      authorized: true,
      tags,
      error: null,
    }
  } catch (error) {
    console.error("Failed to load admin tags:", error)
    return {
      authorized: true,
      tags: [],
      error: "Unable to load tags right now.",
    }
  }
}

export async function updateAdminTag(
  tagId: string,
  payload: unknown,
): Promise<AdminTagUpdateResult> {
  const authorized = await canCurrentRequestAccessAdminTags()
  if (!authorized) {
    return {
      success: false,
      data: null,
      error: "Unauthorized",
    }
  }

  const parsed = adminTagUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      error: "Please provide a valid tag name, description, and cover image.",
    }
  }

  try {
    const adminClient = getAdminClient()
    
    const canonicalName = slugify(parsed.data.name)
    if (!canonicalName) {
      return {
        success: false,
        data: null,
        error: "Tag name must contain at least one valid character.",
      }
    }

    const { data: existingWithSameName, error: existingError } = await adminClient
      .from("tags")
      .select("id")
      .eq("name", canonicalName)
      .neq("id", tagId)
      .maybeSingle()

    if (existingError) {
      return {
        success: false,
        data: null,
        error: existingError.message,
      }
    }

    if (existingWithSameName) {
      return {
        success: false,
        data: null,
        error: `A tag with the name "${canonicalName}" already exists. Use the merge feature to combine tags.`,
        conflictingTagId: existingWithSameName.id,
      }
    }

    const { data: updatedTag, error: updateError } = await adminClient
      .from("tags")
      .update({
        name: canonicalName,
        description: parsed.data.description ?? null,
        cover_image: parsed.data.coverImage ?? null,
      })
      .eq("id", tagId)
      .select(`
        id,
        name,
        description,
        cover_image,
        created_at,
        updated_at
      `)
      .single()

    if (updateError) {
      return {
        success: false,
        data: null,
        error: updateError.message,
      }
    }

    const { count: blipCount } = await adminClient
      .from("blip_tags")
      .select("*", { count: "exact", head: true })
      .eq("tag_id", tagId)

    return {
      success: true,
      data: mapAdminTagRecord({
        ...(updatedTag as TagRow),
        blip_count: blipCount ?? 0,
      }),
      error: null,
    }
  } catch (error) {
    console.error("Failed to update admin tag:", error)
    return {
      success: false,
      data: null,
      error: "Unable to save tag changes right now.",
    }
  }
}

export async function mergeTags(payload: unknown): Promise<MergeTagsResult> {
  const authorized = await canCurrentRequestAccessAdminTags()
  if (!authorized) {
    return {
      success: false,
      error: "Unauthorized",
    }
  }

  const parsed = mergeTagsSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please provide valid source and target tag IDs.",
    }
  }

  if (parsed.data.sourceId === parsed.data.targetId) {
    return {
      success: false,
      error: "Source and target tags must be different.",
    }
  }

  try {
    const adminClient = getAdminClient()
    
    const { error: mergeError } = await adminClient.rpc("merge_tags", {
      source_id: parsed.data.sourceId,
      target_id: parsed.data.targetId,
    })

    if (mergeError) {
      return {
        success: false,
        error: mergeError.message,
      }
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    console.error("Failed to merge tags:", error)
    return {
      success: false,
      error: "Unable to merge tags right now.",
    }
  }
}
