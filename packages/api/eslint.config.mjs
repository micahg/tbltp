// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierconfig from "eslint-config-prettier";
import prettierplugin from "eslint-plugin-prettier/recommended";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // ...tseslint.configs.recommendedTypeChecked,
  prettierplugin,
  {
    files: ["src/server.ts", "src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: "latest",
        project: "tsconfig.json",
      },
    },
  },
  prettierconfig,
];
