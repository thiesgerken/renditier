import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const vendorChunkGroups = [
  ['vendor-react', ['react', 'react-dom', 'react-router', 'react-router-dom']],
  [
    'vendor-redux',
    [
      '@reduxjs/toolkit',
      'immer',
      'redux',
      'react-redux',
      'redux-thunk',
      'reselect',
    ],
  ],
  ['vendor-d3-shape', ['d3-shape']],
  ['vendor-utils', ['lodash']],
];

function chunkForPackage(id, packageName) {
  const packagePath = `/node_modules/${packageName}/`;
  return (
    id.includes(packagePath) || id.endsWith(`/node_modules/${packageName}`)
  );
}

function packageChunkName(id) {
  const [, packagePath] = id.split('/node_modules/');
  if (!packagePath) return null;

  const parts = packagePath.split('/');
  const packageName = parts[0].startsWith('@')
    ? `${parts[0]}/${parts[1]}`
    : parts[0];

  return `vendor-${packageName.replace('@', '').replace('/', '-')}`;
}

function rechartsChunkName(id) {
  if (!id.includes('/node_modules/recharts/')) return null;

  if (
    id.includes('/node_modules/recharts/es6/chart/') ||
    id.includes('/node_modules/recharts/es6/cartesian/')
  ) {
    return 'vendor-recharts-cartesian';
  }

  if (id.includes('/node_modules/recharts/es6/polar/')) {
    return 'vendor-recharts-polar';
  }

  if (id.includes('/node_modules/recharts/es6/shape/')) {
    return 'vendor-recharts-shapes';
  }

  if (
    id.includes('/node_modules/recharts/es6/component/') ||
    id.includes('/node_modules/recharts/es6/container/')
  ) {
    return 'vendor-recharts-components';
  }

  return 'vendor-recharts-core';
}

function manualChunks(id) {
  const rechartsChunk = rechartsChunkName(id);
  if (rechartsChunk) return rechartsChunk;

  for (const [chunkName, packageNames] of vendorChunkGroups) {
    if (packageNames.some(packageName => chunkForPackage(id, packageName))) {
      return chunkName;
    }
  }

  if (id.includes('/node_modules/')) {
    return packageChunkName(id);
  }

  return null;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  build: {
    outDir: 'build',
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8383',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/setupTests.ts'],
  },
});
