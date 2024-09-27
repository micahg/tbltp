// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["packages/api/src/server.ts", "packages/api/src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: 'latest',
        project: './packages/api/tsconfig.json',
      },
    },
  },
  {
    files: [
      // "packages/mui/src/index.tsx",
      "packages/mui/**/*.tsx",
      "packages/mui/**/*.ts"
    ],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: 'latest',
        project: './packages/mui/tsconfig.json',
      },
    }
  }
);