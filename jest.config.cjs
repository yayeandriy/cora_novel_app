module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  transformIgnorePatterns: ['node_modules/(?!(@angular|@tauri-apps|rxjs)/)'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '@app/(.*)': '<rootDir>/src/app/$1',
    '@shared/(.*)': '<rootDir>/src/app/shared/$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          isolatedModules: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          lib: ['ES2020', 'dom']
        }
      }
    ],
    '^.+\\.mjs$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'esnext',
          target: 'ES2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        }
      }
    ]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/polyfills.ts'
  ]
};
