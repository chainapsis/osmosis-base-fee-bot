module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:import/typescript",
  ],
  plugins: ["unicorn", "import"],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    "prettier/prettier": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-empty-function": "warn",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/camelcase": "off",
    "unicorn/filename-case": [
      "error",
      {
        case: "kebabCase",
      },
    ],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
