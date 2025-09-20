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

// --- INÍCIO DA CORREÇÃO ---
// Lê a configuração do Dash diretamente da página para descobrir o caminho base
let APP_PATH_PREFIX = '/'; // Define um padrão
try {
    const dashConfig = JSON.parse(document.getElementById('_dash-config').textContent);
    if (dashConfig && dashConfig.requests_pathname_prefix) {
        APP_PATH_PREFIX = dashConfig.requests_pathname_prefix;
    }
} catch (e) {
    console.error("Não foi possível ler a configuração do Dash para o prefixo do caminho.", e);
}
// --- FIM DA CORREÇÃO ---

// Inicializa o app
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Habilita a persistência de dados offline
try {
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
  const collectionsToCache = ['categorias', 'subcategorias', 'produtos', 'medidas', 'carrinho'];
  const promises = collectionsToCache.map(collectionName => db.collection(collectionName).get());
  
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

// --- LÓGICA DE AUTENTICAÇÃO PRINCIPAL (CORRIGIDA) ---
function runAuthLogic() {
    auth.onAuthStateChanged(user => {
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;

        const appContent = document.getElementById('app-content');
        const sidebar = document.getElementById('sidebar');
        const pageContainer = document.getElementById('page-container');
        
        // --- USA A VARIÁVEL APP_PATH_PREFIX ---
        const loginPath = `${APP_PATH_PREFIX}login`;
        const rootPath = APP_PATH_PREFIX;

        if (user) {
            loadingScreen.style.display = 'none';
            if (appContent) appContent.style.display = 'block';
            if (sidebar) sidebar.style.display = 'flex';
            
            // Se o usuário logado estiver na página de login, redireciona para a raiz correta
            if (window.location.pathname === loginPath) {
                window.location.href = rootPath;
            }
            preCacheEssentialData();
        } else {
            // Se o usuário não estiver logado...
            if (window.location.pathname === loginPath) {
                // ...e já está na página de login, apenas mostra o conteúdo
                loadingScreen.style.display = 'none';
                if (appContent) appContent.style.display = 'block';
                if (sidebar) sidebar.style.display = 'none';
                if (pageContainer) pageContainer.style.marginLeft = '0px';
            } else {
                // ...e está em qualquer outra página, redireciona para o login correto
                window.location.href = loginPath;
            }
        }
    });
}

// --- MECANISMO DE POLLING PARA ESPERAR O DASH (sem alterações) ---
const maxRetries = 50;
let retries = 0;
const readyCheckInterval = setInterval(() => {
    const appContent = document.getElementById('app-content');
    if (appContent) {
        clearInterval(readyCheckInterval);
        console.log("Dash app content detectado. Iniciando lógica de autenticação.");
        runAuthLogic();
    } else {
        retries++;
        if (retries > maxRetries) {
            clearInterval(readyCheckInterval);
            console.error("CRÍTICO: O elemento 'app-content' não foi encontrado no DOM após 5 segundos.");
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.innerHTML = '<div class="text-center"><p class="font-bold text-red-600">Erro Crítico</p><p class="text-gray-600">Não foi possível carregar a aplicação.</p></div>';
            }
        }
    }
}, 100);