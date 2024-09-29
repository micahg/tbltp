// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reacthooks from 'eslint-plugin-react-hooks';
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
    },
    plugins: {
      react,
      'react-hooks': reacthooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // https://ru.legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html#eslint
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
    },
  }
);