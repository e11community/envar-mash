module.exports = {
  root: true,
  plugins: ['node', 'prettier'],
  ignorePatterns: ['**/dist/**/*', '**/node_modules/**'],
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended'],
      parserOptions: {
        project: ['tsconfig.json'],
        createDefaultProgram: true,
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-console': 'error',
        'no-underscore-dangle': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/dot-notation': 'off',
        'prefer-arrow/prefer-arrow-functions': 'off',
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/no-empty-interface': 'warn',
        '@typescript-eslint/ban-ts-comment': 'warn',
        // 'arrow-body-style': ['warn', 'never'],
        '@typescript-eslint/explicit-module-boundary-types': 'off', // Consider requiring return types
        '@typescript-eslint/ban-types': ['error', {extendDefaults: true, types: {object: false}}], // turn off linting for object type
      },
    },
  ],
}
