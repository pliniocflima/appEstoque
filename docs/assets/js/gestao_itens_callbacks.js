// assets/js/gestao_itens_callbacks.js
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

    loadGestaoData: function(pathname, timestamp) {
        if (pathname !== '/gestao-itens') { return [window.dash_clientside.no_update, window.dash_clientside.no_update]; }
        return new Promise(resolve => {
            Promise.all([
                db.collection('categorias').get(),
                db.collection('subcategorias').get(),
                db.collection('produtos').get(),
                db.collection('medidas').get()
            ]).then(([catSnap, subcatSnap, prodSnap, medSnap]) => {
                const format = (snap) => snap.docs.map(doc => ({...doc.data(), id: doc.id }));
                
                // CORREÇÃO: Ordena os dados na carga para garantir consistência com a renderização do Python
                const cat_data = format(catSnap).sort((a, b) => (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase()));
                const sub_data = format(subcatSnap).sort((a, b) => {
                    const keyA = `${a.categoria || ''}_${a.nome || ''}`.toLowerCase();
                    const keyB = `${b.categoria || ''}_${b.nome || ''}`.toLowerCase();
                    return keyA.localeCompare(keyB);
                });
                const prod_data = format(prodSnap).sort((a, b) => {
                    const keyA = `${a.categoria || ''}_${a.subcategoria || ''}_${a.nome_app || ''}`.toLowerCase();
                    const keyB = `${b.categoria || ''}_${b.subcategoria || ''}_${b.nome_app || ''}`.toLowerCase();
                    return keyA.localeCompare(keyB);
                });

                const all_data = {
                    categorias: cat_data,
                    subcategorias: sub_data,
                    produtos: prod_data,
                    medidas: format(medSnap)
                };
                
                const original_values = {};
                all_data.categorias.forEach(item => { original_values[item.id] = { nome: item.nome }; });
                all_data.subcategorias.forEach(item => { original_values[item.id] = { nome: item.nome, categoria: item.categoria }; });
                all_data.produtos.forEach(item => { original_values[item.id] = { nome: item.nome }; });
                resolve([all_data, original_values]);

            }).catch(err => { console.error("Erro ao carregar dados de Gestão:", err); resolve([null, null]); });
        });
    },

    // --- LÓGICA DE CATEGORIAS ---
    toggleAddCategoryButton: function(name, data) {
        const disabledClass = "bg-gray-300 text-white font-bold py-2 px-4 rounded flex items-center justify-center cursor-not-allowed";
        const enabledClass = "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center";
        if (!name || !name.trim() || !data || !data.categorias) return [true, disabledClass];
        const exists = data.categorias.some(c => c.nome.toLowerCase() === name.trim().toLowerCase());
        return [exists, exists ? disabledClass : enabledClass];
    },
    addCategory: function(n_clicks, name) {
        if (!n_clicks || !name || !name.trim()) return [window.dash_clientside.no_update, null, ""];
        return new Promise(resolve => {
            db.collection('categorias').add({ nome: name.trim(), num_subcategorias: 0, num_produtos: 0 })
            .then(() => {
                const feedback = { props: { children: "Categoria adicionada!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback, ""]);
            }).catch(err => {
                const feedback = { props: { children: `Erro: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([window.dash_clientside.no_update, feedback, name]);
            });
        });
    },
    toggleSaveCategoryButton: function(newName, all_data, id_dict) {
        const disabledClass = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const enabledClass = "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white";
        
        // CORREÇÃO: Checa se all_data e all_data.categorias existem
        if (!newName || !all_data || !all_data.categorias) return [true, disabledClass];
        
        // CORREÇÃO: Usa 'all_data.categorias.find' em vez de 'all_data.find'
        const original = all_data.categorias.find(c => c.id === id_dict.index);
        const hasChanged = original && original.nome !== newName.trim();
        
        return [!hasChanged, hasChanged ? enabledClass : disabledClass];
    },
    handleCategoryActions: function(save_clicks, delete_clicks, names, all_data) {
        const triggered = dash_clientside.callback_context.triggered.find(t => t.value);
        if (!triggered) return [window.dash_clientside.no_update, null];
        
        const prop_id = JSON.parse(triggered.prop_id.split('.')[0]);
        const itemId = prop_id.index;
        const action = prop_id.type;

        const itemIndex = all_data.categorias.findIndex(c => c.id === itemId);
        if (itemIndex === -1) return [window.dash_clientside.no_update, null];
        
        const itemData = all_data.categorias[itemIndex];
        
        return new Promise(resolve => {
            let feedback;
            if (action === 'btn-delete-cat') {
                if (itemData.num_subcategorias > 0) {
                    feedback = { props: { children: "Erro: Exclua as subcategorias primeiro.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                    return resolve([window.dash_clientside.no_update, feedback]);
                }
                db.collection('categorias').doc(itemId).delete().then(() => {
                    feedback = { props: { children: "Categoria excluída!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                });

            } else if (action === 'btn-save-cat') {
                const newName = names[itemIndex];
                db.collection('categorias').doc(itemId).update({ nome: newName }).then(() => {
                    feedback = { props: { children: "Categoria atualizada!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                });
            }
        });
    },

    // --- LÓGICA DE SUBCATEGORIAS ---
    toggleAddSubcategoryButton: function(name, parentCat, unit, data) {
        const disabledClass = "bg-gray-300 text-white font-bold py-2 px-4 rounded flex items-center justify-center cursor-not-allowed";
        const enabledClass = "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center";
        if (!name || !name.trim() || !parentCat || !unit || !data || !data.subcategorias) return [true, disabledClass];
        const exists = data.subcategorias.some(s => s.nome.toLowerCase() === name.trim().toLowerCase() && s.categoria === parentCat);
        return [exists, exists ? disabledClass : enabledClass];
    },
    addSubcategory: function(n_clicks, name, parentCatName, unit, all_data) {
        if (!n_clicks) return [window.dash_clientside.no_update, null, null, null, null];

        // CORREÇÃO: Acessar 'all_data' diretamente, pois é um dicionário.
        const parentCat = all_data.categorias.find(c => c.nome === parentCatName);
        const selectedMeasure = all_data.medidas.find(m => m.unidadeControle === unit);

        if (!parentCat || !selectedMeasure) {
            const feedback = { props: { children: "Erro: Categoria ou Medida não encontrada.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
            return [window.dash_clientside.no_update, feedback, name, parentCatName, unit];
        }

        const newSubcatData = {
            nome: name.trim(),
            categoria: parentCatName,
            categoria_id: parentCat.id,
            unidade: unit,
            medida_id: selectedMeasure.id,
            controle: selectedMeasure.controle,
            num_produtos: 0,
            estoqueAtual: 0,
            estoqueMinimo: 0, // Adicionando valores padrão
            estoqueAlvo: 0   // Adicionando valores padrão
        };

        const catRef = db.collection('categorias').doc(parentCat.id);
        const newSubcatRef = db.collection('subcategorias').doc(); // Cria uma referência com ID novo

        return new Promise(resolve => {
            db.runTransaction(transaction => {
                return transaction.get(catRef).then(catDoc => {
                    if (!catDoc.exists) throw new Error("Categoria não existe no DB.");
                    
                    // Atualiza o contador na categoria
                    transaction.update(catRef, { num_subcategorias: firebase.firestore.FieldValue.increment(1) });
                    
                    // Cria a nova subcategoria
                    transaction.set(newSubcatRef, newSubcatData);
                });
            }).then(() => {
                const feedback = { props: { children: "Subcategoria adicionada!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback, "", null, null]);
            }).catch(err => {
                const feedback = { props: { children: `Erro: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([window.dash_clientside.no_update, feedback, name, parentCatName, unit]);
            });
        });
    },
    toggleSaveSubcategoryButton: function(parent_cat, name, original_values, id_dict) {
        const disabledClass = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const enabledClass = "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white";
        
        const itemId = id_dict.index;
        if (!original_values || !original_values[itemId] || !name || !parent_cat) {
            return [true, disabledClass];
        }
        
        const original = original_values[itemId];
        const hasChanged = original.nome !== name.trim() || original.categoria !== parent_cat;
        
        return [!hasChanged, hasChanged ? enabledClass : disabledClass];
    },
    handleSubcategoryActions: function(save_clicks, delete_clicks, parent_cats, names, button_ids, all_data) {
        const triggered = dash_clientside.callback_context.triggered.find(t => t.value);
        if (!triggered || !all_data) return [window.dash_clientside.no_update, null];

        const prop_id = JSON.parse(triggered.prop_id.split('.')[0]);
        const itemId = prop_id.index;
        const action = prop_id.type;

        // A ordenação agora é consistente, então o `findIndex` e o acesso pelo índice funcionarão
        const itemIndex = all_data.subcategorias.findIndex(s => s.id === itemId);
        if (itemIndex === -1) return [window.dash_clientside.no_update, null];

        const subcatData = all_data.subcategorias[itemIndex];

        return new Promise(resolve => {
            let feedback;
            if (action === 'btn-delete-subcat') {
                if (subcatData.num_produtos > 0) {
                    feedback = { props: { children: "Erro: Exclua os produtos desta subcategoria primeiro.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                    return resolve([window.dash_clientside.no_update, feedback]);
                }
                
                const cat_doc = all_data.categorias.find(c => c.nome === subcatData.categoria);
                if (!cat_doc) {
                    feedback = { props: { children: "Erro: Categoria pai não encontrada.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                    return resolve([window.dash_clientside.no_update, feedback]);
                }
                
                const catRef = db.collection('categorias').doc(cat_doc.id);
                const subcatRef = db.collection('subcategorias').doc(itemId);
                
                db.runTransaction(transaction => {
                    return transaction.get(catRef).then(catDoc => {
                        if (!catDoc.exists) { throw "Categoria não existe!"; }
                        transaction.update(catRef, { num_subcategorias: firebase.firestore.FieldValue.increment(-1) });
                        transaction.delete(subcatRef);
                    });
                }).then(() => {
                    feedback = { props: { children: "Subcategoria excluída!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                }).catch(err => {
                    feedback = { props: { children: `Erro na transação: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([window.dash_clientside.no_update, feedback]);
                });

            } else if (action === 'btn-save-subcat') {
                // Lógica de salvar (agora correta devido à ordenação)
                const newName = names[itemIndex];
                const newParentCat = parent_cats[itemIndex];
                db.collection('subcategorias').doc(itemId).update({ nome: newName, categoria: newParentCat }).then(() => {
                    feedback = { props: { children: "Subcategoria atualizada!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                });
            }
        });
    },

    // --- LÓGICA DE PRODUTOS ---
    updateProductPreview: function(name, qtd, un) {
        if (!name || !qtd || !un) return "";
        return `${name.trim()} ${qtd}${un}`;
    },
    filterProductUnits: function(subcatName, all_data) {
        if (!subcatName || !all_data) return [[], null];
        const subcat = all_data.subcategorias.find(s => s.nome === subcatName);
        if (!subcat) return [[], null];
        const medida = all_data.medidas.find(m => m.id === subcat.medida_id);
        if (!medida) return [[], null];
        const controlType = medida.controle;
        const filtered = all_data.medidas.filter(m => m.controle === controlType).sort((a, b) => (parseFloat(a.multiplicador) || 0) - (parseFloat(b.multiplicador) || 0));
        const options = filtered.map(m => ({ label: `${m.unidadeControle} (${m.controle})`, value: m.unidadeControle }));
        return [options, null];
    },
    addProduct: function(n_clicks, subcatName, nome, qtd, un, nome_app, all_data) {
        if (!n_clicks) {
            return [window.dash_clientside.no_update, null, null, null, null, null, null];
        }
        // Validação de entrada
        if (!subcatName || !nome || !qtd || !un || !nome_app) {
            const feedback = { props: { children: "Erro: Todos os campos são obrigatórios.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
            return [window.dash_clientside.no_update, feedback, subcatName, nome, qtd, un];
        }

        return new Promise(resolve => {
            // 1. Encontrar os documentos pai e a medida nos dados locais
            const parentSubcat = all_data.subcategorias.find(s => s.nome === subcatName);
            if (!parentSubcat) {
                const feedback = { props: { children: "Erro: Subcategoria não encontrada.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                return resolve([window.dash_clientside.no_update, feedback, subcatName, nome, qtd, un]);
            }
            
            const parentCat = all_data.categorias.find(c => c.id === parentSubcat.categoria_id);
            const selectedMeasure = all_data.medidas.find(m => m.unidadeControle === un);

            if (!parentCat || !selectedMeasure) {
                const feedback = { props: { children: "Erro: Categoria pai ou medida não encontrada.", className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                return resolve([window.dash_clientside.no_update, feedback, subcatName, nome, qtd, un]);
            }

            // 2. Montar o objeto do novo produto
            const newProductData = {
                categoria: parentCat.nome,
                categoria_id: parentCat.id,
                medida_id: selectedMeasure.id,
                nome: nome.trim(),
                nome_app: nome_app.trim(),
                quantidade_por_unidade: parseFloat(qtd),
                subcategoria: parentSubcat.nome,
                subcategoria_id: parentSubcat.id,
                unidade_de_medida: un
            };

            // 3. Preparar e executar a transação
            const catRef = db.collection('categorias').doc(parentCat.id);
            const subcatRef = db.collection('subcategorias').doc(parentSubcat.id);
            const newProdRef = db.collection('produtos').doc(); // Ref para um novo doc com ID automático

            db.runTransaction(transaction => {
                // A transação precisa ler os documentos antes de escrever neles
                return Promise.all([transaction.get(catRef), transaction.get(subcatRef)]).then(([catDoc, subcatDoc]) => {
                    if (!catDoc.exists || !subcatDoc.exists) {
                        throw new Error("Categoria ou Subcategoria não existe mais no banco de dados.");
                    }
                    
                    // Agendar as três escritas
                    transaction.set(newProdRef, newProductData); // 1. Criar o produto
                    transaction.update(subcatRef, { num_produtos: firebase.firestore.FieldValue.increment(1) }); // 2. Incrementar contador da subcategoria
                    transaction.update(catRef, { num_produtos: firebase.firestore.FieldValue.increment(1) }); // 3. Incrementar contador da categoria
                });
            }).then(() => {
                // Sucesso
                const feedback = { props: { children: "Produto adicionado com sucesso!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                // Limpa os campos de input
                resolve([new Date().getTime(), feedback, null, null, null, null]);
            }).catch(err => {
                // Erro
                const feedback = { props: { children: `Erro na transação: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                // Mantém os dados nos campos para o usuário corrigir
                resolve([window.dash_clientside.no_update, feedback, subcatName, nome, qtd, un]);
            });
        });
    },
    toggleSaveProductButton: function(name, original_values, id_dict) {
        const disabledClass = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const enabledClass = "w-10 h-10 flex items-center justify-center rounded bg-blue-500 hover:bg-blue-700 text-white";
        
        const itemId = id_dict.index;
        if (!original_values || !original_values[itemId] || !name) {
            return [true, disabledClass];
        }
        
        const original = original_values[itemId];
        const hasChanged = original.nome !== name.trim();
        
        return [!hasChanged, hasChanged ? enabledClass : disabledClass];
    },
    handleProductActions: function(save_clicks, delete_clicks, names, all_data) {
        const triggered = dash_clientside.callback_context.triggered.find(t => t.value);
        if (!triggered || !all_data) return [window.dash_clientside.no_update, null];

        const prop_id = JSON.parse(triggered.prop_id.split('.')[0]);
        const itemId = prop_id.index;
        const action = prop_id.type;

        const itemIndex = all_data.produtos.findIndex(p => p.id === itemId);
        if (itemIndex === -1) return [window.dash_clientside.no_update, null];

        const prodData = all_data.produtos[itemIndex];

        return new Promise(resolve => {
            let feedback;
            if (action === 'btn-delete-prod') {
                const subcatRef = db.collection('subcategorias').doc(prodData.subcategoria_id);
                const catRef = db.collection('categorias').doc(prodData.categoria_id);
                const prodRef = db.collection('produtos').doc(itemId);

                db.runTransaction(transaction => {
                    return Promise.all([transaction.get(subcatRef), transaction.get(catRef)]).then(([subcatDoc, catDoc]) => {
                        transaction.update(subcatRef, { num_produtos: firebase.firestore.FieldValue.increment(-1) });
                        transaction.update(catRef, { num_produtos: firebase.firestore.FieldValue.increment(-1) });
                        transaction.delete(prodRef);
                    });
                }).then(() => {
                    feedback = { props: { children: "Produto excluído!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                });

            } else if (action === 'btn-save-prod') { // <-- LÓGICA DE SALVAR ADICIONADA
                const newName = names[itemIndex];
                const newAppName = `${newName.trim()} ${prodData.quantidade_por_unidade}${prodData.unidade_de_medida}`;
                
                db.collection('produtos').doc(itemId).update({ 
                    nome: newName.trim(),
                    nome_app: newAppName 
                }).then(() => {
                    feedback = { props: { children: "Produto atualizado!", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([new Date().getTime(), feedback]);
                }).catch(err => {
                    feedback = { props: { children: `Erro: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                    resolve([window.dash_clientside.no_update, feedback]);
                });
            }
        });
    },

    toggleAddProductButton: function(subcat, name, qtd, unit, data) {
        const disabledClass = "bg-gray-300 text-white font-bold py-2 px-4 rounded flex items-center justify-center cursor-not-allowed";
        const enabledClass = "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center";

        if (!subcat || !name || !name.trim() || !qtd || !unit || !data || !data.produtos) {
            return [true, disabledClass];
        }
        
        // Checa se o produto já existe na mesma subcategoria
        const subcat_doc = data.subcategorias.find(s => s.nome === subcat);
        if (!subcat_doc) return [true, disabledClass];

        const previewName = `${name.trim()} ${qtd}${unit}`;
        const exists = data.produtos.some(p => 
            p.subcategoria_id === subcat_doc.id &&
            p.nome_app.toLowerCase() === previewName.toLowerCase()
        );

        return [exists, exists ? disabledClass : enabledClass];
    },

    // Gera todas as tabelas e dropdowns da página de Gestão
    generateAllTablesAndDropdowns: function(all_data) {
        const createComponent = (type, namespace, props) => ({ props, type, namespace });
        const no_data_msg = createComponent('P', 'dash_html_components', { children: "Carregando dados...", className: "text-center text-gray-500" });

        if (!all_data) {
            return [no_data_msg, no_data_msg, no_data_msg, [], [], []];
        }

        const { categorias, subcategorias, produtos, medidas } = all_data;
        const INPUT_CLASS = "w-full p-2 border rounded";
        const BUTTON_DISABLED_CLASS = "w-10 h-10 flex items-center justify-center rounded bg-gray-300 text-white cursor-not-allowed";
        const BUTTON_DELETE_CLASS = "w-10 h-10 flex items-center justify-center rounded bg-red-500 hover:bg-red-700 text-white";

        // Tabela de Categorias
        const cat_rows = categorias.map(c => createComponent('Tr', 'dash_html_components', { children: [
            createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'input-cat-name', index: c.id }, value: c.nome, className: INPUT_CLASS }) }),
            createComponent('Td', 'dash_html_components', { children: c.num_subcategorias || 0 }),
            createComponent('Td', 'dash_html_components', { children: c.num_produtos || 0 }),
            createComponent('Td', 'dash_html_components', { className: "flex gap-2", children: [
                createComponent('Button', 'dash_html_components', { children: createComponent('I', 'dash_html_components', { className: "fas fa-save" }), id: { type: 'btn-save-cat', index: c.id }, n_clicks: 0, className: BUTTON_DISABLED_CLASS, disabled: true }),
                createComponent('Button', 'dash_html_components', { children: createComponent('I', 'dash_html_components', { className: "fas fa-trash-alt" }), id: { type: 'btn-delete-cat', index: c.id }, n_clicks: 0, className: BUTTON_DELETE_CLASS })
            ]})
        ]}));
        const cat_table = createComponent('Table', 'dash_html_components', { className: "w-full text-sm", children: [
            createComponent('Thead', 'dash_html_components', { children: createComponent('Tr', 'dash_html_components', { children: ["Nome", "Nº Subcat.", "Nº Prod.", "Ações"].map(h => createComponent('Th', 'dash_html_components', { children: h })) }) }),
            createComponent('Tbody', 'dash_html_components', { children: cat_rows })
        ]});
        
        // Tabela de Subcategorias
        const cat_opts_dropdown = categorias.map(c => ({ label: c.nome, value: c.nome }));
        const sub_rows = subcategorias.map(s => createComponent('Tr', 'dash_html_components', { children: [
            createComponent('Td', 'dash_html_components', { children: createComponent('Dropdown', 'dash_core_components', { id: { type: 'dropdown-subcat-parent', index: s.id }, options: cat_opts_dropdown, value: s.categoria, clearable: false }) }),
            createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'input-subcat-name', index: s.id }, value: s.nome, className: INPUT_CLASS }) }),
            createComponent('Td', 'dash_html_components', { children: s.num_produtos || 0 }),
            createComponent('Td', 'dash_html_components', { className: "flex gap-2", children: [
                createComponent('Button', 'dash_html_components', { children: createComponent('I', 'dash_html_components', { className: "fas fa-save" }), id: { type: 'btn-save-subcat', index: s.id }, n_clicks: 0, className: BUTTON_DISABLED_CLASS, disabled: true }),
                createComponent('Button', 'dash_html_components', { children: createComponent('I', 'dash_html_components', { className: "fas fa-trash-alt" }), id: { type: 'btn-delete-subcat', index: s.id }, n_clicks: 0, className: BUTTON_DELETE_CLASS })
            ]})
        ]}));
        const sub_table = createComponent('Table', 'dash_html_components', { className: "w-full text-sm", children: [
            createComponent('Thead', 'dash_html_components', { children: createComponent('Tr', 'dash_html_components', { children: ["Categoria", "Subcategoria", "Nº Prod.", "Ações"].map(h => createComponent('Th', 'dash_html_components', { children: h })) }) }),
            createComponent('Tbody', 'dash_html_components', { children: sub_rows })
        ]});

        // Tabela de Produtos
        const prod_rows = produtos.map(p => createComponent('Tr', 'dash_html_components', { children: [
            createComponent('Td', 'dash_html_components', { children: p.categoria || 'N/A' }),
            createComponent('Td', 'dash_html_components', { children: p.subcategoria || 'N/A' }),
            createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'input-prod-name', index: p.id }, value: p.nome, className: INPUT_CLASS }) }),
            createComponent('Td', 'dash_html_components', { children: p.quantidade_por_unidade || 'N/A' }),
            createComponent('Td', 'dash_html_components', { children: p.unidade_de_medida || 'N/A' }),
            createComponent('Td', 'dash_html_components', { className: "flex gap-2", children: [
                createComponent('Button', 'dash_html_components', { children: createComponent('I', 'dash_html_components', { className: "fas fa-save" }), id: { type: 'btn-save-prod', index: p.id }, n_clicks: 0, className: BUTTON_DISABLED_CLASS, disabled: true }),
                createComponent('Button', 'dash_html_components', { children: createComponent('I', 'dash_html_components', { className: "fas fa-trash-alt" }), id: { type: 'btn-delete-prod', index: p.id }, n_clicks: 0, className: BUTTON_DELETE_CLASS })
            ]})
        ]}));
        const prod_table = createComponent('Table', 'dash_html_components', { className: "w-full text-sm", children: [
            createComponent('Thead', 'dash_html_components', { children: createComponent('Tr', 'dash_html_components', { children: ["Categoria", "Subcategoria", "Nome", "Qtd", "Unidade", "Ações"].map(h => createComponent('Th', 'dash_html_components', { children: h })) }) }),
            createComponent('Tbody', 'dash_html_components', { children: prod_rows })
        ]});

        // Opções para os Dropdowns de Adição
        const cat_options_add = categorias.map(c => ({ label: c.nome, value: c.nome }));
        const subcat_options_add = subcategorias.map(s => ({ label: `${s.nome} (${s.categoria})`, value: s.nome }));
        const unidade_options_add = medidas.sort((a,b) => `${a.controle}_${a.unidadeControle}`.localeCompare(`${b.controle}_${b.unidadeControle}`)).map(m => ({ label: `${m.unidadeControle} (${m.controle})`, value: m.unidadeControle }));

        return [cat_table, sub_table, prod_table, cat_options_add, subcat_options_add, unidade_options_add];
    },

    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});