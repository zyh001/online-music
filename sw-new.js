'use strict';

const version = 'music_201804011500';
const __DEVELOPMENT__ = false;
const __DEBUG__ = true;
const offlineResources = [
    '/',
    '/index.html',
];

const ignoreCache = [
    /https?:\/\/hm.baidu.com\//,
    /https?:\/\/cdn.bootcss.com\//,
    /https?:\/\/static.duoshuo.com\//,
    /https?:\/\/www.google-analytics.com\//,
    /https?:\/\/dn-lbstatics.qbox.me\//,
    /https?:\/\/ajax.cloudflare.com\//,
    /https?:\/\/cdn1.lncld.net\//,
    /https?:\/\/api.leancloud.cn\//,
];

// 鎱庨噸浣跨敤鍏ㄥ眬鍙彉鍙橀噺锛屽洜涓� serviceWork 涓嶅彲鎺х殑鍋滄鍜岄噸鍚紝浼氬鑷村畠浠殑鍙栧€煎湪鍚庣画璇诲彇鏃舵棤娉曢娴�
let port;


/**
 * common function
 */

function developmentMode() {
    return __DEVELOPMENT__ || __DEBUG__;
}

function cacheKey() {
    return [version, ...arguments].join(':');
}

function log() {
    if (developmentMode()) {
        console.log("SW:", ...arguments);
    }
}

// 涓嶉渶瑕佺紦瀛樼殑璇锋眰
function shouldAlwaysFetch(request) {
    return __DEVELOPMENT__ ||
        request.method !== 'GET' ||
        ignoreCache.some(regex => request.url.match(regex));
}

// 缂撳瓨 html 椤甸潰
function shouldFetchAndCache(request) {
    return (/text\/html/i).test(request.headers.get('Accept'));
}

// 鍙戦€� Notification 閫氱煡
function sendNotify(title, options, event) {
    if (Notification.permission !== 'granted') {
        log('Not granted Notification permission.');

        // 鏃犳巿鏉冩椂锛屽悜鏉ユ簮椤甸潰鐢宠鎺堟潈
        if (port && port.postMessage) {
            port.postMessage({
                type: 'applyNotify',
                info: {title, options}
            });
        }

        return;
    }

    const notificationPromise = self.registration.showNotification(title || 'Hi锛�', Object.assign({
        body: '杩欐槸涓€涓€氱煡绀轰緥',
        icon: '//music.fdos.me/images/pwalogo.png',
        tag: 'push'
    }, options));

    return event && event.waitUntil(notificationPromise);
}

/**
 * onClickNotify
 */

function onClickNotify(event) {
    event.notification.close();
    const url = "https://music.fdos.me";

    event.waitUntil(
        self.clients.matchAll({
            type: "window"
        })
        .then(() => {
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
}

/**
 * Install 瀹夎
 */

function onInstall(event) {
    log('install event in progress.');

    event.waitUntil(
        caches.open(cacheKey('offline'))
            .then(cache => cache.addAll(offlineResources))
            .then(() => log('installation complete! version: ' + version))
            .then(() => self.skipWaiting())
    );
}

/**
 * Fetch
 */

// 褰撶綉缁滅绾挎垨璇锋眰鍙戠敓浜嗛敊璇紝浣跨敤绂荤嚎璧勬簮鏇夸唬 request 璇锋眰
function offlineResponse(request) {
    log('(offline)', request.method, request.url);
    if (request.url.match(/\.(jpg|png|gif|svg|jpeg)(\?.*)?$/)) {
        return caches.match('/wp-content/themes/Kratos/images/default.jpg');
    } else {
        return caches.match('/offline.html');
    }
}

// 浠庣紦瀛樿鍙栨垨浣跨敤绂荤嚎璧勬簮鏇夸唬
function cachedOrOffline(request) {
    return caches
        .match(request)
        .then((response) => response || offlineResponse(request));
}

// 浠庣綉缁滆姹傦紝骞跺皢璇锋眰鎴愬姛鐨勮祫婧愮紦瀛�
function networkedAndCache(request) {
    return fetch(request)
        .then(response => {
            const copy = response.clone();

            caches.open(cacheKey('resources'))
                .then(cache => {
                    cache.put(request, copy);
                });

            log("(network: cache write)", request.method, request.url);
            return response;
        });
}

// 浼樺厛浠� cache 璇诲彇锛岃鍙栧け璐ュ垯浠庣綉缁滆姹傚苟缂撳瓨銆傜綉缁滆姹備篃澶辫触锛屽垯浣跨敤绂荤嚎璧勬簮鏇夸唬
function cachedOrNetworked(request) {
    return caches.match(request)
        .then((response) => {
            log(response ? '(cached)' : '(network: cache miss)', request.method, request.url);
            return response ||
                networkedAndCache(request)
                .catch(() => offlineResponse(request));
        });
}

// 浼樺厛浠庣綉缁滆姹傦紝澶辫触鍒欎娇鐢ㄧ绾胯祫婧愭浛浠�
function networkedOrOffline(request) {
    return fetch(request)
        .then(response => {
            log('(network)', request.method, request.url);
            return response;
        })
        .catch(() => offlineResponse(request));
}

function onFetch(event) {
    const request = event.request;

    // 搴斿綋姘歌繙浠庣綉缁滆姹傜殑璧勬簮
    // 濡傛灉璇锋眰澶辫触锛屽垯浣跨敤绂荤嚎璧勬簮鏇夸唬
    if (shouldAlwaysFetch(request)) {
        log('AlwaysFetch request: ', event.request.url);
        event.respondWith(networkedOrOffline(request));
        return;
    }

    // 搴斿綋浠庣綉缁滆姹傚苟缂撳瓨鐨勮祫婧�
    // 濡傛灉璇锋眰澶辫触锛屽垯灏濊瘯浠庣紦瀛樿鍙栵紝璇诲彇澶辫触鍒欎娇鐢ㄧ绾胯祫婧愭浛浠�
    if (shouldFetchAndCache(request)) {
        event.respondWith(
            networkedAndCache(request).catch(() => cachedOrOffline(request))
        );
        return;
    }

    event.respondWith(cachedOrNetworked(request));
}

/**
 * Activate
 */

function removeOldCache() {
    return caches
        .keys()
        .then(keys =>
            Promise.all( // 绛夊緟鎵€鏈夋棫鐨勮祫婧愰兘娓呯悊瀹屾垚
                keys
                .filter(key => !key.startsWith(version)) // 杩囨护涓嶉渶瑕佸垹闄ょ殑璧勬簮
                .map(key => caches.delete(key)) // 鍒犻櫎鏃х増鏈祫婧愶紝杩斿洖涓� Promise 瀵硅薄
            )
        )
        .then(() => {
            log('removeOldCache completed.');
        });
}

function onActivate(event) {
    log('activate event in progress.');
    event.waitUntil(Promise.all([
        // 鏇存柊瀹㈡埛绔�
        self.clients.claim(),
        removeOldCache()
    ]))
}

/**
 * onPush
 */

function onPush(event) {
    log('onPush ', event);
    sendNotify('Hi:', {
        body: `銆�${new Date()}銆戝彂鐢熶簡涓€娆� Push 鍚屾浜嬩欢 ~`
    }, event);
}

/**
 * onSync
 */

function onSync(event) {
    log('onSync', event);
    sendNotify('Hi:', {
        body: `銆�${new Date()}銆戝彂鐢熶簡涓€娆� Sync 鍚屾浜嬩欢 ~`
    }, event);
}

/**
 * onMessage
 */

function onMessage(event) {
    log('onMessage', event);

    if (event.ports) {
        port = event.ports[0];
    }

    if (!event.data) {
        return;
    }

    // 濡傛灉鏄姹備竴鏉￠€氱煡锛屽垯鍙戦€�
    if (event.data.type === 'notify') {
        const {title, options} = event.data.info || {};
        sendNotify(title, options, event);
    }
}

log("Hello from ServiceWorker land!", version);

self.addEventListener('install', onInstall);
self.addEventListener('fetch', onFetch);
self.addEventListener("activate", onActivate);
self.addEventListener("push", onPush);
self.addEventListener("sync", onSync);
self.addEventListener('message', onMessage);
self.addEventListener("notificationclick", onClickNotify);
