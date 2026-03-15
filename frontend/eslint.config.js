import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// "enforced" ma progressivo:
// - nuove regole più severe, però senza bloccare subito tutta la codebase
// - possiamo alzare gradualmente la severità (da warn -> error) per cartelle mirate

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // progressive: oggi warn, domani error (per cartelle/nuovo codice)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // non blocchiamo la build su questi per ora
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // regole mirate: in futuro possiamo farle diventare error su src/api e src/hooks
  {
    files: ['src/api/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      // già abbastanza utile tenerla a warn per ora
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
