import eslint from '@eslint/js'
import {defineConfig} from 'eslint/config'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {ignores: ['coverage', 'dist', 'node_modules', 'test-esm', 'test-deno']},
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'no-console': 'error',
      'no-shadow': 'error',
      'no-warning-comments': ['warn', {location: 'start', terms: ['todo', '@todo', 'fixme']}],
    },
  },
)
