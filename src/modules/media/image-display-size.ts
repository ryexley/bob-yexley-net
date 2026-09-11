export type ImageDisplaySize = {
  width: number
  height: number
}

const BITMAP_TIMEOUT_MS = 2500

const isJsdom =
  typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Display-oriented pixel size of a local image file, honoring EXIF rotation
 * when the browser supports `createImageBitmap({ imageOrientation: "from-image" })`.
 * Returns null in SSR/tests or when the file cannot be decoded.
 */
export async function readImageDisplaySize(
  file: File,
): Promise<ImageDisplaySize | null> {
  if (typeof createImageBitmap === "function" && !isJsdom) {
    try {
      const bitmap = await withTimeout(
        createImageBitmap(file, {
          imageOrientation: "from-image",
        }),
        BITMAP_TIMEOUT_MS,
      )
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      if (size.width > 0 && size.height > 0) {
        return size
      }
    } catch {
      // Fall through to the <img> path.
    }
  }

  if (typeof document === "undefined" || typeof URL === "undefined") {
    return null
  }

  const url = URL.createObjectURL(file)
  try {
    const image = document.createElement("img")
    const size = await withTimeout(
      new Promise<ImageDisplaySize | null>(resolve => {
        image.onload = () => {
          const width = image.naturalWidth
          const height = image.naturalHeight
          resolve(width > 0 && height > 0 ? { width, height } : null)
        }
        image.onerror = () => resolve(null)
        image.src = url
      }),
      isJsdom ? 50 : BITMAP_TIMEOUT_MS,
    )
    return size
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
