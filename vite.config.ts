import {
  defineConfig,
  coverageConfigDefaults,
  defaultExclude,
} from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...defaultExclude, 'tmp/**', 'gh-page/**'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './gh-page/coverage',
      exclude: [
        ...coverageConfigDefaults.exclude,
        'destination/**',
        'tmp/**',
        'errors.[jt]s',
        '**/{scratchpad,index,logObjectPretty}[.][jt]s',
      ],
    },
  },
});
