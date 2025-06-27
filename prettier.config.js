/** @type {import('prettier').Config} */
module.exports = {
  semi: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 120,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  jsxSingleQuote: false,
  quoteProps: "as-needed",
  bracketSameLine: false,
  plugins: ["prettier-plugin-tailwindcss"],
}
