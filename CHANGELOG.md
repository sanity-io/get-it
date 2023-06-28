<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [8.1.4](https://github.com/sanity-io/get-it/compare/v8.1.3...v8.1.4) (2023-06-28)

### Bug Fixes

- **deps:** update dependency typescript to v5.1.5 ([#142](https://github.com/sanity-io/get-it/issues/142)) ([63b72d8](https://github.com/sanity-io/get-it/commit/63b72d857a721eed206fb2ca9fe0c9aa56bdbf03))

## [8.1.3](https://github.com/sanity-io/get-it/compare/v8.1.2...v8.1.3) (2023-05-15)

### Bug Fixes

- remove debug code ([a9eca1f](https://github.com/sanity-io/get-it/commit/a9eca1fe7ab51d6b0dacc2aeb447f72936d2a8b4))

## [8.1.2](https://github.com/sanity-io/get-it/compare/v8.1.1...v8.1.2) (2023-05-11)

### Bug Fixes

- add missing attemptNumber argument to retry option typings ([#113](https://github.com/sanity-io/get-it/issues/113)) ([5713f87](https://github.com/sanity-io/get-it/commit/5713f87518014ea86843eab3f74e1fb78435b157))
- produce error instances from xhr error & timeout event callbacks ([#127](https://github.com/sanity-io/get-it/issues/127)) ([6169b6a](https://github.com/sanity-io/get-it/commit/6169b6a31d912803fad01f524828d92f6f8677a0))

## [8.1.1](https://github.com/sanity-io/get-it/compare/v8.1.0...v8.1.1) (2023-03-24)

### Bug Fixes

- **fetch:** check for existence of `EventTarget` before using ([b31db80](https://github.com/sanity-io/get-it/commit/b31db803cc0215db39092d22c2f032b866605d4f))

## [8.1.0](https://github.com/sanity-io/get-it/compare/v8.0.11...v8.1.0) (2023-03-23)

### Features

- add `edge-light` export condition ([#106](https://github.com/sanity-io/get-it/issues/106)) ([30dddb7](https://github.com/sanity-io/get-it/commit/30dddb752e22d524f63530f67793b88b3b185485))

## [8.0.11](https://github.com/sanity-io/get-it/compare/v8.0.10...v8.0.11) (2023-03-14)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^2.2.10 ([#98](https://github.com/sanity-io/get-it/issues/98)) ([e6b69bf](https://github.com/sanity-io/get-it/commit/e6b69bf9645304fa400e621881c722da6ae952f2))

## [8.0.10](https://github.com/sanity-io/get-it/compare/v8.0.9...v8.0.10) (2023-03-06)

### Bug Fixes

- **deps:** update devdependencies (non-major) ([#90](https://github.com/sanity-io/get-it/issues/90)) ([5b96189](https://github.com/sanity-io/get-it/commit/5b961899254c3bd3d87a6afe787652261e228e2e))

## [8.0.9](https://github.com/sanity-io/get-it/compare/v8.0.8...v8.0.9) (2023-01-25)

### Bug Fixes

- use commonjs for legacy middleware export ([#78](https://github.com/sanity-io/get-it/issues/78)) ([1d7c50a](https://github.com/sanity-io/get-it/commit/1d7c50acb4df647cb621936a383d3d76d021372a))

## [8.0.8](https://github.com/sanity-io/get-it/compare/v8.0.7...v8.0.8) (2023-01-23)

### Bug Fixes

- improve legacy ESM support ([d622f1c](https://github.com/sanity-io/get-it/commit/d622f1c10de588a08e62ab4326aca396f89323bb))

## [8.0.7](https://github.com/sanity-io/get-it/compare/v8.0.6...v8.0.7) (2023-01-18)

### Bug Fixes

- replace `create-error-class` with native `Error` ([3056ed1](https://github.com/sanity-io/get-it/commit/3056ed1e9cd73f1f209ed7e7cf6c0350c94c859e))
- replace `form-urlencoded` with native APIs ([d56750c](https://github.com/sanity-io/get-it/commit/d56750c39dc26cee19fcd507c3416bf6c74aa3a2))

## [8.0.6](https://github.com/sanity-io/get-it/compare/v8.0.5...v8.0.6) (2023-01-14)

### Bug Fixes

- **deps:** update devdependencies (non-major) ([#67](https://github.com/sanity-io/get-it/issues/67)) ([23f3c1d](https://github.com/sanity-io/get-it/commit/23f3c1d0ec0d1c755c258a29719d2757c827a2bb))

## [8.0.5](https://github.com/sanity-io/get-it/compare/v8.0.4...v8.0.5) (2023-01-11)

### Bug Fixes

- replace `url-parse` with native `URL` ([f6317e3](https://github.com/sanity-io/get-it/commit/f6317e3575b8eda713e66730dc0bff81f018826e))

## [8.0.4](https://github.com/sanity-io/get-it/compare/v8.0.3...v8.0.4) (2023-01-10)

### Bug Fixes

- improve `fetch` fallback, drop dead IE legacy ([#64](https://github.com/sanity-io/get-it/issues/64)) ([8fe6734](https://github.com/sanity-io/get-it/commit/8fe6734a61e3c183d0b0b776ebc711674d3de387))

## [8.0.3](https://github.com/sanity-io/get-it/compare/v8.0.2...v8.0.3) (2023-01-09)

### Bug Fixes

- add support for deno and worker conditions ([5a1a263](https://github.com/sanity-io/get-it/commit/5a1a2636f4a07146008b9f928c569361d258f1d1))

## [8.0.2](https://github.com/sanity-io/get-it/compare/v8.0.1...v8.0.2) (2023-01-06)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^2.1.1 ([#51](https://github.com/sanity-io/get-it/issues/51)) ([2937fcc](https://github.com/sanity-io/get-it/commit/2937fcc409ad8550c50372f58362f1128088ea20))

## [8.0.1](https://github.com/sanity-io/get-it/compare/v8.0.0...v8.0.1) (2023-01-04)

### Bug Fixes

- typo in `pkg.typesVersions` ([03ead62](https://github.com/sanity-io/get-it/commit/03ead6283f0e0a6db5ca73974a3c206649567242))

## [8.0.0](https://github.com/sanity-io/get-it/compare/v7.0.2...v8.0.0) (2023-01-04)

### ⚠ BREAKING CHANGES

- umd builds are removed and all middleware imports are moved to `get-it/middleware`. Imports such as `import promise from 'get-it/lib-node/middleware/promise'` are no longer supported. The default import is replaced with a named one: change `import getIt from 'get-it'` to `import {getIt} from 'get-it'`

Other changes

- Migrated codebase to TypeScript, moving away from using `any` is out of scope for this PR but linter rules are setup to make it easier to do this refactor in a later PR.
- The required Node.js version is moved from 12 to 14, as 12 does not support `pkg.exports`.
- Tooling have moved to `@sanity/pkg-utils`, gone is `@babel/cli`, `browserify`, `esbuild`, `uglifyjs`, and more.
- Replaced `mocha` testing suite with `vitest` to ensure the new ESM codebase runs the same way it'll run in production with codebases such as `sanity`.
- The `pkg.exports` are refactored to follow our updated ESM best practices, spearheaded by `@sanity/pkg-utils`. It implements the Node.js `dual package hazard` technique to steer the Node.js ESM runtime back into CJS mode as half our `dependencies` aren't shipping ESM-runtime code yet.

### Features

- full Node.js ESM runtime support ([#54](https://github.com/sanity-io/get-it/issues/54)) ([ab8a4fd](https://github.com/sanity-io/get-it/commit/ab8a4fd4ffbea0711defce6df564bb2ab315c0d2)), closes [/github.com/sanity-io/get-it/blob/8fecf9ff77e8805bb9ae1aac74b74d4d786a11ca/package.json#L42-L154](https://github.com/sanity-io//github.com/sanity-io/get-it/blob/8fecf9ff77e8805bb9ae1aac74b74d4d786a11ca/package.json/issues/L42-L154) [/github.com/sanity-io/get-it/blob/8fecf9ff77e8805bb9ae1aac74b74d4d786a11ca/package.json#L18-L41](https://github.com/sanity-io//github.com/sanity-io/get-it/blob/8fecf9ff77e8805bb9ae1aac74b74d4d786a11ca/package.json/issues/L18-L41)

### Bug Fixes

- **deps:** update dependency is-stream to v2 ([#43](https://github.com/sanity-io/get-it/issues/43)) ([6dbeffc](https://github.com/sanity-io/get-it/commit/6dbeffca1c5336203be5951aa194cdd253d865a7))

## [7.0.2](https://github.com/sanity-io/get-it/compare/v7.0.1...v7.0.2) (2022-09-27)

### Bug Fixes

- **deps:** lock file maintenance ([#48](https://github.com/sanity-io/get-it/issues/48)) ([6d4f65f](https://github.com/sanity-io/get-it/commit/6d4f65fb136920f8bec090dd776294d70b2d25ad))

## [7.0.1](https://github.com/sanity-io/get-it/compare/v7.0.0...v7.0.1) (2022-09-15)

### Bug Fixes

- **deps:** update dependencies (non-major) ([#30](https://github.com/sanity-io/get-it/issues/30)) ([7ce1d82](https://github.com/sanity-io/get-it/commit/7ce1d822bf157850e3605d21b7a78b48242774c2))

## [7.0.0](https://github.com/sanity-io/get-it/compare/v6.1.1...v7.0.0) (2022-09-15)

### ⚠ BREAKING CHANGES

- Adding ESM support is a significant change. Although a tremendous effort is made to preserve backward compatibility it can't be guaranteed as there are too many conditions, environments, and runtime versions to cover them all.

### Features

- ESM support ([#25](https://github.com/sanity-io/get-it/issues/25)) ([7d5b5a6](https://github.com/sanity-io/get-it/commit/7d5b5a6ccb2699b6db461b720cbf250eb98036f6))
