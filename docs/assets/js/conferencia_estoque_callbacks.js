// assets/js/conferencia_estoque_callbacks.js
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

    // 1. Carrega os dados do Firestore e gera a tabela
    loadAndDisplayStockData: function(pathname, timestamp) {
        if (pathname !== '/conferencia-estoque') {
            return window.dash_clientside.no_update;
        }

        return new Promise(resolve => {
            db.collection("subcategorias").get().then(querySnapshot => {
                const subcategorias = [];
                const originalValues = {};
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    data.id = doc.id; // Importante: guardamos o ID do documento
                    subcategorias.push(data);
                    originalValues[doc.id] = data.estoqueAtual;
                });

                // Ordena os dados como no código Python original
                subcategorias.sort((a, b) => {
                    const catA = a.categoria || '';
                    const catB = b.categoria || '';
                    const nomeA = a.nome || '';
                    const nomeB = b.nome || '';
                    if (catA < catB) return -1;
                    if (catA > catB) return 1;
                    if (nomeA < nomeB) return -1;
                    if (nomeA > nomeB) return 1;
                    return 0;
                });
                
                // Resolve a Promise com os dados para os dcc.Store
                resolve([subcategorias, originalValues]);
            });
        });
    },

    // 2. Habilita/desabilita o botão de salvar da linha
    updateStockSaveButtonState: function(inputValue, originalValues, inputId) {
        if (originalValues === null || inputValue === null) {
            // Se os dados ainda não carregaram, não faz nada
            return window.dash_clientside.no_update;
        }
        const itemId = inputId.index;
        const originalValue = originalValues[itemId];

        // Compara o valor atual (convertido para número) com o original
        if (parseFloat(inputValue) !== parseFloat(originalValue)) {
            // Habilitado
            return [false, "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white"];
        }
        // Desabilitado
        return [true, "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed"];
    },

    // 3. Salva o ajuste de estoque no Firestore
    saveStockAdjustment: function(n_clicks_list, input_values_list, all_data) {
        // Dash passa 'null' na primeira carga, então verificamos se a lista existe
        if (!n_clicks_list) {
            return window.dash_clientside.no_update;
        }

        // Descobre qual botão foi clicado procurando o que não é nulo/undefined
        const clicked_index = n_clicks_list.findIndex(n => n);
        if (clicked_index === -1) {
            // Nenhum botão foi clicado
            return window.dash_clientside.no_update;
        }

        // Pega os dados relevantes usando o índice do botão clicado
        // O Dash garante que a ordem dos componentes com ALL é a mesma
        const itemData = all_data[clicked_index];
        const novoEstoque = parseFloat(input_values_list[clicked_index]);
        const itemId = itemData.id;
        const estoqueAnterior = itemData.estoqueAtual;

        if (isNaN(novoEstoque)) {
            console.error("Valor de novo estoque é inválido.");
            return window.dash_clientside.no_update;
        }

        // --- LÓGICA DE ATUALIZAÇÃO E LOG ---
        const quantidadeAjustada = novoEstoque - (estoqueAnterior || 0);
        const tipoAjuste = quantidadeAjustada > 0 ? "acrescimo" : "decrescimo";

        const ajusteData = {
            data: new Date(), // O Firebase converte o objeto Date do JS corretamente
            subcategoria_id: itemId,
            subcategoria_nome: itemData.nome,
            quantidade_ajustada: Math.abs(quantidadeAjustada),
            tipo: tipoAjuste,
            estoque_anterior: estoqueAnterior || 0,
            novo_estoque: novoEstoque
        };

        // Criamos duas "promessas": uma para atualizar o estoque e outra para adicionar o log
        const updatePromise = db.collection('subcategorias').doc(itemId).update({ estoqueAtual: novoEstoque });
        const logPromise = db.collection('ajustes').add(ajusteData);

        // Promise.all espera que ambas as operações terminem
        return Promise.all([updatePromise, logPromise]).then(() => {
            console.log(`Estoque do item ${itemId} atualizado para ${novoEstoque} com sucesso.`);
            // Retorna a data/hora atual. Isso será a nova 'modified_timestamp' do nosso Store,
            // o que fará o primeiro callback (loadAndDisplayStockData) rodar novamente e recarregar os dados.
            return new Date().getTime();
        }).catch(error => {
            console.error("Erro ao salvar ajuste de estoque:", error);
            return window.dash_clientside.no_update;
        });
    },

    // 4. Gera a tabela de conferência dinamicamente
    generateStockTable: function(subcategorias) {
        if (!subcategorias) {
            // Retorna um componente Div vazio se não houver dados
            return {
                props: { id: 'dynamic-table' },
                type: 'Div',
                namespace: 'dash_html_components'
            };
        }

        // Função auxiliar para criar componentes Dash em JS
        const createComponent = (type, namespace, props) => ({ props, type, namespace });

        // Cria o Cabeçalho (Thead)
        const header = createComponent('Thead', 'dash_html_components', {
            children: createComponent('Tr', 'dash_html_components', {
                children: [
                    "Categoria", "Subcategoria", "Estoque Atual", "Unidade", "Ação"
                ].map(h => createComponent('Th', 'dash_html_components', {
                    children: h,
                    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                }))
            })
        });

        // Cria as Linhas (Tbody)
        const rows = subcategorias.map(item => createComponent('Tr', 'dash_html_components', {
            children: [
                createComponent('Td', 'dash_html_components', { children: item.categoria || 'N/A', className: "px-6 py-4 whitespace-nowrap" }),
                createComponent('Td', 'dash_html_components', { children: item.nome || 'N/A', className: "px-6 py-4 whitespace-nowrap font-semibold" }),
                createComponent('Td', 'dash_html_components', {
                    children: createComponent('Input', 'dash_core_components', {
                        id: { type: 'stock-input', index: item.id },
                        value: item.estoqueAtual,
                        type: 'number',
                        className: "w-full p-2 border rounded"
                    }),
                    className: "px-6 py-4"
                }),
                createComponent('Td', 'dash_html_components', { children: item.unidade || 'N/A', className: "px-6 py-4 whitespace-nowrap" }),
                createComponent('Td', 'dash_html_components', {
                    children: createComponent('Button', 'dash_html_components', {
                        children: createComponent('I', 'dash_html_components', { className: 'fas fa-check' }),
                        id: { type: 'save-button', index: item.id },
                        disabled: true,
                        className: "w-10 h-10 flex items-center justify-center rounded text-white bg-gray-300 cursor-not-allowed"
                    }),
                    className: "px-6 py-4"
                })
            ]
        }));
        
        const tbody = createComponent('Tbody', 'dash_html_components', { children: rows });

        // Retorna a Tabela completa
        return createComponent('Table', 'dash_html_components', {
            children: [header, tbody],
            id: 'dynamic-table',
            className: "min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow"
        });
    }
    
    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});