import {
  defineConfig,
  coverageConfigDefaults,
  defaultExclude,
} from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...defaultExclude,
      '**/{.github,.stryker-tmp,.vscode,dist,gh-page,node_modules,reports,scripts,tmp}/**',
      '**/*{helper,types,tstyche}.spec[.][jt]s',
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
