/**
 * Shared request/response contracts for the blip media R2 endpoints.
 *
 * Safe to import from both client (`r2Service`) and server (`server.ts`) —
 * contains no server-only code or credentials.
 */

export type UploadPart = {
  PartNumber: number
  ETag: string
}

// POST /api/media/sign
export type SignUploadRequest = {
  key: string
  contentType: string
}
export type SignUploadResponse = {
  method: "PUT"
  url: string
  headers: { "Content-Type": string }
}

// POST /api/media/multipart/create
export type CreateMultipartRequest = {
  key: string
  contentType: string
}
export type CreateMultipartResponse = {
  uploadId: string
  key: string
}

// POST /api/media/multipart/sign-part
export type SignPartRequest = {
  key: string
  uploadId: string
  partNumber: number
}
export type SignPartResponse = {
  url: string
}

// POST /api/media/multipart/list-parts
export type ListPartsRequest = {
  key: string
  uploadId: string
}
export type ListPartsResponse = {
  parts: UploadPart[]
}

// POST /api/media/multipart/complete
export type CompleteMultipartRequest = {
  key: string
  uploadId: string
  parts: UploadPart[]
}
export type CompleteMultipartResponse = {
  location?: string
}

// POST /api/media/multipart/abort
export type AbortMultipartRequest = {
  key: string
  uploadId: string
}

// DELETE /api/media/object
export type DeleteObjectRequest = {
  key: string
}

// POST /api/media/process
export type ProcessMediaRequest = {
  // Full object key of the uploaded original, i.e. `<storage_key>-original.<ext>`.
  key: string
}
export type ProcessedVariantInfo = {
  key: string
  width: number
  height: number
}
export type ProcessMediaResponse = {
  // Base storage key (no `-original`, no extension) variants are derived from.
  storageKey: string
  original: { width: number; height: number; format: string }
  variants: {
    micro: ProcessedVariantInfo
    small: ProcessedVariantInfo
    medium: ProcessedVariantInfo
    large: ProcessedVariantInfo
  }
}

/** Discriminated result returned by every media server operation. */
export type MediaResult<T> = {
  data: T | null
  error: string | null
  status: number
}
