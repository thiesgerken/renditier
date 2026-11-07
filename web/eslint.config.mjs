import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPackage from 'react/package.json' with { type: 'json' };

export default defineConfig(
  {
    ignores: ['node_modules/**', 'build/**', 'src/semantic/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      // eslint-plugin-react's `detect` calls context.getFilename(), which
      // ESLint 10 removed.
      react: { version: reactPackage.version },
    },
    rules: {
      // TypeScript checks the props.
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Flags every `() => dispatch(…)` and `() => navigate(…)` shorthand;
      // the void they return is never used by mistake.
      '@typescript-eslint/no-confusing-void-expression': 'off',
      // Numbers in template literals are meant as they are; formatting goes
      // through format.ts where it matters.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      // Its findings are generics that name the expected shape of untyped data
      // (JSON.parse, recharts payloads) at the call site.
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  {
    // the service worker is plain JavaScript outside the TypeScript project
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  }
);
