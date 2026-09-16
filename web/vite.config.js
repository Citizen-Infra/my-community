import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';

function rejectExtensionOnlyCode() {
  const forbiddenModules = [
    '/store/tabs.js',
    '/store/collections.js',
    '/store/backup.js',
    '/store/tab-manager.js',
    '/components/BookmarkImportModal.jsx',
    '/components/TabCard.jsx',
    '/platform/extension.js',
  ];
  return {
    name: 'reject-extension-only-code',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const moduleIds = Object.keys(output.modules).map((id) => id.replaceAll('\\', '/'));
        const leakedModule = moduleIds.find((id) => forbiddenModules.some((part) => id.endsWith(part)));
        if (leakedModule) this.error(`Extension-only module entered the web bundle: ${leakedModule}`);
        if (/\bchrome\s*\./.test(output.code)) this.error(`Chrome API reference entered ${output.fileName}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [preact(), rejectExtensionOnlyCode()],
  publicDir: 'public',
  resolve: {
    alias: {
      preact: resolve(__dirname, 'node_modules/preact'),
      '@preact/signals': resolve(__dirname, 'node_modules/@preact/signals'),
      '@supabase/supabase-js': resolve(__dirname, 'node_modules/@supabase/supabase-js'),
      idb: resolve(__dirname, 'node_modules/idb'),
      jose: resolve(__dirname, 'node_modules/jose'),
    },
    dedupe: ['preact', '@preact/signals'],
  },
  server: {
    fs: { allow: [resolve(__dirname, '..')] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
