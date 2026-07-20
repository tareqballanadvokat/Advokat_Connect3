module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'testFactories.ts',
    'testHelpers.ts'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|svg|ttf|woff|woff2)$': '<rootDir>/src/__mocks__/fileMock.js',
    '^@store$': '<rootDir>/src/store/index',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@components/(.*)$': '<rootDir>/src/taskpane/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@infra/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@interfaces/(.*)$': '<rootDir>/src/types/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@taskpane/(.*)$': '<rootDir>/src/taskpane/$1',
    '^@config$': '<rootDir>/src/config/index',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@slices/(.*)$': '<rootDir>/src/store/slices/$1',
    '^@i18n$': '<rootDir>/src/i18n',
    // Mock DevExtreme components
    '^devextreme-react/(.*)$': '<rootDir>/src/__mocks__/devextremeMock.js',
    '^devextreme/(.*)$': '<rootDir>/src/__mocks__/devextremeMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/__tests__/**',
    '!src/__mocks__/**',
    '!src/commands/**', // Exclude commands as they're Office-specific
    '!src/**/testHelpers.ts', // Exclude test helper utilities
    '!src/**/testFactories.ts', // Exclude test data factories
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  }
};
