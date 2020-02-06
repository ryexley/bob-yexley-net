const { format } = require("date-fns")

module.exports = function(plop) {
  plop.setHelper("timestamp", () => format(new Date(), "yyyy-MM-dd"))

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
        }
      ]
    }
  })
}
