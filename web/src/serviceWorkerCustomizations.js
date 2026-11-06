/* eslint-disable no-restricted-globals */

// self.addEventListener('install', e => {
//   console.log('workbox "install" event fired');
//   console.log(e);

//   self.skipWaiting();
// });

// self.addEventListener('beforeinstallprompt', e => {
//   console.log('workbox "beforeinstallprompt" event fired');
//   console.log(e);
// });

self.addEventListener('fetch', () => {
  // this needs to be here, even if it does not do anything.
  // console.log('workbox "fetch" event fired');
});

self.addEventListener('push', e => {
  const data = e.data.json();
  let body = null;

  // console.log(`[Service Worker] Push received"`);
  // console.log(data);

  if (Object.keys(data).includes('text')) {
    body = data.text;
  } else if (
    Object.keys(data).includes('kind') &&
    ['Today', 'WeekToDate'].includes(data.kind)
  ) {
    if (
      data.end.value === null ||
      data.start === null ||
      data.start.value === null
    ) {
      // console.error('values missing, will not issue a notification.');
      return;
    }

    const desc = data.kind === 'Today' ? 'Heute' : 'Diese Woche';
    const diff =
      data.end.value +
      data.end.invested -
      (data.start.value + data.start.invested);

    // This file is copied into the build verbatim, so it cannot import the
    // formatting helpers in src/format.ts.
    const currency = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    });
    const percent = new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 2,
      signDisplay: 'exceptZero',
    });

    body = `Gewinn ${desc}: ${currency.format(diff)}`;
    if (data.start.value !== 0.0)
      body += ` (${percent.format(diff / data.start.value)})`;
    body += `; Gewinn Insgesamt: ${currency.format(
      data.end.value + data.end.invested
    )}`;
  } else {
    // console.error('unknown payload format in the push message');
    // console.error(data);
    return;
  }

  const title = 'StockDB';
  const options = {
    body,
    icon: 'public/icon-512.png',
    // badge: 'images/badge.png'
  };

  e.waitUntil(self.registration.showNotification(title, options));
});
