// self.addEventListener('install', e => {
//   console.log('workbox "install" event fired');
//   console.log(e);

//   self.skipWaiting();
// });

// self.addEventListener('beforeinstallprompt', e => {
//   console.log('workbox "beforeinstallprompt" event fired');
//   console.log(e);
// });

self.addEventListener('fetch', e => {
  // this needs to be here, even if it does not do anything.
  // console.log('workbox "fetch" event fired');
  // console.log(e);
});

self.addEventListener('push', e => {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${e.data.text()}"`);

  const title = 'StockDB';
  const options = {
    body: e.data.text(),
    icon: 'public/icon-512.png',
    // badge: 'images/badge.png'
  };

  e.waitUntil(self.registration.showNotification(title, options));
});
