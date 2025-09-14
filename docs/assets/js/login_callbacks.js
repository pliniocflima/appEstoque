// assets/js/login_callbacks.js
// Garante que o namespace principal já exista, sem sobrescrevê-lo
window.dash_clientside = window.dash_clientside || {};
window.dash_clientside.clientside = window.dash_clientside.clientside || {};

// Adiciona as funções desta página ao namespace 'clientside'
Object.assign(window.dash_clientside.clientside, {

    // +---------------------------------------------------------------------------------------------+
    // |                                                                                             |
    // |    1. CALLBACKS                                                                             |
    // |                                                                                             |
    // +---------------------------------------------------------------------------------------------+

    // 1. Faz autenticação de login no firebase
    signInUser: function(n_clicks, email, password) {
        if (!n_clicks) { return window.dash_clientside.no_update; }
        if (!email || !password) {
            return [null, "Por favor, preencha e-mail e senha."];
        }
        
        return new Promise(resolve => {
            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Sucesso no login, o onAuthStateChanged vai cuidar do resto.
                    // Apenas limpamos a mensagem de erro.
                    resolve([null, ""]); 
                })
                .catch((error) => {
                    // Retorna a mensagem de erro do Firebase para o Dash
                    resolve([null, error.message]);
                });
        });
    },

    // 2. Cria usuário no firebase
    signUpUser: function(n_clicks, username, email, password) {
        if (!n_clicks) { return window.dash_clientside.no_update; }
        if (!username || !email || !password) {
            return "Por favor, preencha todos os campos.";
        }

        return new Promise(resolve => {
            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Após criar, atualiza o perfil com o nome de usuário
                    return userCredential.user.updateProfile({
                        displayName: username
                    });
                })
                .then(() => {
                    // Sucesso!
                    resolve("Usuário criado com sucesso. Aguarde aprovação.");
                })
                .catch((error) => {
                    resolve(error.message); // Retorna o erro
                });
        });
    },

    // 3. Faz logout no sistema
    signOutUser: function(n_clicks) {
        if (!n_clicks) { return window.dash_clientside.no_update; }
        return new Promise(resolve => {
            auth.signOut().then(() => {
                // Sucesso no logout, o onAuthStateChanged vai cuidar do redirecionamento.
                // Usamos a saída 'data' apenas para confirmar que o callback rodou.
                resolve(true); 
            });
        });
    },

    // 4. Envia email de redefinição de senha
    resetPassword: function(n_clicks, email) {
        if (!n_clicks) {
            return window.dash_clientside.no_update;
        }
        if (!email) {
            return "Por favor, informe seu e-mail para redefinir a senha.";
        }
        return new Promise(resolve => {
            auth.sendPasswordResetEmail(email)
                .then(() => {
                    // Retorna um objeto para formatar como HTML verde no Dash
                    resolve({
                        props: {
                            children: `E-mail de redefinição enviado para ${email}.`,
                            className: "text-green-500"
                        },
                        type: 'Span',
                        namespace: 'dash_html_components'
                    });
                })
                .catch((error) => {
                    resolve(error.message); // Retorna a mensagem de erro do Firebase
                });
        });
    },

    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});