import {
  defineConfig,
  coverageConfigDefaults,
  defaultExclude,
} from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...defaultExclude,
      '**/{tmp,gh-page,.stryker-tmp,.github,.vscode,reports,scripts}/**',
    ],
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
