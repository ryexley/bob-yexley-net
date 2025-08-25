import globals from "globals"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import prettierConfig from "eslint-config-prettier"
import pluginSolid from "eslint-plugin-solid"
import pluginA11y from "eslint-plugin-jsx-a11y"
import pluginImport from "eslint-plugin-import"
import pluginUnicorn from "eslint-plugin-unicorn"

export default [
  { ignores: ["**/build/**"] },
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      parser: tsParser,
      parserOptions: {
        // Use the latest ECMAScript version
        ecmaFeatures: {
          jsx: true, // Enable JSX parsing
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    ignores: ["!**/.server", "!**/.client"],
    plugins: {
      "jsx-a11y": pluginA11y,
      import: pluginImport,
      unicorn: pluginUnicorn,
      solid: pluginSolid,
      typescript: tsPlugin,
    },
    settings: {
      react: {
        // Automatically detect the installed React version
        version: "detect",
      },
      formComponents: ["Form"],
      linkComponents: [
        { name: "Link", linkAttribute: "to" },
        { name: "NavLink", linkAttribute: "to" },
      ],
    },
    rules: {
      ...pluginSolid.configs.recommended.rules,
      ...pluginA11y.configs.recommended.rules,
      ...prettierConfig.rules,
      // Basic ESLint rules
      // Enforce double quotes
      quotes: ["error", "double"],
      // No semicolons
      semi: ["error", "never"],
      // Warn about undefined variables
      "no-undef": "warn",
      // Warn about unused variables
      "no-unused-vars": "warn",
      // Filename casing rule from unicorn plugin
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase", // Enforce kebab-case for file names
        },
      ],
    },
  },
]
