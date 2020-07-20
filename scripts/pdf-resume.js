/* eslint-disable */
const path = require("path");
const puppeteer = require("puppeteer");

(async () => {
  const pdfResumeHtml = path.resolve(path.join(__dirname, "../public/pdf-resume/index.html"))
  const pdfResumePath = path.resolve(path.join(__dirname, "../public/pdf-resume/bob-yexley-resume.pdf"))
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(`file://${pdfResumeHtml}`)
  await page.pdf({
    path: pdfResumePath,
    format: "Letter",
    scale: 0.85,
    margin: {
      top: "0.35in",
      bottom: "0.35in"
    }
  })
  await browser.close()
})()
/* eslint-enable */
