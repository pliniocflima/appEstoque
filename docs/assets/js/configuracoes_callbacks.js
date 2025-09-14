// assets/js/configuracoes_callbacks.js
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

    // 1. Carrega os dados iniciais
    loadConfigData: function(pathname, timestamp) {
        if (pathname !== '/configuracoes') { return window.dash_clientside.no_update; }
        return new Promise(resolve => {
            Promise.all([
                db.collection('subcategorias').get(),
                db.collection('medidas').get()
            ]).then(([subcatSnap, medSnap]) => {
                const format = (snap) => snap.docs.map(doc => ({...doc.data(), id: doc.id }));
                const all_data = {
                    subcategorias: format(subcatSnap),
                    medidas: format(medSnap)
                };
                const original_values = {};
                all_data.subcategorias.forEach(item => {
                    original_values[item.id] = {
                        estoqueMinimo: item.estoqueMinimo,
                        estoqueAlvo: item.estoqueAlvo,
                    };
                });
                all_data.medidas.forEach(item => {
                    original_values[item.id] = {
                        controle: item.controle,
                        unidadeControle: item.unidadeControle,
                        multiplicador: item.multiplicador
                    };
                });
                resolve([all_data, original_values]);
            });
        });
    },

    generateConfigTables: function(all_data) {
        // Se os dados ainda não chegaram, não renderiza nada
        if (!all_data) {
            const loadingMsg = { props: { children: "Carregando..." }, type: 'P', namespace: 'dash_html_components' };
            return [loadingMsg, loadingMsg];
        }

        const subcategorias = all_data.subcategorias || [];
        const medidas = all_data.medidas || [];

        // --- Lógica para criar os componentes em formato de dicionário ---
        const createComponent = (type, namespace, props) => ({ props, type, namespace });

        // --- Geração da Tabela 1: Parâmetros de Estoque ---
        const header_stock = createComponent('Thead', 'dash_html_components', {
            children: createComponent('Tr', 'dash_html_components', {
                children: ["Categoria", "Subcategoria", "Unidade", "Estoque Mínimo", "Estoque Alvo", "Ação"].map(h => createComponent('Th', 'dash_html_components', { children: h }))
            })
        });
        
        const rows_stock = subcategorias.map(item => createComponent('Tr', 'dash_html_components', {
            children: [
                createComponent('Td', 'dash_html_components', { children: item.categoria || 'N/A' }),
                createComponent('Td', 'dash_html_components', { children: item.nome || 'N/A' }),
                createComponent('Td', 'dash_html_components', { children: item.unidade || 'N/A' }),
                createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'config-edit-min', index: item.id }, value: item.estoqueMinimo, type: 'number', min: 0, className: "w-full p-2 border rounded" }) }),
                createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'config-edit-alvo', index: item.id }, value: item.estoqueAlvo, type: 'number', min: 0, className: "w-full p-2 border rounded" }) }),
                createComponent('Td', 'dash_html_components', { children: createComponent('Button', 'dash_html_components', { id: { type: 'config-save-button', index: item.id }, n_clicks: 0, children: createComponent('I', 'dash_html_components', { className: 'fas fa-check' }), className: "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed", disabled: true }) })
            ]
        }));
        const table_stock = createComponent('Table', 'dash_html_components', { children: [header_stock, createComponent('Tbody', 'dash_html_components', { children: rows_stock })], className: "w-full text-sm" });

        // --- Geração da Tabela 2: Medidas ---
        const sorted_medidas = (medidas || []).sort((a, b) => {
            const keyA = `${a.controle || ''}_${a.unidadeControle || ''}`.toLowerCase();
            const keyB = `${b.controle || ''}_${b.unidadeControle || ''}`.toLowerCase();
            return keyA.localeCompare(keyB);
        });

        const header_medidas = createComponent('Thead', 'dash_html_components', {
            children: createComponent('Tr', 'dash_html_components', {
                children: ["Controle", "Unidade de Controle", "Multiplicador", "Ação"].map(h => createComponent('Th', 'dash_html_components', { children: h }))
            })
        });

        const rows_medidas = sorted_medidas.map(item => createComponent('Tr', 'dash_html_components', {
            children: [
                createComponent('Td', 'dash_html_components', { 
                    children: createComponent('Input', 'dash_core_components', { id: { type: 'medidas-edit-controle', index: item.id }, value: item.controle, className: "w-full p-2 border rounded" }) 
                }),
                createComponent('Td', 'dash_html_components', { 
                    children: createComponent('Input', 'dash_core_components', { id: { type: 'medidas-edit-unidade', index: item.id }, value: item.unidadeControle, className: "w-full p-2 border rounded" }) 
                }),
                createComponent('Td', 'dash_html_components', { 
                    children: createComponent('Input', 'dash_core_components', { id: { type: 'medidas-edit-multiplicador', index: item.id }, value: item.multiplicador, type: 'number', className: "w-full p-2 border rounded" }) 
                }),
                createComponent('Td', 'dash_html_components', { 
                    children: createComponent('Div', 'dash_html_components', {
                        className: "flex gap-2 justify-center",
                        children: [
                            createComponent('Button', 'dash_html_components', { 
                                id: { type: 'medidas-update-button', index: item.id }, 
                                n_clicks: 0, 
                                children: createComponent('I', 'dash_html_components', { className: 'fas fa-check' }), 
                                className: "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed", 
                                disabled: true 
                            }),
                            createComponent('Button', 'dash_html_components', { 
                                id: { type: 'medidas-delete-button', index: item.id }, 
                                n_clicks: 0, 
                                children: createComponent('I', 'dash_html_components', { className: 'fas fa-trash-alt' }), 
                                className: "w-10 h-10 flex items-center justify-center rounded bg-red-500 hover:bg-red-700 text-white" 
                            })
                        ]
                    }) 
                })
            ]
        }));
        
        const table_medidas = createComponent('Table', 'dash_html_components', { 
            children: [header_medidas, createComponent('Tbody', 'dash_html_components', { children: rows_medidas })], 
            className: "w-full text-sm" 
        });
        
        // Retorna as duas tabelas completas para os dois Outputs
        return [table_stock, table_medidas];
    },

    // 2. Lógica de Parâmetros de Estoque
    toggleStockParamsSaveButton: function(est_min, est_alvo, button_id, original_values) { /* ...código da etapa anterior... */ },
    saveStockParams: function(n_clicks, all_min, all_alvo, all_ids) {
        if (!n_clicks) {
            return [window.dash_clientside.no_update, window.dash_clientside.no_update];
        }
        
        const triggered = dash_clientside.callback_context.triggered.find(t => t.value);
        if (!triggered) {
            return [window.dash_clientside.no_update, window.dash_clientside.no_update];
        }
        const prop_id = JSON.parse(triggered.prop_id.split('.')[0]);
        const itemId = prop_id.index;
        const itemIndex = all_ids.findIndex(id => id.index === itemId);

        const updates = {
            estoqueMinimo: parseFloat(all_min[itemIndex]) || 0,
            estoqueAlvo: parseFloat(all_alvo[itemIndex]) || 0
        };

        return new Promise(resolve => {
            db.collection('subcategorias').doc(itemId).update(updates).then(() => {
                const feedback = { props: { children: "Parâmetros de estoque atualizados!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback]);
            });
        });
    },
    
    // 3. Habilita/desabilita botão de ADICIONAR Medida
    toggleAddMedidaButton: function(controle, unidade, mult, all_data) {
        const disabledClass = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const enabledClass = "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white";
        if (!controle || !unidade || !mult || !all_data || !all_data.medidas) {
            return [true, disabledClass];
        }
        const exists = all_data.medidas.some(m => 
            m.controle.toLowerCase() === controle.trim().toLowerCase() &&
            m.unidadeControle.toLowerCase() === unidade.trim().toLowerCase()
        );
        return [exists, exists ? disabledClass : enabledClass];
    },

    // 4. Adiciona uma nova Medida
    addMedida: function(n_clicks, controle, unidade, mult) {
        if (!n_clicks) return [window.dash_clientside.no_update, null, null, null];
        const new_data = {
            controle: controle,
            unidadeControle: unidade,
            multiplicador: parseFloat(mult) || 1
        };
        return new Promise(resolve => {
            db.collection('medidas').add(new_data).then(() => {
                const feedback = { props: { children: "Medida adicionada!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback, "", "", null]);
            }).catch(error => {
                const feedback = { props: { children: `Erro: ${error.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([window.dash_clientside.no_update, feedback, controle, unidade, mult]);
            });
        });
    },

    // 5. Habilita/desabilita botão de SALVAR na tabela de Medidas
    toggleSaveMedidaButton: function(controle, unidade, mult, button_id, original_values) {
        const disabledClass = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const enabledClass = "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white";
        const itemId = button_id.index;
        if (!original_values || !original_values[itemId]) return [true, disabledClass];

        const original = original_values[itemId];
        const current_mult = parseFloat(mult) || 0;

        const hasChanged = original.controle !== controle ||
                           original.unidadeControle !== unidade ||
                           original.multiplicador !== current_mult;
        
        return [!hasChanged, hasChanged ? enabledClass : disabledClass];
    },

    // 6. Salva ou Deleta uma Medida da tabela
    handleMedidaActions: function(update_clicks, delete_clicks, all_controles, all_unidades, all_mults, all_ids) {
        if (!update_clicks || !delete_clicks) {
            return [window.dash_clientside.no_update, null];
        }

        const triggered = dash_clientside.callback_context.triggered.find(t => t.value);
        if (!triggered) return [window.dash_clientside.no_update, null];

        const prop_id = JSON.parse(triggered.prop_id.split('.')[0]);
        const itemId = prop_id.index;
        const action = prop_id.type;
        
        const itemIndex = all_ids.findIndex(id => id.index === itemId);

        return new Promise(resolve => {
            let feedback;
            if (action === 'medidas-delete-button') {
                db.collection('medidas').doc(itemId).delete().then(() => {
                    feedback = { props: { children: "Medida excluída!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                });
            } else if (action === 'medidas-update-button') {
                const updates = {
                    controle: all_controles[itemIndex],
                    unidadeControle: all_unidades[itemIndex],
                    multiplicador: parseFloat(all_mults[itemIndex]) || 1
                };
                db.collection('medidas').doc(itemId).update(updates).then(() => {
                    feedback = { props: { children: "Medida atualizada!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                });
            }
        });
    },

    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});