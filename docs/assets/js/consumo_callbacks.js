// assets/js/consumo_callbacks.js.js
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

    // 1. Carrega os dados iniciais para os dropdowns
    loadConsumoData: function(pathname, timestamp) {
        if (pathname !== '/consumo') {
            return window.dash_clientside.no_update;
        }
        return new Promise(resolve => {
            Promise.all([
                db.collection('categorias').get(),
                db.collection('subcategorias').get()
            ]).then(([catSnap, subcatSnap]) => {
                const format = (snap) => snap.docs.map(doc => ({...doc.data(), id: doc.id }));
                const data = {
                    categorias: format(catSnap),
                    subcategorias: format(subcatSnap)
                };
                const cat_options = data.categorias
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map(c => ({ label: c.nome, value: c.nome }));
                resolve([data, cat_options]);
            }).catch(err => { console.error("Erro ao carregar dados de consumo:", err); resolve([null, []]); });
        });
    },

    // 2. Atualiza as opções do dropdown de subcategoria quando uma categoria é selecionada
    updateConsumoSubcatOptions: function(cat_name, data) {
        if (!data) {
            return [];
        }
        let filtered_subcats = data.subcategorias;
        if (cat_name) {
            filtered_subcats = data.subcategorias.filter(s => s.categoria === cat_name);
        }
        return filtered_subcats
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(s => ({ label: s.nome, value: s.nome }));
    },
    
    // 3. Atualiza os campos auxiliares (unidade, placeholder de estoque)
    updateConsumoAuxFields: function(subcat_name, data) {
        if (!data || !subcat_name) {
            return ["", "Selecione um item"];
        }
        const subcat = data.subcategorias.find(s => s.nome === subcat_name);
        if (subcat) {
            const unit = subcat.unidade || 'N/D';
            const stock = subcat.estoqueAtual;
            const placeholder = stock !== undefined ? `Estoque: ${stock}` : "Sem estoque";
            return [unit, placeholder];
        }
        return ["", "Item não encontrado"];
    },

    // 4. Habilita/desabilita o botão de salvar do lançamento rápido
    updateQuickLaunchButtonState: function(subcat_name, quantidade, data) {
        const disabledClass = "bg-gray-300 text-white font-bold py-2 px-4 rounded h-[42px] cursor-not-allowed";
        const normalClass = "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded h-[42px]";
        const warnClass = "bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded h-[42px]";

        if (!subcat_name || !quantidade || parseFloat(quantidade) <= 0 || !data) {
            return [true, disabledClass];
        }
        
        const subcat = data.subcategorias.find(s => s.nome === subcat_name);
        if (!subcat) return [true, disabledClass];

        const estoqueAtual = subcat.estoqueAtual || 0;
        if (parseFloat(quantidade) > estoqueAtual) {
            return [false, warnClass]; // Habilitado, mas com aviso
        }
        return [false, normalClass]; // Habilitado
    },

    // 5. Salva o lançamento de consumo
    handleSaveConsumo: function(n_clicks, date, time, cat_name, subcat_name, quantidade, all_data) {
        if (!n_clicks) return [window.dash_clientside.no_update, null, null, null, null];

        if (!date || !time || !subcat_name || !quantidade) {
            const feedback = { props: { children: "Por favor, preencha todos os campos.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
            return [feedback, window.dash_clientside.no_update, quantidade, cat_name, subcat_name];
        }
        
        const subcat_doc = all_data.subcategorias.find(s => s.nome === subcat_name);
        if (!subcat_doc) {
             const feedback = { props: { children: `Erro: Subcategoria '${subcat_name}' não encontrada.`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
            return [feedback, window.dash_clientside.no_update, quantidade, cat_name, subcat_name];
        }

        const utc_date = new Date(`${date}T${time}:00`);
        const consumo_data = {
            "data": utc_date,
            "subcategoria_id": subcat_doc.id,
            "quantidade_consumida": parseFloat(quantidade),
            "unidade_consumida": subcat_doc.unidade || 'N/D'
        };

        const consumoPromise = db.collection('consumos').add(consumo_data);
        const updatePromise = db.collection('subcategorias').doc(subcat_doc.id).update({
            estoqueAtual: firebase.firestore.FieldValue.increment(-parseFloat(quantidade))
        });

        return new Promise(resolve => {
            Promise.all([consumoPromise, updatePromise]).then(() => {
                const feedback = { props: { children: "Consumo salvo com sucesso!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([feedback, new Date().getTime(), null, null, null]);
            }).catch(error => {
                const feedback = { props: { children: `Erro: ${error.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([feedback, window.dash_clientside.no_update, quantidade, cat_name, subcat_name]);
            });
        });
    },

    // 6. Habilita/desabilita o botão de salvar da tabela
    toggleTableConsumeButton: function(value, all_data, input_id) {
        const disabledClass = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const normalClass = "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white";
        const warnClass = "w-10 h-10 flex items-center justify-center rounded bg-yellow-500 hover:bg-yellow-700 text-white";

        const consumo_val = parseFloat(value);
        if (!consumo_val || consumo_val <= 0) {
            return [true, disabledClass];
        }
        
        const itemId = input_id.index;
        const item = all_data.subcategorias.find(s => s.id === itemId);
        if (!item) return [true, disabledClass];

        const estoque_atual = item.estoqueAtual || 0;
        if (consumo_val > estoque_atual) {
            return [false, warnClass]; // Habilita com aviso
        }
        return [false, normalClass]; // Habilita
    },

    // 7. Salva o consumo a partir de uma linha da tabela
    saveTableConsumption: function(n_clicks, all_values, all_ids, all_data, consumption_date, consumption_hour) {
        const clicked_index = n_clicks.findIndex(n => n);
        if (clicked_index === -1) {
            return [window.dash_clientside.no_update, null, all_values];
        }

        const value = all_values[clicked_index];
        const itemId = all_ids[clicked_index].index;

        if (!value || parseFloat(value) <= 0) {
            return [window.dash_clientside.no_update, null, all_values];
        }

        const subcat_doc = all_data.subcategorias.find(s => s.id === itemId);
        if (!subcat_doc) {
            return [window.dash_clientside.no_update, {props:{children:"Subcategoria não encontrada"}}, all_values];
        }

        const utc_date = new Date(`${consumption_date}T${consumption_hour}:00`);
        const consumo_data = {
            "data": utc_date,
            "subcategoria_id": subcat_doc.id,
            "quantidade_consumida": parseFloat(value),
            "unidade_consumida": subcat_doc.unidade || 'N/D'
        };
        
        // Zera o valor do input específico que foi salvo
        const new_all_values = [...all_values];
        new_all_values[clicked_index] = null;

        const consumoPromise = db.collection('consumos').add(consumo_data);
        const updatePromise = db.collection('subcategorias').doc(subcat_doc.id).update({
            estoqueAtual: firebase.firestore.FieldValue.increment(-parseFloat(value))
        });

        return new Promise(resolve => {
            Promise.all([consumoPromise, updatePromise]).then(() => {
                const feedback = { props: { children: "Consumo salvo!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback, new_all_values]);
            });
        });
    },
    
    // 8. Gera a tabela de consumo dinamicamente
    generateConsumptionTable: function(data) {
        if (!data || !data.subcategorias) {
            return {
                props: { children: "Nenhum item em estoque para exibir." },
                type: 'P',
                namespace: 'dash_html_components'
            };
        }

        const createComponent = (type, namespace, props) => ({ props, type, namespace });
        
        // Ordena os dados como no Python
        const subcategorias = data.subcategorias.sort((a, b) => {
            const keyA = `${a.categoria || ''}_${a.nome || ''}`.toLowerCase();
            const keyB = `${b.categoria || ''}_${b.nome || ''}`.toLowerCase();
            return keyA.localeCompare(keyB);
        });

        const header = createComponent('Thead', 'dash_html_components', {
            children: createComponent('Tr', 'dash_html_components', {
                children: [
                    "Categoria", "Subcategoria", "Estoque Atual", "Qtd. Consumida", "Ação"
                ].map(h => createComponent('Th', 'dash_html_components', {
                    children: h,
                    className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                }))
            })
        });

        const rows = subcategorias.map(item => {
            const estoque_atual = item.estoqueAtual || 0;
            return createComponent('Tr', 'dash_html_components', {
                children: [
                    createComponent('Td', 'dash_html_components', { children: item.categoria || 'N/A', className: "px-6 py-4 whitespace-nowrap" }),
                    createComponent('Td', 'dash_html_components', { children: item.nome || 'N/A', className: "px-6 py-4 whitespace-nowrap font-semibold" }),
                    createComponent('Td', 'dash_html_components', { children: `${estoque_atual} ${item.unidade || ''}`, className: "px-6 py-4 whitespace-nowrap" }),
                    createComponent('Td', 'dash_html_components', {
                        children: createComponent('Input', 'dash_core_components', {
                            id: { type: 'consumo-input-tabela', index: item.id },
                            type: 'number',
                            min: 0,
                            placeholder: `Max: ${estoque_atual}`,
                            className: "w-full p-2 border rounded"
                        })
                    }),
                    createComponent('Td', 'dash_html_components', {
                        children: createComponent('Button', 'dash_html_components', {
                            children: createComponent('I', 'dash_html_components', { className: 'fas fa-cart-arrow-down' }),
                            id: { type: 'btn-consumo-tabela', index: item.id },
                            className: "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed",
                            disabled: true
                        })
                    })
                ]
            });
        });

        const tbody = createComponent('Tbody', 'dash_html_components', { children: rows });

        return createComponent('Table', 'dash_html_components', {
            children: [header, tbody],
            className: "min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow"
        });
    },
    
    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});