<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [8.6.10](https://github.com/sanity-io/get-it/compare/v8.6.9...v8.6.10) (2025-06-30)

### Bug Fixes

- **deps:** update dependency debug to v4.4.1 ([#536](https://github.com/sanity-io/get-it/issues/536)) ([ac22c73](https://github.com/sanity-io/get-it/commit/ac22c73cb308dc541f184b3d448ffa509c751fa0))
- **deps:** update dependency parse-headers to v2.0.6 ([#538](https://github.com/sanity-io/get-it/issues/538)) ([e19c992](https://github.com/sanity-io/get-it/commit/e19c99206bf2627358e6321735c3e4385eba045f))
- **typings:** use `Exclude` instead of `Omit` ([#537](https://github.com/sanity-io/get-it/issues/537)) ([bbd0cc8](https://github.com/sanity-io/get-it/commit/bbd0cc8b877c11995f5e9c753c92ca66664ea5ec))

## [8.6.9](https://github.com/sanity-io/get-it/compare/v8.6.8...v8.6.9) (2025-05-19)

### Bug Fixes

- auto-infer proxy if `proxy` option is `undefined` ([#527](https://github.com/sanity-io/get-it/issues/527)) ([5efa7ee](https://github.com/sanity-io/get-it/commit/5efa7eecd697c584d7585c083491de68ac586ded))

## [8.6.8](https://github.com/sanity-io/get-it/compare/v8.6.7...v8.6.8) (2025-05-06)

### Bug Fixes

- **deps:** upgrade to typescript 5.8, vitest 3, add import condition ([#525](https://github.com/sanity-io/get-it/issues/525)) ([4f5f360](https://github.com/sanity-io/get-it/commit/4f5f360768af24ca94ba90e4144a4ba7c7e125c7))

## [8.6.7](https://github.com/sanity-io/get-it/compare/v8.6.6...v8.6.7) (2025-01-27)

### Bug Fixes

- **deps:** update dependency debug to v4.4.0 ([#522](https://github.com/sanity-io/get-it/issues/522)) ([7131120](https://github.com/sanity-io/get-it/commit/71311204ac3d179505a933b069fb468c7392d49c))

## [8.6.6](https://github.com/sanity-io/get-it/compare/v8.6.5...v8.6.6) (2025-01-09)

### Bug Fixes

- **deps:** bump non-major ([#520](https://github.com/sanity-io/get-it/issues/520)) ([3f273b5](https://github.com/sanity-io/get-it/commit/3f273b58bf7cea48544a094abd309a1d6216ed21))

## [8.6.5](https://github.com/sanity-io/get-it/compare/v8.6.4...v8.6.5) (2024-08-16)

### Bug Fixes

- move @types/{follow-redirects,progress-stream} to dependencies ([#501](https://github.com/sanity-io/get-it/issues/501)) ([fcf242e](https://github.com/sanity-io/get-it/commit/fcf242edadde20238d3fa378669bc1cd67bd1718))

## [8.6.4](https://github.com/sanity-io/get-it/compare/v8.6.3...v8.6.4) (2024-08-09)

### Bug Fixes

- regression where inlining `debug` breaks next.js envs on custom babel ([#499](https://github.com/sanity-io/get-it/issues/499)) ([dab8e0b](https://github.com/sanity-io/get-it/commit/dab8e0bd60f709b836f69847ade60b95ab288d9e))

## [8.6.3](https://github.com/sanity-io/get-it/compare/v8.6.2...v8.6.3) (2024-07-09)

### Bug Fixes

- **node:** fix eventemitter leak when checking for broken socket ([#489](https://github.com/sanity-io/get-it/issues/489)) ([532321e](https://github.com/sanity-io/get-it/commit/532321e290cbb9a7abc6581b0dfc1bf776edec69))

## [8.6.2](https://github.com/sanity-io/get-it/compare/v8.6.1...v8.6.2) (2024-06-24)

### Bug Fixes

- **keep-alive:** correctly handle error ([ad87b6c](https://github.com/sanity-io/get-it/commit/ad87b6cd5e5d65f10aefb61ac3914f26432b374c))
- remove test-next integration tests ([#475](https://github.com/sanity-io/get-it/issues/475)) ([040851b](https://github.com/sanity-io/get-it/commit/040851bc8e99aeb3df3a99d6aecb47564dcd9b86))

## [8.6.1](https://github.com/sanity-io/get-it/compare/v8.6.0...v8.6.1) (2024-06-18)

### Bug Fixes

- **timeouts:** only send a single error ([5b817f2](https://github.com/sanity-io/get-it/commit/5b817f2d9e3d771ed5ea5bfb1cbec475ebed3dd4))
- **timeouts:** return the right socket timeout error ([392e782](https://github.com/sanity-io/get-it/commit/392e7827f4ceae67a36c886e7147792680197984))

## [8.6.0](https://github.com/sanity-io/get-it/compare/v8.5.0...v8.6.0) (2024-06-10)

### Features

- retry keep alive econnreset when reusedSockets ([8a2a05b](https://github.com/sanity-io/get-it/commit/8a2a05b6b79c6967b6723fc4d2cdf3a8b438f301))

## [8.5.0](https://github.com/sanity-io/get-it/compare/v8.4.30...v8.5.0) (2024-05-23)

### Features

- improved request body stream conversion ([#446](https://github.com/sanity-io/get-it/issues/446)) ([9f8393f](https://github.com/sanity-io/get-it/commit/9f8393f9405e323cf616cf473d76ad749d0d5a2d))

## [8.4.30](https://github.com/sanity-io/get-it/compare/v8.4.29...v8.4.30) (2024-05-14)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^6.8.15 ([#444](https://github.com/sanity-io/get-it/issues/444)) ([cc0d93d](https://github.com/sanity-io/get-it/commit/cc0d93d79e4eed4dd2b7af8299774cb422d57de7))

## [8.4.29](https://github.com/sanity-io/get-it/compare/v8.4.28...v8.4.29) (2024-05-07)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^6.8.12 ([#438](https://github.com/sanity-io/get-it/issues/438)) ([7d11328](https://github.com/sanity-io/get-it/commit/7d1132889a2619e701ec5511882b65f7184222f3))

## [8.4.28](https://github.com/sanity-io/get-it/compare/v8.4.27...v8.4.28) (2024-05-03)

### Bug Fixes

- react native query string parsing ([#431](https://github.com/sanity-io/get-it/issues/431)) ([d0f6c47](https://github.com/sanity-io/get-it/commit/d0f6c47d22cb2e09dfe946c3fdb75ca0efcde8e5))

## [8.4.27](https://github.com/sanity-io/get-it/compare/v8.4.26...v8.4.27) (2024-04-19)

### Bug Fixes

- handle bug affecting next 14.2.2 during static pregeneration ([1a794fe](https://github.com/sanity-io/get-it/commit/1a794fecc0ac16b6945f3fb1c696d27b2757e386))

## [8.4.26](https://github.com/sanity-io/get-it/compare/v8.4.25...v8.4.26) (2024-04-17)

### Bug Fixes

- **typings:** improve `.d.ts` output ([3fd490e](https://github.com/sanity-io/get-it/commit/3fd490e6c8efda0d90556bb3730f30118bafeede))

## [8.4.25](https://github.com/sanity-io/get-it/compare/v8.4.24...v8.4.25) (2024-04-17)

### Bug Fixes

- allow setting `retryDelay` as a request option ([08e5f24](https://github.com/sanity-io/get-it/commit/08e5f2470fd93722996bad4e37cb351370b061ae))

## [8.4.24](https://github.com/sanity-io/get-it/compare/v8.4.23...v8.4.24) (2024-04-17)

### Bug Fixes

- inline `debug` for better ESM interop ([18798b6](https://github.com/sanity-io/get-it/commit/18798b607c2a10d07efcb6fee48719b881e891ae))
- inline `parse-headers` for better ESM interop ([1f36dfe](https://github.com/sanity-io/get-it/commit/1f36dfe85e60fb67cc099215695bcde4412135fa))
- package exports for react-native ([#413](https://github.com/sanity-io/get-it/issues/413)) ([a93400e](https://github.com/sanity-io/get-it/commit/a93400ec8d89ded5e2f25258e8298008cd262f13))

## [8.4.23](https://github.com/sanity-io/get-it/compare/v8.4.22...v8.4.23) (2024-04-13)

### Bug Fixes

- use `module: Preserve` ([#406](https://github.com/sanity-io/get-it/issues/406)) ([8ffe339](https://github.com/sanity-io/get-it/commit/8ffe339aa40a41b2474deabd2efb55b9f16441ef))

## [8.4.22](https://github.com/sanity-io/get-it/compare/v8.4.21...v8.4.22) (2024-04-13)

### Bug Fixes

- inline is-plain-object ([d902fdb](https://github.com/sanity-io/get-it/commit/d902fdb25064df866ec1328a468464a6cd9177ca))

## [8.4.21](https://github.com/sanity-io/get-it/compare/v8.4.20...v8.4.21) (2024-04-11)

### Bug Fixes

- improve bun support ([ea370bd](https://github.com/sanity-io/get-it/commit/ea370bdd4190e3eca9d637522e4789425486dbf1))

## [8.4.20](https://github.com/sanity-io/get-it/compare/v8.4.19...v8.4.20) (2024-04-11)

### Bug Fixes

- add bun export condition ([f616b13](https://github.com/sanity-io/get-it/commit/f616b130b499b746a19cc29deb88a8107562446a))

## [8.4.19](https://github.com/sanity-io/get-it/compare/v8.4.18...v8.4.19) (2024-04-10)

### Bug Fixes

- remove unnecessary `source` condition ([5c60ce0](https://github.com/sanity-io/get-it/commit/5c60ce008faaed18720e317c12b744ec24ec04fb))

## [8.4.18](https://github.com/sanity-io/get-it/compare/v8.4.17...v8.4.18) (2024-04-05)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^5.1.11 ([#388](https://github.com/sanity-io/get-it/issues/388)) ([2b15a5e](https://github.com/sanity-io/get-it/commit/2b15a5ef684c5e70dc432a845e685ae66abd519c))

## [8.4.17](https://github.com/sanity-io/get-it/compare/v8.4.16...v8.4.17) (2024-04-02)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^5.1.5 ([#381](https://github.com/sanity-io/get-it/issues/381)) ([b84063e](https://github.com/sanity-io/get-it/commit/b84063ecd6e1bb8338e4c1c8b97f53da483e609a))

## [8.4.16](https://github.com/sanity-io/get-it/compare/v8.4.15...v8.4.16) (2024-03-20)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^5.1.4 ([#379](https://github.com/sanity-io/get-it/issues/379)) ([eaebb08](https://github.com/sanity-io/get-it/commit/eaebb081ef06979dce8581a51a076bdb7c461ba5))

## [8.4.15](https://github.com/sanity-io/get-it/compare/v8.4.14...v8.4.15) (2024-03-20)

### Bug Fixes

- add missing tsdoc release tags ([5270c21](https://github.com/sanity-io/get-it/commit/5270c215403143a2250fbe851b376506b9b29565))
- ship TS Node16 compatible typings ([07ee33e](https://github.com/sanity-io/get-it/commit/07ee33ee74bdb8ca8826b630e8831d8a9141db5c))

## [8.4.14](https://github.com/sanity-io/get-it/compare/v8.4.13...v8.4.14) (2024-03-18)

### Bug Fixes

- query string merging in legacy react native versions ([#366](https://github.com/sanity-io/get-it/issues/366)) ([ca8cb61](https://github.com/sanity-io/get-it/commit/ca8cb61fc9828c1a7300634d23c8f431c1495566))

## [8.4.13](https://github.com/sanity-io/get-it/compare/v8.4.12...v8.4.13) (2024-03-15)

### Bug Fixes

- Revert "fix: query string merging in legacy react native versions" ([#365](https://github.com/sanity-io/get-it/issues/365)) ([1e685d0](https://github.com/sanity-io/get-it/commit/1e685d0eda04dfa1a633a979dcb79e50b9cc9d94)), closes [#351](https://github.com/sanity-io/get-it/issues/351)

## [8.4.12](https://github.com/sanity-io/get-it/compare/v8.4.11...v8.4.12) (2024-03-15)

### Bug Fixes

- **deps:** Update dependency follow-redirects to ^1.15.6 ([#364](https://github.com/sanity-io/get-it/issues/364)) ([23eef83](https://github.com/sanity-io/get-it/commit/23eef8311b5c533e37dcf85684951532d3b3ed35))

## [8.4.11](https://github.com/sanity-io/get-it/compare/v8.4.10...v8.4.11) (2024-03-11)

### Bug Fixes

- query string merging in legacy react native versions ([#351](https://github.com/sanity-io/get-it/issues/351)) ([48ca973](https://github.com/sanity-io/get-it/commit/48ca973bd77544723ee2a21ccd36f042b988e27a))

## [8.4.10](https://github.com/sanity-io/get-it/compare/v8.4.9...v8.4.10) (2024-02-26)

### Bug Fixes

- **deps:** update non-major ([1115b66](https://github.com/sanity-io/get-it/commit/1115b665da938e32993c562555f0636e97d3db18))

## [8.4.9](https://github.com/sanity-io/get-it/compare/v8.4.8...v8.4.9) (2024-02-21)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^4.2.8 ([#337](https://github.com/sanity-io/get-it/issues/337)) ([f0e8c07](https://github.com/sanity-io/get-it/commit/f0e8c071728d539117930d2a486283cac47ec1a5))

## [8.4.8](https://github.com/sanity-io/get-it/compare/v8.4.7...v8.4.8) (2024-02-21)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^4.2.6 ([#334](https://github.com/sanity-io/get-it/issues/334)) ([f19aed3](https://github.com/sanity-io/get-it/commit/f19aed380d288aff41678f2a230c51745c405ef4))

## [8.4.7](https://github.com/sanity-io/get-it/compare/v8.4.6...v8.4.7) (2024-02-20)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^4.2.0 ([#314](https://github.com/sanity-io/get-it/issues/314)) ([55440e4](https://github.com/sanity-io/get-it/commit/55440e4245b75a78818899daa47c8f5094a3fd83))
- **deps:** update dependency @sanity/pkg-utils to ^4.2.4 ([#329](https://github.com/sanity-io/get-it/issues/329)) ([151e7e4](https://github.com/sanity-io/get-it/commit/151e7e49e09a984836028b58b43778f6fb01f59d))

## [8.4.6](https://github.com/sanity-io/get-it/compare/v8.4.5...v8.4.6) (2024-01-25)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to v4 ([#312](https://github.com/sanity-io/get-it/issues/312)) ([735c309](https://github.com/sanity-io/get-it/commit/735c3099394bee73bd33c496c43ffe0c4ded4287))

## [8.4.5](https://github.com/sanity-io/get-it/compare/v8.4.4...v8.4.5) (2024-01-11)

### Bug Fixes

- **deps:** update dependency @sanity/pkg-utils to ^3.3.7 ([#297](https://github.com/sanity-io/get-it/issues/297)) ([9660580](https://github.com/sanity-io/get-it/commit/96605800ec5fe6897e3736289ace3c82f0529b2e))
- **deps:** Update react monorepo ([#265](https://github.com/sanity-io/get-it/issues/265)) ([080b96c](https://github.com/sanity-io/get-it/commit/080b96cb56a94b3b74f99dffe2a18387cfa72c12))

## [8.4.4](https://github.com/sanity-io/get-it/compare/v8.4.3...v8.4.4) (2023-10-24)

### Bug Fixes

- **deps:** lock file maintenance ([#251](https://github.com/sanity-io/get-it/issues/251)) ([eeed9ef](https://github.com/sanity-io/get-it/commit/eeed9efbd7963a94594f11acbb9fd9eeea7e6cfe))
- **deps:** Update dependency @types/node to v20 ([#250](https://github.com/sanity-io/get-it/issues/250)) ([a73b40d](https://github.com/sanity-io/get-it/commit/a73b40dc166d70b2785070e231ddc8f72e79a4c1))

## [8.4.3](https://github.com/sanity-io/get-it/compare/v8.4.2...v8.4.3) (2023-08-17)

### Bug Fixes

- add ability to opt-out of setting `signal` on `fetch` ([#180](https://github.com/sanity-io/get-it/issues/180)) ([dc269bc](https://github.com/sanity-io/get-it/commit/dc269bca987b5e1fcc57f7aaec04a3d31f3aa982))

## [8.4.2](https://github.com/sanity-io/get-it/compare/v8.4.1...v8.4.2) (2023-08-09)

### Bug Fixes

- improve React Native compatiblity ([ead5ceb](https://github.com/sanity-io/get-it/commit/ead5ceb1e07eaff9e1f4c2f966aa589f1e22a4c8))

## [8.4.1](https://github.com/sanity-io/get-it/compare/v8.4.0...v8.4.1) (2023-08-07)

### Bug Fixes

- support Gatsby v5 ([3274198](https://github.com/sanity-io/get-it/commit/327419808ee60fe03846ac38c15120728c313e0a))

## [8.4.0](https://github.com/sanity-io/get-it/compare/v8.3.2...v8.4.0) (2023-08-07)

### Features

- add `react-server` export condition ([#151](https://github.com/sanity-io/get-it/issues/151)) ([359949c](https://github.com/sanity-io/get-it/commit/359949cb492eeb1e8543e1239b49190425dc4595))

### Bug Fixes

- **deps:** Update dependency next to v13.4.13 ([#160](https://github.com/sanity-io/get-it/issues/160)) ([6cab644](https://github.com/sanity-io/get-it/commit/6cab6443c1cc86153f59bdd8c2a03c2214b26a5f))

## [8.3.2](https://github.com/sanity-io/get-it/compare/v8.3.1...v8.3.2) (2023-08-04)

### Bug Fixes

- remove node ESM wrapper ([#152](https://github.com/sanity-io/get-it/issues/152)) ([6cbac6d](https://github.com/sanity-io/get-it/commit/6cbac6da265fce2401fe4114141f7adf000a2f42))

## [8.3.1](https://github.com/sanity-io/get-it/compare/v8.3.0...v8.3.1) (2023-07-25)

### Bug Fixes

- **deps:** update non-major ([#146](https://github.com/sanity-io/get-it/issues/146)) ([e8a3f7b](https://github.com/sanity-io/get-it/commit/e8a3f7bb2090583dbba40f4b68f1a36ff603a958))

## [8.3.0](https://github.com/sanity-io/get-it/compare/v8.2.0...v8.3.0) (2023-07-07)

### Features

- add nodeAgent middleware ([#118](https://github.com/sanity-io/get-it/issues/118)) ([b71a258](https://github.com/sanity-io/get-it/commit/b71a258b25bc1c73b1c700165b970644e5b0d0d2))

### Bug Fixes

- **deps:** update non-major ([#143](https://github.com/sanity-io/get-it/issues/143)) ([a283e2f](https://github.com/sanity-io/get-it/commit/a283e2f9a96356ab7b4366ed82ccdc5aa9311bf2))

## [8.2.0](https://github.com/sanity-io/get-it/compare/v8.1.4...v8.2.0) (2023-06-28)

### Features

- add support for `fetch` in `node` ([1608207](https://github.com/sanity-io/get-it/commit/1608207f303f49a1eef02559d1635a81df08208d))
- add support for `fetch` options in `edge` runtimes ([ca20c8e](https://github.com/sanity-io/get-it/commit/ca20c8ebace764f54089cf63cbf230b4cebe92e3))

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
