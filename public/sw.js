// IMM-OS Service Worker — Web Push Notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title   = data.title  || 'IMM-OS Notification'
  const options = {
    body:    data.body    || 'You have a new notification.',
    icon:    '/icon.png',
    badge:   '/badge.png',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
