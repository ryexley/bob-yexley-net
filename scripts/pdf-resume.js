/* eslint-disable */
const path = require("path")
const puppeteer = require("puppeteer")

(async () => {
  const pdfResumeHtml = path.resolve("../public/pdf-resume/index.html")
  const pdfResumePath = path.resolve("../public/pdf-resume/bob-yexley-resume.pdf")
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(`file://${pdfResumeHtml}`)
  await page.pdf({
    path: pdfResumePath,
    format: "Letter"
  })
  await browser.close()
})()
/* eslint-enable */
