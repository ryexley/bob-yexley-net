/**
 * HEIC decode probe — mirrors the production decode strategy in
 * src/modules/media/process.ts.
 *
 * Background: libheif 1.18+ is plugin-based and sharp's prebuilt binaries ship
 * AVIF but NOT the patent-encumbered HEVC decoder. So `sharp(heic).metadata()`
 * can succeed while a real pixel decode fails with "Support for this compression
 * format has not been built in". Production works around this by decoding
 * HEVC-HEIF via heic-convert (libde265 → WASM) and handing the JPEG to sharp.
 *
 * This probe reports (1) whether sharp can decode HEIC directly and (2) whether
 * the heic-convert → sharp fallback works. Run on linux/amd64 (Docker) to mirror
 * Vercel's Node serverless runtime:
 *
 *   docker run --rm --platform linux/amd64 ... node scripts/heic-decode-probe.cjs /in.heic
 */
const fs = require("node:fs")

const sharp = require(process.env.SHARP_PATH || "sharp")
const heicConvert = require(process.env.HEIC_CONVERT_PATH || "heic-convert")

const file = process.argv[2]
if (!file) {
  console.error("usage: node scripts/heic-decode-probe.cjs <path-to.heic>")
  process.exit(2)
}

async function main() {
  console.log(`platform: ${process.platform}/${process.arch}`)
  console.log(`sharp ${sharp.versions.sharp} / libvips ${sharp.versions.vips}`)

  const buf = fs.readFileSync(file)
  console.log(`file: ${file} (${buf.length} bytes)`)

  // Header read is itself guarded: modern iPhone HEICs (many `iref` refs) make
  // sharp's libheif throw even here, which is exactly the case we route around.
  try {
    const meta = await sharp(buf).metadata()
    console.log(
      `sharp header read: OK (format=${meta.format} ${meta.width}x${meta.height} compression=${meta.compression})`,
    )
  } catch (error) {
    console.log(`sharp header read: FAILED (${error.message.split("\n")[0]})`)
  }

  let sharpDirect = false
  try {
    await sharp(buf, { failOn: "none" }).resize({ width: 200 }).webp().toBuffer()
    sharpDirect = true
  } catch (error) {
    console.log(`sharp direct decode: FAILED (${error.message.split("\n")[0]})`)
  }
  if (sharpDirect) {
    console.log("sharp direct decode: OK (no heic-convert needed on this build)")
  }

  // Production fallback path: heic-convert (WASM) -> JPEG -> sharp -> WebP.
  const jpeg = Buffer.from(
    await heicConvert({ buffer: buf, format: "JPEG", quality: 0.92 }),
  )
  const out = await sharp(jpeg, { failOn: "none" })
    .rotate()
    .resize({ width: 200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })

  console.log(
    `heic-convert -> JPEG ${jpeg.length}b -> WebP ${out.info.width}x${out.info.height} (${out.info.size}b)`,
  )
  console.log("RESULT: HEIC decode SUPPORTED via heic-convert fallback")
}

main().catch(error => {
  console.error(`HEIC fallback FAILED: ${error.message}`)
  console.error("RESULT: HEIC decode NOT SUPPORTED")
  process.exit(1)
})
