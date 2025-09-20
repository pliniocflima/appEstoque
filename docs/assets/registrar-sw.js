// assets/registrar-sw.js
if ('serviceWorker' in navigator) {
  const swPath = '/appEstoque/assets/sw.js'
  const swScope = '/appEstoque/';
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swPath, { scope: swScope })
      .then(registration => {
        console.log('Service Worker registrado com sucesso:', registration);
      })
      .catch(err => {
        console.error('Falha ao registrar o Service Worker:', err);
      });
  });
} else {
  console.log('Service Worker não é suportado neste navegador.');
}