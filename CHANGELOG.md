<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
