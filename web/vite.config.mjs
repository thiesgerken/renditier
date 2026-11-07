import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const emotionInitCall = 'init_emotion_react_browser_development_esm();';
const emotionInitName = 'init_emotion_react_browser_development_esm';

function patchMissingEmotionInit() {
  return {
    name: 'patch-missing-emotion-init',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '', 'http://vite.local').pathname;

        if (
          !pathname.startsWith('/node_modules/.vite/deps/') ||
          !pathname.endsWith('.js')
        ) {
          next();
          return;
        }

        const dependencyFile = resolve(
          server.config.cacheDir,
          'deps',
          basename(pathname),
        );
        const code = await readFile(dependencyFile, 'utf8').catch(() => null);

        if (
          !code?.includes(emotionInitCall) ||
          code.includes(`var ${emotionInitName}`) ||
          code.includes(` as ${emotionInitName}`)
        ) {
          next();
          return;
        }

        response.setHeader('Content-Type', 'text/javascript');
        response.end(code.replaceAll(emotionInitCall, ''));
      });
    },
  };
}

const vendorChunkGroups = [
  ['vendor-react', ['react', 'react-dom', 'react-router', 'react-router-dom']],
  ['vendor-redux', ['redux', 'react-redux', 'redux-thunk']],
  ['vendor-mui-system', ['@mui/system', '@mui/utils']],
  ['vendor-mui-icons', ['@mui/icons-material']],
  ['vendor-mui-pickers', ['@mui/x-date-pickers']],
  ['vendor-emotion', ['@emotion/react', '@emotion/styled']],
  ['vendor-d3-shape', ['d3-shape']],
  ['vendor-date', ['moment']],
  ['vendor-utils', ['lodash', 'classnames']],
];

function chunkForPackage(id, packageName) {
  const packagePath = `/node_modules/${packageName}/`;
  return id.includes(packagePath) || id.endsWith(`/node_modules/${packageName}`);
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

function muiMaterialChunkName(id) {
  if (!id.includes('/node_modules/@mui/material/')) return null;

  const [, modulePath] = id.split('/node_modules/@mui/material/');
  const moduleName = modulePath.split('/')[0];

  if (['colors', 'styles', 'utils', 'useMediaQuery'].includes(moduleName)) {
    return 'vendor-mui-foundation';
  }

  if (
    [
      'Box',
      'Container',
      'Grid',
      'Paper',
      'Table',
      'TableBody',
      'TableCell',
      'TableContainer',
      'TableHead',
      'TableRow',
    ].includes(moduleName)
  ) {
    return 'vendor-mui-layout';
  }

  if (
    [
      'Button',
      'Checkbox',
      'FormControl',
      'IconButton',
      'Input',
      'InputBase',
      'InputLabel',
      'MenuItem',
      'OutlinedInput',
      'Select',
      'TextField',
    ].includes(moduleName)
  ) {
    return 'vendor-mui-inputs';
  }

  if (
    [
      'Alert',
      'AppBar',
      'Collapse',
      'CssBaseline',
      'Dialog',
      'DialogActions',
      'DialogContent',
      'DialogTitle',
      'Divider',
      'Drawer',
      'List',
      'ListItem',
      'ListItemIcon',
      'ListItemText',
      'Menu',
      'Modal',
      'Popover',
      'SwipeableDrawer',
      'Toolbar',
      'Typography',
    ].includes(moduleName)
  ) {
    return 'vendor-mui-shell';
  }

  return 'vendor-mui-material';
}

function manualChunks(id) {
  const muiChunk = muiMaterialChunkName(id);
  if (muiChunk) return muiChunk;

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
  plugins: [patchMissingEmotionInit(), react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // The dev dependency optimizer bundles moment's CommonJS build once for
      // the app and once more into its locale, so a loaded locale never reached
      // the app's instance. The ESM build and its ESM locales share one module.
      { find: /^moment$/, replacement: 'moment/dist/moment.js' },
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
  },
});
