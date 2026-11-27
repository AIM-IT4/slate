const path = require('node:path');
const babel = require.resolve('babel-jest', { paths: [require.resolve('jest-expo/package.json')] });
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: [
    '**/secureJson.test.ts',
    '**/backupSecrets.test.ts',
    '**/providerUrlSecurity.test.ts',
    '**/slateProviderFetch.test.ts',
    '**/onboardingDestination.test.ts',
    '**/slateLocalOnboarding.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': path.join(__dirname, 'src/$1'),
    '^@cherrystudio/universal/(.*)$': path.join(__dirname, 'packages/universal/src/$1'),
  },
  transform: {
    '^.+\\.[jt]sx?$': [
      babel,
      { configFile: false, presets: [require.resolve('babel-preset-expo')] },
    ],
  },
};
