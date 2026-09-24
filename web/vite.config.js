import { defineConfig, loadEnv } from 'vite';
import { rmSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { resolve } from 'node:path';
import { createDeploymentConfig } from '../extension/src/lib/deployment-config.js';
import { transformDeploymentHtml } from './deployment-branding.js';

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

function omitDisabledBlueskyMetadata(enabled) {
  return {
    name: 'omit-disabled-bluesky-metadata',
    closeBundle() {
      if (!enabled) rmSync(resolve(__dirname, 'dist/oauth'), { recursive: true, force: true });
    },
  };
}

function applyDeploymentBranding(config) {
  return {
    name: 'apply-deployment-branding',
    transformIndexHtml(html) {
      return transformDeploymentHtml(html, config);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, __dirname, 'VITE_'), ...process.env };
  const deploymentConfig = createDeploymentConfig(env);
  return {
    plugins: [preact(), applyDeploymentBranding(deploymentConfig), rejectExtensionOnlyCode(), omitDisabledBlueskyMetadata(deploymentConfig.blueskyEnabled)],
    publicDir: 'public',
    resolve: {
      alias: [
        { find: 'preact/jsx-dev-runtime', replacement: resolve(__dirname, 'node_modules/preact/jsx-runtime') },
        { find: 'preact', replacement: resolve(__dirname, 'node_modules/preact') },
        { find: '@preact/signals', replacement: resolve(__dirname, 'node_modules/@preact/signals') },
        { find: '@supabase/supabase-js', replacement: resolve(__dirname, 'node_modules/@supabase/supabase-js') },
        { find: 'idb', replacement: resolve(__dirname, 'node_modules/idb') },
        { find: 'jose', replacement: resolve(__dirname, 'node_modules/jose') },
      ],
      dedupe: ['preact', '@preact/signals'],
    },
    server: {
      fs: { allow: [resolve(__dirname, '..')] },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
