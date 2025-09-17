// assets/firebase-init.js

// Cole as credenciais do seu projeto Firebase aqui
const firebaseConfig = {
  apiKey: "AIzaSyAYKPv8nhzRLH-LNFPmI39eabP18CGaw_c",
  authDomain: "lista-de-compras-baf6e.firebaseapp.com",
  projectId: "lista-de-compras-baf6e",
  storageBucket: "lista-de-compras-baf6e.firebasestorage.app",
  messagingSenderId: "1024363183087",
  appId: "1:1024363183087:web:990ee2e06d41ad6e53141a",
  measurementId: "G-4J7WPFD5MM"
};

// Inicializa o app
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Habilita a persistência de dados offline
try {
    // A chamada de persistência também usa a sintaxe da v8/compat
    db.enablePersistence()
        .then(() => {
            console.log("Persistência de dados offline habilitada.");
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("A persistência falhou, provavelmente por múltiplas abas abertas.");
            } else if (err.code == 'unimplemented') {
                console.warn("O navegador atual não suporta persistência offline.");
            }
        });
} catch (e) {
    console.error("Erro ao tentar habilitar a persistência: ", e);
}

// --- FUNÇÃO DE PRÉ-CACHE ---
function preCacheEssentialData() {
  console.log("Iniciando pré-cache de dados essenciais para uso offline...");
  
  // Lista das coleções que são a base para o funcionamento offline
  const collectionsToCache = ['categorias', 'subcategorias', 'produtos', 'medidas', 'carrinho'];
  
  // Criamos uma promessa para cada leitura de coleção
  const promises = collectionsToCache.map(collectionName => db.collection(collectionName).get());
  
  // Promise.all espera que todas as leituras terminem
  Promise.all(promises)
    .then((snapshots) => {
        let totalDocs = 0;
        snapshots.forEach(snap => totalDocs += snap.size);
        console.log(`Pré-cache de dados essenciais concluído. ${totalDocs} documentos carregados para o cache.`);
    })
    .catch(err => {
        console.error("Erro durante o pré-cache de dados:", err);
    });
}

// --- LÓGICA DE AUTENTICAÇÃO PRINCIPAL ---
function runAuthLogic() {
    // Pega o prefixo do caminho base da configuração do Dash
    const basePath = (window.dash_clientside && window.dash_clientside.config && window.dash_clientside.config.requests_pathname_prefix) || '/';

    auth.onAuthStateChanged(user => {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;

        const appContent = document.getElementById('app-content');
        const sidebar = document.getElementById('sidebar');
        const pageContainer = document.getElementById('page-container');

        if (user) {
            loadingScreen.style.display = 'none';
            if (appContent) appContent.style.display = 'block';
            if (sidebar) sidebar.style.display = 'flex';
            // CORREÇÃO: Usa o basePath para o redirecionamento
            if (window.location.pathname.endsWith('/login')) window.location.href = basePath;
            preCacheEssentialData();
        } else {
            if (window.location.pathname.endsWith('/login')) {
                loadingScreen.style.display = 'none';
                if (appContent) appContent.style.display = 'block';
                if (sidebar) sidebar.style.display = 'none';
                if (pageContainer) pageContainer.style.marginLeft = '0px';
            } else {
                // CORREÇÃO: Usa o basePath para o redirecionamento
                window.location.href = `${basePath}login`;
            }
        }
    });
}

// --- MECANISMO DE POLLING PARA ESPERAR O DASH ---
const maxRetries = 50; // Tenta por até 5 segundos
let retries = 0;
const readyCheckInterval = setInterval(() => {
    // O alvo da nossa espera é o contêiner principal que o Dash renderiza
    const appContent = document.getElementById('app-content');

    if (appContent) {
        // SUCESSO: O Dash renderizou o layout.
        clearInterval(readyCheckInterval); // Para de verificar
        console.log("Dash app content detectado. Iniciando lógica de autenticação.");
        runAuthLogic(); // Executa a função principal
    } else {
        // AINDA NÃO: O layout não está pronto, tenta novamente.
        retries++;
        if (retries > maxRetries) {
            // FALHA: O layout nunca apareceu.
            clearInterval(readyCheckInterval);
            console.error("CRÍTICO: O elemento 'app-content' não foi encontrado no DOM após 5 segundos.");
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                // Mostra uma mensagem de erro para o usuário não ficar preso.
                loadingScreen.innerHTML = '<div class="text-center"><p class="font-bold text-red-600">Erro Crítico</p><p class="text-gray-600">Não foi possível carregar a aplicação.</p></div>';
            }
        }
    }
}, 100); // Verifica a cada 100ms