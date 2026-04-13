module.exports = {
  root: true,
  extends: ['prettier'],
  plugins: ['prettier'],
  ignorePatterns: [
    '**/.turbo',
    '**/dist',
    '**/node_modules',
    '**/.next',
    '**/coverage',
    '**/*.js',
    '**/*.json',
  ],
  rules: {
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: [
          './tsconfig.json',
          './apps/*/tsconfig.json',
          './packages/*/tsconfig.json',
        ],
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/explicit-function-return-type': 'warn',
      },
    },
    {
      // Next.js specific configuration for web app
      files: ['apps/web/**/*.{ts,tsx}'],
      extends: ['next/core-web-vitals', 'next/typescript'],
      rules: {
        // Downgrade some strict rules for Next.js development
        '@typescript-eslint/no-misused-promises': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'react-hooks/rules-of-hooks': 'warn',
        'react/no-unescaped-entities': 'warn',
        'jsx-a11y/role-has-required-aria-props': 'warn',
      },
    },
  ],
};
