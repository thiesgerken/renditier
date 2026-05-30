import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

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
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
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
    },
  },
];
