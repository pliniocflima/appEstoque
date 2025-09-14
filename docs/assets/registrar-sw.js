// assets/registrar-sw.js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/assets/sw.js')
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