// Service Worker: mostra as notificações e abre o app ao tocar nelas.
// Não guarda cache de arquivos, então suas atualizações sempre aparecem.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});   // exigido por alguns navegadores para instalar o app

// Já preparado para o passo 4.2 (aviso enviado pelo servidor)
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* sem dados */ }
  event.waitUntil(self.registration.showNotification(d.titulo || 'Agenda', {
    body: d.corpo || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag,
  }));
});

// Ao tocar na notificação: foca o app aberto ou abre uma janela nova
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});