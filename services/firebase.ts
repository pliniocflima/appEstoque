import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence,
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED 
} from 'firebase/firestore';

// --- CONFIGURAÇÃO DO FIREBASE ---
// 1. Vá no Console do Firebase (https://console.firebase.google.com/)
// 2. Entre no seu projeto > Configurações do Projeto (ícone de engrenagem)
// 3. Role até "Seus aplicativos" e copie o objeto "firebaseConfig"
// 4. Cole os valores abaixo:

const firebaseConfig = {
  apiKey: "AIzaSyAYKPv8nhzRLH-LNFPmI39eabP18CGaw_c",
  authDomain: "lista-de-compras-baf6e.firebaseapp.com",
  projectId: "lista-de-compras-baf6e",
  storageBucket: "lista-de-compras-baf6e.firebasestorage.app",
  messagingSenderId: "1024363183087",
  appId: "1:1024363183087:web:990ee2e06d41ad6e53141a",
  measurementId: "G-4J7WPFD5MM"
};

// Verificação de segurança para desenvolvimento
if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
  console.error("ERRO CRÍTICO: Firebase não configurado.");
  alert("O Firebase não foi configurado!\n\nEdite o arquivo 'services/firebase.ts' e coloque suas chaves reais do Console do Firebase.");
}

const app = firebase.initializeApp(firebaseConfig);

// Initialize Cloud Firestore with settings optimized for PWAs
// We use the modular initializeFirestore with the compat app instance, which works in v9.
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

// Enable Offline Persistence
try {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistência falhou: Múltiplas abas abertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistência falhou: Navegador não suporta.');
    }
  });
} catch (e) {
  console.log("Erro ao inicializar persistência (pode já estar ativa):", e);
}

// Use compat Auth instance
const auth = firebase.auth();

export { db, auth };