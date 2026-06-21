/**
 * r2Service — stateless client-side adapter for the blip media R2 endpoints.
 *
 * The only module that knows the API route paths and the public storage base URL.
 * Holds no state. All mutating operations are server-mediated so R2 credentials
 * never reach the browser.
 *
 * Note: methods take plain params rather than Uppy file objects so this layer
 * stays free of any Uppy coupling. The Phase 3 `uploadStore` adapts Uppy's
 * `@uppy/aws-s3` hooks onto these calls.
 */
import { api } from "@/urls"
import type {
  CompleteMultipartResponse,
  CreateMultipartResponse,
  ListPartsResponse,
  MediaResult,
  SignUploadResponse,
  UploadPart,
} from "./types"

async function request<T>(
  url: string,
  method: "POST" | "DELETE",
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

  let payload: MediaResult<T> | null = null
  try {
    payload = (await response.json()) as MediaResult<T>
  } catch {
    payload = null
  }

  if (!response.ok || !payload || payload.error || payload.data == null) {
    const message = payload?.error || `Request to ${url} failed (${response.status})`
    throw new Error(message)
  }

  return payload.data
}

/** Strip a single trailing slash so key concatenation is clean. */
function storageBaseUrl(): string {
  const base = import.meta.env.VITE_MEDIA_STORAGE_URL || ""
  if (!base) {
    console.warn("VITE_MEDIA_STORAGE_URL is not configured")
  }
  return base.replace(/\/+$/, "")
}

export const r2Service = {
  // --- Single-PUT uploads (< 100MB) ---
  async getUploadParameters(params: {
    key: string
    contentType: string
  }): Promise<SignUploadResponse & { fields: Record<string, never> }> {
    const signed = await request<SignUploadResponse>(api.media.sign, "POST", params)
    return { ...signed, fields: {} }
  },

  // --- Multipart uploads (> 100MB) ---
  createMultipartUpload(params: {
    key: string
    contentType: string
  }): Promise<CreateMultipartResponse> {
    return request<CreateMultipartResponse>(api.media.multipart.create, "POST", params)
  },

  async signPart(params: {
    key: string
    uploadId: string
    partNumber: number
  }): Promise<string> {
    const { url } = await request<{ url: string }>(
      api.media.multipart.signPart,
      "POST",
      params,
    )
    return url
  },

  async listParts(params: {
    key: string
    uploadId: string
  }): Promise<UploadPart[]> {
    const { parts } = await request<ListPartsResponse>(
      api.media.multipart.listParts,
      "POST",
      params,
    )
    return parts
  },

  completeMultipartUpload(params: {
    key: string
    uploadId: string
    parts: UploadPart[]
  }): Promise<CompleteMultipartResponse> {
    return request<CompleteMultipartResponse>(api.media.multipart.complete, "POST", params)
  },

  async abortMultipartUpload(params: {
    key: string
    uploadId: string
  }): Promise<void> {
    await request<{ aborted: true }>(api.media.multipart.abort, "POST", params)
  },

  /**
   * Upload a small object (e.g. a generated video/GIF thumbnail) directly to R2
   * via a single signed PUT. Used for the client-extracted `-thumb.webp` frame,
   * which is always well under the multipart threshold. The signed PUT is
   * CORS-subject (handoff: bucket exposes `PUT` for the app origins).
   */
  async uploadObject(params: {
    key: string
    body: Blob
    contentType: string
  }): Promise<void> {
    const signed = await request<SignUploadResponse>(api.media.sign, "POST", {
      key: params.key,
      contentType: params.contentType,
    })
    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: params.body,
    })
    if (!response.ok) {
      throw new Error(`Upload to R2 failed (${response.status})`)
    }
  },

  // --- Shared ---
  async deleteObject(key: string): Promise<void> {
    await request<{ deleted: true }>(api.media.object, "DELETE", { key })
  },

  /** Pure function — build a public URL for a stored object key. */
  getPublicUrl(key: string): string {
    return `${storageBaseUrl()}/${key.replace(/^\/+/, "")}`
  },
}

export type R2Service = typeof r2Service
