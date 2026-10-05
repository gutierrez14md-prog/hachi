// Hachi service worker: オフライン用キャッシュ + ケアのリマインド通知
const CACHE = 'hachi-v1'
const REMINDER = 'hachi-reminder'
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// ネットワーク優先。失敗したらキャッシュから返す (初回表示後はオフラインで動く)
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Web フォントは中身が変わらないのでキャッシュ優先 (オフラインでも同じ書体で出す)
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE).then(
        async (c) =>
          (await c.match(req)) ||
          fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone())
            return res
          }),
      ),
    )
    return
  }
  if (url.origin !== location.origin) return
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(async () => (await caches.match(req)) || (await caches.match('./')) || Response.error()),
  )
})

// アプリ側 (src/lib/reminder.ts) が書き出した予定表を読んで、今日ぶんを 1 日 1 回だけ通知する。
// 同じ判定がアプリ側にもあるので、変更するときは両方合わせること。
async function checkReminder() {
  const c = await caches.open(REMINDER)
  const res = await c.match('/__reminder')
  if (!res) return
  const data = await res.json()
  if (!data.enabled) return
  const now = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const key = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  if (`${p(now.getHours())}:${p(now.getMinutes())}` < data.time) return
  const notified = await c.match('/__notified')
  if (notified && (await notified.text()) === key) return
  const names = [...new Set(Object.keys(data.days).filter((k) => k <= key).flatMap((k) => data.days[k]))]
  if (!names.length) return
  await c.put('/__notified', new Response(key))
  await self.registration.showNotification(`今日の植物ケア ${names.length}件`, {
    body: names.slice(0, 5).join('、') + (names.length > 5 ? ' ほか' : ''),
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'care-reminder',
  })
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'care-reminder') e.waitUntil(checkReminder())
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))),
  )
})
