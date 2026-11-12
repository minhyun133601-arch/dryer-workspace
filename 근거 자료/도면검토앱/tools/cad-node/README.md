# LibreDWG browser engine provenance

The CAD worker in `engine.js` includes the browser parser from
`@mlightcad/libredwg-web` **0.8.4**, based on GNU LibreDWG. Parsing runs locally
in WebAssembly; no drawing is sent to a conversion service.

- Package author: MLight Lee and the LibreDWG contributors listed in `AUTHORS`.
- Package license: GPL-3.0. GNU LibreDWG source headers specify GPL-3.0-or-later.
- The full GNU GPL version 3 text is retained in `COPYING`.
- Upstream: https://github.com/mlightcad/libredwg-web
- Exact tag: `v0.8.4`.
- Exact source commit: `1e8972121130198dee363478b47f89b944842276`.
- This commit is recorded in both the GitHub tag and the npm SLSA provenance
  attestation for the published package.
- Npm provenance:
  https://registry.npmjs.org/-/npm/v1/attestations/@mlightcad%2flibredwg-web@0.8.4

Corresponding upstream source, including the C/C++ parser, JavaScript wrapper,
and upstream WebAssembly build instructions:

https://codeload.github.com/mlightcad/libredwg-web/tar.gz/1e8972121130198dee363478b47f89b944842276

Source archive SHA-256:
`1e3cf0a10592605dd4e31f0be3b8f62c9cad73813cf038f129979e0942fa1f68`.
The corresponding archive is included here as `upstream-source.tar.gz`.

Pinned npm package archive:

https://registry.npmjs.org/@mlightcad/libredwg-web/-/libredwg-web-0.8.4.tgz

Npm archive integrity (also retained in `package-lock.json`):
`sha512-IYCo39MtZswuNZhfXG/VpZ8ZunPM4n6Kh/7YZlOi9KbKnTMT58jsycHoQ+2yL7F+G5OyR2GU6cF1TsVn4WHWjQ==`.

Unmodified package input SHA-256 checksums:

| Input | SHA-256 |
| --- | --- |
| `dist/libredwg-web.js` | `2fa3c2a05e0e58db836fbede863273c6a76280e23e87ced32d4728faf61873f7` |
| `wasm/libredwg-web.js` | `e263ab8c8a00de0cc38fd259db5b0cdc4d7ef0f4b123dbe9a41de2da6f3311a4` |
| `wasm/libredwg-web.wasm` | `faf887bddb97fa8075ce718aaae578ea2af33bb091c9cf123df75c1d5b212abf` |
| `COPYING` | `8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903` |
| `AUTHORS` | `1807899e04a8d275b9525c4d4686ea7e737cd8624800944172ebfd76f906b6ed` |

The application worker adapter is in `scripts/cad-worker-entry.mjs`.
`npm run vendor:cad` rebuilds the local bundled worker using the pinned npm
package and esbuild. The parser inputs are unmodified; the build packages the
worker and WebAssembly bytes for offline use.

When redistributing this component, retain these notices, `AUTHORS`, `COPYING`,
and the corresponding source/build material in accordance with the GPL.
