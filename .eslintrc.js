module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'airbnb-base',
    'plugin:sonarjs/recommended-legacy',
    'plugin:prettier/recommended',
  ],
  plugins: ['@typescript-eslint', 'sonarjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    extraFileExtensions: ['.json'],
  },
  ignorePatterns: [
    'vite.config.ts',
    'vite-env.d.ts',
    '.eslintrc.js',
    'node_modules/',
    'dist/',
    'coverage/',
    'storybook-static/',
    'lint-staged.config.js',
    'nest-cli.json',
    'tsconfig.json',
    'commitlint.config.js',
    '*.min.js',
    'src/db/client.ts',
    'jest.unit.ts',
    '**/src/gql/graphql.ts',
  ],
  rules: {
    // Swapping to require NOT using default export
    'import/prefer-default-export': 'off',
    'import/no-default-export': 'error',

    // ++ is ok in loops
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],

    // keeps conflicting with prettier
    'operator-linebreak': 'off', 
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      extends: [
        'airbnb-typescript/base',
        'plugin:prettier/recommended',
      ],
      rules: {
        // Set by airbnb-typescript/base, so need to be overruled here
        'import/extensions': [
          'warn',
          'never',
          {
            json: 'always',
            // NestJS exceptions
            module: 'ignorePackages',
            service: 'ignorePackages',
            controller: 'ignorePackages',
            dto: 'ignorePackages',
            entity: 'ignorePackages',
            resolver: 'ignorePackages',
            spec: 'ignorePackages',
          },
        ],
      }
    },
    {
      files: ['package.json'],
      parserOptions: {
        project: null, // unset parserOptions.project for this file
      },
      plugins: ['package-json-dependencies'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'sonarjs/no-duplicate-string': 'off',
        quotes: ['warn', 'double'],
        'object-curly-spacing': ['warn', 'always'],
        indent: ['warn', 2],
        'no-unused-expressions': 'off',
        'package-json-dependencies/caret-or-tilde': [
          'warn',
          // Playwright is quite fradgile and storybook already imports the latest ^ version.
          // Version miss matches will cause errors/stop playwright running, so this is the lesser of two evils.
          { ignorePackages: ['@playwright/test'] },
        ],
      },
    },
    {
      extends: ['plugin:storybook/recommended'],
      files: [
        '*.spec.ts*',
        '*.spec.js*',
        '**/*.stories.ts*',
        '**/*.stories.js',
        '**/*.stories.broken.ts*',
      ],
      rules: {
        'import/no-extraneous-dependencies': [
          'warn',
          {
            devDependencies: true,
          },
        ],
      },
    },
  ],
};