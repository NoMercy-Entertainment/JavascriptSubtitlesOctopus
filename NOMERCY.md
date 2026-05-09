# @nomercy-entertainment/libass-wasm

NoMercy Entertainment's fork of [libass/JavascriptSubtitlesOctopus](https://github.com/libass/JavascriptSubtitlesOctopus).

This package owns the WebAssembly build pipeline behind ASS/SSA subtitle rendering for the NoMercy player ecosystem. The TypeScript wrapper that consumes the binaries lives at [`@nomercy-entertainment/nomercy-subtitle-octopus`](../nomercy-subtitle-octopus/) — this package is the source-of-truth for the binaries themselves.

## Why fork

We maintain our own build for three reasons:

1. **Reproducibility.** Pinning a specific Emscripten + libass + freetype + harfbuzz + fribidi + brotli combination, rebuilding from source on demand, and shipping the binaries on a NoMercy schedule.
2. **Patch surface.** Reserved for any worker-internal modifications NoMercy needs that don't have a viable main-thread alternative. (As of `4.1.0-nme.0`, the auth, canvas-geometry, and lifecycle patches all live in the consumer-side TypeScript wrapper — see `nomercy-subtitle-octopus/src/`. The C++ source carries zero NoMercy modifications today.)
3. **Supply chain.** Removing the dependency on Jellyfin's npm publishing cadence for shipping new player versions.

## Relationship to upstream

`upstream` git remote tracks `libass/JavascriptSubtitlesOctopus`. Our `master` branch starts from upstream `master` and stays close — we rebase onto upstream as it advances. NoMercy-specific divergence is documented in `NOMERCY-PATCHES.md` (created when the first source-level patch lands).

## Building

```sh
# Docker (preferred — reproducible across hosts)
npm run build:docker

# Buildah / rootless (Linux)
npm run build:buildah
```

Both invoke the upstream build script, which compiles libass + deps via Emscripten and emits `dist/js/subtitles-octopus*.{js,wasm}` plus an aggregated `COPYRIGHT`. The build chain is unchanged from upstream — we don't fork the toolchain.

## Versioning

`<upstream-version>-nme.<patch>`. NoMercy patches bump the `nme` segment. Upstream rebases bump the version prefix.

`4.1.0-nme.0` = upstream `libass-wasm@4.1.0` + zero NoMercy source patches, NoMercy build.

## Consumers

- `@nomercy-entertainment/nomercy-subtitle-octopus` — TypeScript wrapper. Hosts the auth pre-fetch, canvas geometry override, lifecycle race guard, and URL resolution patches in main-thread code.
- `@nomercy-entertainment/nomercy-video-player` — registers the Octopus plugin which uses the wrapper.

## License

License chain inherited from upstream:

```
LGPL-2.1-or-later AND (FTL OR GPL-2.0-or-later) AND MIT AND MIT-Modern-Variant
AND ISC AND NTP AND Zlib AND BSL-1.0
```

The original `LICENSE` file is preserved verbatim. NoMercy modifications are licensed MIT but linked into the GPL/LGPL chain when distributed via the .wasm artifact — same posture as Jellyfin's fork.
