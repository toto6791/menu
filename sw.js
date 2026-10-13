// Пази файловете на приложението, за да работи без интернет.
// Заявките към GitHub (данните) не се кешират тук.
const CACHE = "sedmichno-menu-v3";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./css/styles.css",
  "./js/config.js", "./js/utils.js", "./js/storage.js", "./js/render.js", "./js/recipe-view.js",
  "./js/parse.js", "./js/recipe-editor.js", "./js/backup.js", "./js/sync.js", "./js/app.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png",
  "./fonts/rubik.woff2", "./fonts/unbounded.woff2"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("data.json")) return;
  const isCode = req.mode === "navigate" || /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith("/");
  if (isCode) {
    // Страницата и кодът: първо от интернет (за да идват новите версии), иначе от кеша
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
  })));
});
