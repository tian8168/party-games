/**
 * ⚡ 聚会游戏大厅 · Service Worker 离线持久化与缓存总线 (PWA Cache Bus)
 * 策略规范：
 * 1. HTML 导航请求：Network-First (有网优先拉取最新更新，离线秒级回退缓存)
 * 2. 静态资产 (CSS/JS/Icons/WASM/ROMs)：Cache-First (0ms 瞬时命中，后台增量更新)
 * 3. 动态信令 (WebSocket/MQTT)：直连放行
 */

const CACHE_NAME = 'party-arcade-v1.2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './common/common.css',
  './common/common.js',
  './common/audio.js',
  './common/network.js',
  './mqtt.min.js',
  './games/sumo.html',
  './games/tanktrouble.html',
  './games/quoridor.html',
  './games/aeroplane.html',
  './games/hockey.html',
  './games/gravity.html',
  './games/gravity4.html',
  './games/gravity3d.html',
  './games/gravity3d4.html',
  './games/tank.html',
  './games/iaido.html',
  './games/liarsdice.html',
  './games/stack.html',
  './games/contra.html',
  './games/nes.html',
  './games/js/nostalgist.umd.js',
  './games/js/nes_netplay.js',
  './games/roms/roms_index.json',
  './games/roms/contra.nes',
  './games/roms/contra_30lives.nes',
  './games/cores/fceumm_libretro.zip',
  './games/cores/mgba_libretro.zip'
];

// --- 1. 安装阶段 (Pre-caching App Shell) ---
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching App Shell assets...');
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Some precache assets failed:', err);
      });
    })
  );
});

// --- 2. 激活阶段 (Clean up old caches) ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- 3. 拦截请求与智能分流策略 ---
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 忽略非 GET 请求及 WebSocket/MQTT 信令协议
  if (request.method !== 'GET') return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  if (url.hostname.includes('emqx.io')) return;

  // 策略 A: HTML 页面采用 Network-First (网络优先，断网回退缓存)
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 策略 B: 静态资源与二进制镜像采用 Cache-First (缓存优先，后台自动补全)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // 异步后台校验更新 (Stale-While-Revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});
