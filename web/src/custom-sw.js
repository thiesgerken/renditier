self.addEventListener('install', e => {
  console.log('workbox "install" event fired');
  console.log(e);
  // self.skipWaiting();
});

self.addEventListener('beforeinstallprompt', e => {
  console.log('workbox "beforeinstallprompt" event fired');
  console.log(e);
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  // e.preventDefault();
  // Stash the event so it can be triggered later.
  // deferredPrompt = e;
  // e.prompt();
  // Wait for the user to respond to the prompt
  // e.userChoice.then(choiceResult => {
  //   if (choiceResult.outcome === 'accepted') {
  //     console.log('User accepted the A2HS prompt');
  //   } else {
  //     console.log('User dismissed the A2HS prompt');
  //   }
  // });
});

self.addEventListener('fetch', e => {
  console.log('workbox "fetch" event fired');
  console.log(e);
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  // e.preventDefault();
  // Stash the event so it can be triggered later.
  // deferredPrompt = e;
  // e.prompt();
  // Wait for the user to respond to the prompt
  // e.userChoice.then(choiceResult => {
  //   if (choiceResult.outcome === 'accepted') {
  //     console.log('User accepted the A2HS prompt');
  //   } else {
  //     console.log('User dismissed the A2HS prompt');
  //   }
  // });
});
