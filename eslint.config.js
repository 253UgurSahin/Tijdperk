import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/**', 'dist-artifact/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      // De spelcode is compact geschreven; lint let vooral op echte fouten.
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-sparse-arrays': 'off',
      'no-useless-assignment': 'off',
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
  { files: ['tests/**/*.ts', '*.config.*'], languageOptions: { globals: { ...globals.node } } },
);
