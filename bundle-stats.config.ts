export default {
  packages: [
    {
      root: '.',
      scenarios: {
        exports: false,
        bins: false,
        entries: {
          'readme-minimal': './test/bundle/readme-minimal.ts',
        },
      },
      importTime: false,
    },
  ],
}
