import { isEmpty } from "@/util"
import { random } from "@/util/random"
import { getEnv } from "@/util/env"

export const placeholderBackgroundColorOptions = [
  "rgba(23, 22, 37, 0.3)",
  "rgba(20, 26, 21, 0.3)",
  "rgba(16, 27, 32, 0.3)",
  "rgba(32, 19, 24, 0.3)",
  "rgba(26, 25, 27, 0.3)",
  "rgba(17, 26, 39, 0.3)",
  "rgba(30, 22, 15, 0.3)",
  "rgba(21, 26, 16, 0.3)",
  "rgba(24, 36, 73, 0.3)",
  "rgba(55, 23, 47, 0.3)",
  "rgba(55, 23, 47, 0.3)",
  "rgba(33, 34, 37, 0.3)",
  "rgba(9, 44, 43, 0.3)",
]

export const randomInt = (min = 0, max = 100) => random(min, max)

export function generateRandomRadialGradients({
  palette = placeholderBackgroundColorOptions,
  count = randomInt(3, 7),
  blurSize = 150,
} = {}) {
  const gradients = []

  for (let i = 0; i < count; i++) {
    const color = palette[randomInt(0, palette.length - 1)]
    const x = randomInt(0, 100)
    const y = randomInt(0, 100)
    const size = randomInt(50, blurSize) + blurSize / 2

    gradients.push(
      `radial-gradient(circle ${size}px at ${x}% ${y}%, ${color} 0%, transparent ${size}%)`,
    )
  }

  return gradients.join(", ")
}

export const ASPECT_RATIOS = {
  "1:1": 1, // 1:1 (square)
  "4:3": 4 / 3, // 4:3
  "16:9": 16 / 9, // 16:9
  "3:2": 3 / 2, // 3:2
  "2:3": 2 / 3, // 2:3
  "9:16": 9 / 16, // 9:16
}
export const DEFAULT_ASPECT_RATIO = ASPECT_RATIOS["16:9"]

export function parseDimension(dimension, baseFontSize = 16) {
  if (typeof dimension === "number") {
    return dimension
  }

  if (typeof dimension === "string") {
    const trimmed = dimension.trim()

    // Handle percentage and viewport units
    if (
      trimmed.endsWith("%") ||
      trimmed.endsWith("vw") ||
      trimmed.endsWith("vh")
    ) {
      return trimmed
    }

    // Handle pixel units
    const pxMatch = trimmed.match(/^(\d+(\.\d+)?)(px)$/)
    if (pxMatch) {
      return parseFloat(pxMatch[1])
    }

    // Handle rem/em units
    const remOrEmMatch = trimmed.match(/^(\d+(\.\d+)?)(rem|em)$/)
    if (remOrEmMatch) {
      const numericValue = parseFloat(remOrEmMatch[1])
      return numericValue * baseFontSize
    }
  }

  return null
}

export function getDimensions({ width, height }, baseFontSize = 16) {
  const parsedWidth = parseDimension(width, baseFontSize)
  const parsedHeight = parseDimension(height, baseFontSize)

  // If both dimensions are empty or both are 100%, return default dimensions
  if (
    (isEmpty(parsedHeight) && isEmpty(parsedWidth)) ||
    (parsedWidth === "100%" && parsedHeight === "100%")
  ) {
    return {
      width: "100%",
      height: "100%",
      aspectRatio: DEFAULT_ASPECT_RATIO,
    }
  }

  // If only width is provided
  if (!isEmpty(parsedWidth) && isEmpty(parsedHeight)) {
    const widthValue = typeof parsedWidth === "number" ? parsedWidth : "100%"
    const heightValue =
      typeof parsedWidth === "number"
        ? `${parsedWidth / DEFAULT_ASPECT_RATIO}px`
        : `${100 / DEFAULT_ASPECT_RATIO}%`

    return {
      width: widthValue,
      height: heightValue,
      aspectRatio: DEFAULT_ASPECT_RATIO,
    }
  }

  // If only height is provided
  if (isEmpty(parsedWidth) && !isEmpty(parsedHeight)) {
    const heightValue = typeof parsedHeight === "number" ? parsedHeight : "100%"
    const widthValue =
      typeof parsedHeight === "number"
        ? `${parsedHeight * DEFAULT_ASPECT_RATIO}px`
        : `${100 * DEFAULT_ASPECT_RATIO}%`

    return {
      width: widthValue,
      height: heightValue,
      aspectRatio: DEFAULT_ASPECT_RATIO,
    }
  }

  // If both dimensions are provided
  return {
    width: parsedWidth,
    height: parsedHeight,
    aspectRatio:
      typeof parsedWidth === "number" && typeof parsedHeight === "number"
        ? parsedWidth / parsedHeight
        : DEFAULT_ASPECT_RATIO,
  }
}

export function resolveContainerDimension(parsedDimension) {
  if (typeof parsedDimension === "string" && parsedDimension.endsWith("%")) {
    return parsedDimension
  }

  if (typeof parsedDimension === "number" && parsedDimension > 0) {
    return `${parsedDimension}px`
  }

  if (parsedDimension === 0 || parsedDimension === "0px") {
    return undefined
  }

  return parsedDimension
}

export const imageUrl = (id: string): string => {
  const cloudName = getEnv().CLOUDINARY_CLOUD_NAME
  if (!cloudName) {
    console.warn(
      "CLOUDINARY_CLOUD_NAME not configured in environment variables",
    )
    return ""
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/${id}`
}
