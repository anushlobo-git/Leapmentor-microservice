module.exports = {
  root: true,
  env: { es2022: true, node: true },
  extends: ["eslint:recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "commonjs" },
  ignorePatterns: ["**/node_modules/**", "**/coverage/**", "**/logs/**", "**/uploads/**"],
  rules: {
    "no-console": "off",
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-undef": "error",
    eqeqeq: ["error", "always"],
  },
};
