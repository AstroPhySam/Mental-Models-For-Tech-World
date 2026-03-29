/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // Use the ESM preset for ts-jest
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    // This handles the .js extensions in imports if you use them
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    // Use ts-jest to transform files with ESM support
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
};
