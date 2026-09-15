/* ============================================================
   Service worker — нужен для установки игры на домашний экран
   (без него Chrome не предлагает «Установить приложение»)
   и для работы при плохой связи.

   СТРАТЕГИЯ: «сеть в приоритете, кэш — запасной вариант».
   Выбрана намеренно: в проекте уже есть механизм обновления через
   ?v=<хэш коммита> в index.html. Если бы кэш был в приоритете, после
   деплоя часть игроков продолжала бы видеть старую версию, а починить
   это было бы сложно. Сейчас же свежий файл всегда берётся из сети,
   а кэш выручает только когда сети нет.

   ВАЖНО при обновлении игры: поднимать CACHE_VERSION, иначе старый
   кэш продолжит жить (он чистится при активации нового воркера).
   ============================================================ */

const CACHE_VERSION = 'tayna-v1';
const CACHE_NAME = `tayna-asteroida-${CACHE_VERSION}`;

// Минимальный набор для запуска офлайн. Остальное (спрайты, звуки)
// докэшируется само по мере обращения — см. fetch ниже.
const CORE = [
  './',
  './index.html',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CORE))
      .catch(() => {})          // офлайн при установке — не критично
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Вмешиваемся только в обычные GET-запросы к своему домену.
  // Яндекс SDK, реклама, аналитика идут напрямую в сеть без кэша.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Кладём удачные ответы в кэш на случай пропажи связи
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // Сети нет — отдаём что есть
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});
