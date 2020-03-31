const path = require("path")
const fs = require("fs")
const { format } = require("date-fns")

module.exports = function(plop) {
  plop.setHelper("timestamp", () => format(new Date(), "yyyy-MM-dd"))

  plop.setActionType(
    "copyHeroImageAsDefaultCoverImage",
    function(answers, config) {
      try {
        const {
          handlebars: {
            helpers: {
              timestamp,
              dashCase
            }
          }
        } = plop

        const sourceImagePath = path.resolve(
          "./src/images/png/hero-background.png"
        )
        const targetImagePath = path.resolve(
          `./content/posts/${timestamp()}--${dashCase(answers.title)}/cover.png`
        )
        fs.copyFileSync(sourceImagePath, targetImagePath)

        return Promise.resolve()
      } catch (error) {
        return Promise.reject(error)
      }
    }
  )

  plop.setGenerator("blog-post", {
    prompts: [
      {
        type: "input",
        name: "title",
        message: "Blog Post Title"
      },
      {
        type: "list",
        name: "category",
        message: "Category",
        choices: [
          "faith",
          "family",
          "hunting",
          "fishing",
          "software development",
          "miscellaneous"
        ]
      },
      {
        type: "checkbox",
        name: "tags",
        message: "Tags",
        choices: [
          "miscellaneous",
          "family",
          "faith",
          "hunting",
          "elk",
          "fishing",
          "backpacking",
          "software development",
          "howto",
          "web development",
          "javascript",
          "html",
          "css"
        ]
      }
    ],
    actions: data => {
      data.tags = data.tags.map(tag => decodeURI(`"${tag}"`)).join(", ")

      return [
        {
          type: "add",
          path: "./content/posts/{{timestamp}}--{{dashCase title}}/index.md",
          templateFile: "./generator-templates/blog-post.hbs"
        },
        {
          type: "copyHeroImageAsDefaultCoverImage",
          path: "./content/posts/{{timestamp}}--{{dashCase title}}/"
        }
      ]
    }
  })
}
