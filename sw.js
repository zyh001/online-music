var cacheStorageKey = 'minimal-pwa-1'
var cacheList = [
  '/',
  "index.html",
]
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(cacheStorageKey)
    .then(cache => cache.addAll(cacheList))
    .then(() => self.skipWaiting())
  )
})
self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      if (response != null) {
        return response
      }
      return fetch(e.request.url)
    })
  )
})
self.addEventListener('fetch', function (evt) {
    evt.respondWith(
        caches.match(evt.request).then(function(response) {
            if (response) {
                return response;
            }
            var request = evt.request.clone();
            return fetch(request).then(function (response) {
                if (!response && response.status !== 200 && !response.headers.get('Content-type').match(/images/)) {
                    return response;
                }
                var responseClone = response.clone();
                caches.open('my-test-cache-v1').then(function (cache) {
                    cache.put(evt.request, responseClone);
                });
                return response;
            });
        })
    )
});
var deferredPrompt;
window.addEventListener('beforeinstallprompt', function(e) {
  console.log('beforeinstallprompt Event fired');
  e.preventDefault();
  deferredPrompt = e;
  return false;
});
btnSave.addEventListener('click', function() {
  if(deferredPrompt !== undefined) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(choiceResult) {
      console.log(choiceResult.outcome);
      if(choiceResult.outcome == 'dismissed') {
      // 拒绝添加
        console.log('User cancelled home screen install');
      }
      else {
        console.log('User added to home screen');
      }
      // 不在提醒
      deferredPrompt = null;
    });
  }
});
