import i18n from './i18n';

// jsdom speaks en-US; the tests expect the German texts and formats, whatever
// the machine they run on.
Object.defineProperty(navigator, 'languages', { value: ['de-DE'] });
await i18n.changeLanguage('de');
