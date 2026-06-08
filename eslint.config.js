import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Allow co-locating non-component constants (e.g. the `C` design tokens)
      // alongside components — the recommended setting for Vite + Fast Refresh.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-await-in-loop': 'error',
      // ignoreRestSiblings: destructuring siblings out of a rest spread
      // (e.g. `const { id, ...rest } = obj`) is a deliberate omit pattern, not dead code.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['backend/src/**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      'no-await-in-loop': 'error',
    },
  },
])
