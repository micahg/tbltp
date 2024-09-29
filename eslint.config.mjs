// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import globals from 'globals';

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
    files: ["packages/mui/**/*.tsx", "packages/mui/**/*.ts"],
    ...react.configs.flat.recommended,
    ...react.configs.flat['jsx-runtime'],
    plugins: {
      react,
    },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      parserOptions: {
        ecmaVersion: 'latest',
        project: './packages/mui/tsconfig.json',
        ecmaFeatures: {
          modules: true,
          jsx: true,
        },
        globals: {
          ...globals.serviceworker,
          ...globals.browser,
        }
      },
    }
  }
);