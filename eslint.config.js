import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      ...js.configs.recommended.rules,
      // The game code is written in a compact style; keep lint focused on real mistakes.
      'no-empty': 'off',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-cond-assign': 'off',
      'no-sparse-arrays': 'off',
      'no-useless-assignment': 'off',
    },
  },
  { files: ['tests/**/*.js', '*.config.js'], languageOptions: { globals: { ...globals.node } } },
];
