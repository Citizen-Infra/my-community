import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'node:fs';

// package.json is the single source of the extension version (#67).
//
// public/manifest.json is copied verbatim into dist/, so its `version` used to
// be a second place to remember. It drifted: every release from 0.3.5 to 0.3.15
// shipped a manifest reporting 0.3.5. That is not cosmetic — Chrome uses the
// manifest version for update detection, and the Web Store rejects an upload
// whose version is not newer than the last (#24, #79).
//
// So public/manifest.json carries a placeholder and this plugin stamps the real
// value into the emitted dist/manifest.json. Bumping package.json is the only
// step; nothing else needs touching at release time.
//
// closeBundle, not writeBundle: Vite copies publicDir after the bundle is
// written, so a writeBundle hook would be overwritten by the copy it is trying
// to correct. closeBundle runs last. Verified by building and reading back
// dist/manifest.json.
function stampManifestVersion() {
  return {
    name: 'stamp-manifest-version',
    closeBundle() {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
      const out = resolve(__dirname, 'dist/manifest.json');
      const manifest = JSON.parse(readFileSync(out, 'utf8'));
      manifest.version = pkg.version;
      writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);

      // Read back rather than trusting the write. public/manifest.json carries a
      // 0.0.0 placeholder, so a stamp that silently failed would ship an
      // extension claiming 0.0.0 — a version Chrome treats as a downgrade and
      // the Web Store rejects. Better to fail the build here.
      const written = JSON.parse(readFileSync(out, 'utf8')).version;
      if (written !== pkg.version) {
        this.error(`could not stamp manifest version: expected ${pkg.version}, dist has ${written}`);
      }
      this.info?.(`stamped manifest version ${pkg.version}`);
    },
  };
}

export default defineConfig({
  plugins: [preact(), stampManifestVersion()],
  base: '',
  build: {
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'src/newtab.html'),
      },
    },
    outDir: 'dist',
  },
});
