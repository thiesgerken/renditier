// moment ships `moment.d.ts` but no per-locale declarations. The import is
// load-bearing: it registers the locale that `moment.locale('de')` selects.
// It must be the ESM locale, see the moment alias in vite.config.mjs.
declare module 'moment/dist/locale/de';
