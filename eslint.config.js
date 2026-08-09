import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'vite.config.ts',
      'eslint.config.js',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // StorageService is deliberately async (swappable to IndexedDB later,
    // §4.4). The sync-backed localStorage adapter has no awaits to await —
    // that's by design, not accidental.
    files: ['src/services/**/*Adapter.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Context providers conventionally co-locate their hook
    // (`useStorage`) with the component — that's not a fast-refresh hazard
    // worth splitting files over.
    files: ['src/**/*Provider.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  prettier,
);
