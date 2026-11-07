// The `typeface-*` packages ship only CSS and font files; importing one for its
// side effect has no types to resolve.
declare module 'typeface-open-sans';
declare module 'typeface-oxygen';
declare module 'typeface-roboto';

// moment ships `moment.d.ts` but no per-locale declarations. The import is
// load-bearing: it registers the locale that `moment.locale('de')` selects.
// It must be the ESM locale, see the moment alias in vite.config.mjs.
declare module 'moment/dist/locale/de';
