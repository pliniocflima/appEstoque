// assets/sw.js

const CACHE_NAME = 'estoque-app-cache-v6'; // Mude a versão para forçar a atualização

// Lista de arquivos essenciais para o "esqueleto" da aplicação (App Shell)
const urlsToCache = [
  '/appEstoque/', // A página principal (index.html)
  '/appEstoque/_dash-layout',
  '/appEstoque/_dash-dependencies',
  '/appEstoque/assets/manifest.json',
  '/appEstoque/assets/icon-192x192.png',
  '/appEstoque/assets/icon-512x512.png'
];

self.addEventListener('install', event => {
  console.log(`Service Worker (${CACHE_NAME}): Instalando...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`Service Worker (${CACHE_NAME}): Cache aberto, adicionando o App Shell.`);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error(`Service Worker (${CACHE_NAME}): Falha na instalação do cache.`, err);
      })
  );
});

self.addEventListener('activate', event => {
  console.log(`Service Worker (${CACHE_NAME}): Ativando...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log(`Service Worker (${CACHE_NAME}): Deletando cache antigo: ${cache}`);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Apenas para requisições de navegação (ex: abrir o app)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Tenta servir do cache primeiro. Se não encontrar, busca na rede.
          return response || fetch(event.request);
        })
        .catch(() => {
          // Se tudo falhar (cache e rede), mostra a página principal do cache
          // Isso garante que o app sempre abra, mesmo offline.
          return caches.match('/appEstoque/');
        })
    );
  }
});