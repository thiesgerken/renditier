import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['node_modules/**', 'build/**', 'src/semantic/**'],
  },
  ...fixupConfigRules(compat.extends('airbnb', 'prettier')),
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'es5',
        },
      ],
      'react/no-array-index-key': 'off',
      'react/jsx-wrap-multilines': 'off',
      'react/jsx-one-expression-per-line': 'off',
      'react/jsx-curly-newline': 'off',
      'react/function-component-definition': 'off',
      'react/no-unstable-nested-components': 'off',
      'react/jsx-no-useless-fragment': 'off',
      'default-param-last': 'off',
      'arrow-body-style': 'off',
      'import/prefer-default-export': 'off',
      // React 19's automatic JSX runtime: importing React is unnecessary, and
      // with noUnusedLocals it is an error.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-filename-extension': ['error', { extensions: ['.jsx', '.tsx'] }],
      // TypeScript covers these; the airbnb JS equivalents misfire on .tsx.
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-shadow': 'off',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
