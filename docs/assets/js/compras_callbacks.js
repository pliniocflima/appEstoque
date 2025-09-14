// assets/js/compras_callbacks.js
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

    // FUNÇÃO AUXILIAR para calcular a quantidade sugerida com conversão de unidades
    calculateSuggestedQuantity: function(subcat, product, medidas) {
        if (!subcat || !product || !medidas || !product.quantidade_por_unidade) {
            return 1; // Retorna 1 como fallback
        }

        const sugestao_base = (subcat.estoqueAlvo || 0) - (subcat.estoqueAtual || 0);
        if (sugestao_base <= 0) {
            return 1; // Se não precisa comprar, retorna 1 como padrão
        }

        const medida_base = medidas.find(m => m.unidadeControle === subcat.unidade);
        const medida_produto = medidas.find(m => m.unidadeControle === product.unidade_de_medida);

        if (!medida_base || !medida_produto || medida_base.controle !== medida_produto.controle) {
            // Se as medidas não existem ou não são do mesmo tipo (Peso, Volume), não converte
            return 1;
        }

        const multiplicador_base = medida_base.multiplicador || 1;
        const multiplicador_produto = medida_produto.multiplicador || 1;

        // Converte tudo para a menor unidade de medida
        const sugestao_convertida = sugestao_base * multiplicador_base;
        const produto_convertido = product.quantidade_por_unidade * multiplicador_produto;
        
        if (produto_convertido === 0) return 1;

        const qtd_final = Math.ceil(sugestao_convertida / produto_convertido);
        return qtd_final > 0 ? qtd_final : 1;
    },

    // 1. Carrega todos os dados da página (gerais e do carrinho)
    loadComprasData: function(pathname, timestamp) {
        if (pathname !== '/compras') { return [window.dash_clientside.no_update, window.dash_clientside.no_update]; }
        
        return new Promise(resolve => {
            Promise.all([
                db.collection('categorias').get(),
                db.collection('subcategorias').get(),
                db.collection('produtos').get(),
                db.collection('medidas').get(),
                db.collection('carrinho').get() // Carrega o carrinho junto
            ]).then(([catSnap, subcatSnap, prodSnap, medSnap, cartSnap]) => {
                const format = (snap) => snap.docs.map(doc => ({...doc.data(), id: doc.id }));
                const all_data = {
                    categorias: format(catSnap),
                    subcategorias: format(subcatSnap),
                    produtos: format(prodSnap),
                    medidas: format(medSnap)
                };
                const cart_data = format(cartSnap);
                resolve([all_data, cart_data]);
            }).catch(err => { console.error("Erro ao carregar dados de compras:", err); resolve([null, null]); });
        });
    },

    // 2. Lógica dos dropdowns de Lançamento Rápido
    updateComprasDropdowns: function(cat_value, subcat_value, prod_id, all_data) {
        const ctx = dash_clientside.callback_context;
        if (!all_data) {
            return [[], [], [], null, null, null];
        }

        const { categorias, subcategorias, produtos } = all_data;

        const cat_options = categorias.sort((a, b) => a.nome.localeCompare(b.nome)).map(c => ({ label: c.nome, value: c.nome }));
        const subcat_options_full = subcategorias.sort((a, b) => a.nome.localeCompare(b.nome)).map(s => ({ label: s.nome, value: s.nome }));
        const prod_options_full = produtos.sort((a, b) => a.nome_app.localeCompare(b.nome_app)).map(p => ({ label: p.nome_app, value: p.id }));
        
        if (ctx.triggered.length === 0 || ctx.triggered.every(t => t.prop_id === 'store-compras-all-data.data')) {
            return [cat_options, subcat_options_full, prod_options_full, null, null, null];
        }
        
        const triggered_id = ctx.triggered_id ? ctx.triggered_id.split('.')[0] : null;

        // LÓGICA DE ATALHO: Usuário selecionou um PRODUTO
        if (triggered_id === 'compra-produto-dropdown') {
            if (prod_id) {
                const product = produtos.find(p => p.id === prod_id);
                if (product) {
                    const subcat_options_filtered = subcategorias.filter(s => s.categoria === product.categoria).sort((a,b)=>a.nome.localeCompare(b.nome)).map(s => ({ label: s.nome, value: s.nome }));
                    const prod_options_filtered = produtos.filter(p => p.subcategoria === product.subcategoria).sort((a,b)=>a.nome_app.localeCompare(b.nome_app)).map(p => ({ label: p.nome_app, value: p.id }));
                    return [cat_options, subcat_options_filtered, prod_options_filtered, product.categoria, product.subcategoria, prod_id];
                }
            } else { // Limpou o produto
                const subcat = subcategorias.find(s => s.nome === subcat_value);
                if (subcat) {
                    const prod_options_filtered = produtos.filter(p => p.subcategoria_id === subcat.id).sort((a,b)=>a.nome_app.localeCompare(b.nome_app)).map(p => ({ label: p.nome_app, value: p.id }));
                    return [dash_clientside.no_update, dash_clientside.no_update, prod_options_filtered, cat_value, subcat_value, null];
                }
            }
        }

        // LÓGICA DE ATALHO: Usuário selecionou uma SUBCATEGORIA (VERSÃO CORRIGIDA)
        if (triggered_id === 'compra-subcategoria-dropdown') {
            if (subcat_value) {
                const subcat = subcategorias.find(s => s.nome === subcat_value);
                if (subcat) {
                    // Filtra as opções de subcategoria para a categoria pai
                    const subcat_options_filtered = subcategorias
                        .filter(s => s.categoria === subcat.categoria)
                        .sort((a,b)=>a.nome.localeCompare(b.nome))
                        .map(s => ({ label: s.nome, value: s.nome }));

                    const prod_options_filtered = produtos.filter(p => p.subcategoria_id === subcat.id).sort((a,b)=>a.nome_app.localeCompare(b.nome_app)).map(p => ({ label: p.nome_app, value: p.id }));
                    
                    return [cat_options, subcat_options_filtered, prod_options_filtered, subcat.categoria, subcat_value, null];
                }
            } else { // Limpou a subcategoria
                const subcats_filtered = cat_value ? subcategorias.filter(s => s.categoria === cat_value) : subcat_options_full;
                const subcat_opts_filtered = subcats_filtered.sort((a,b)=>a.nome.localeCompare(b.nome)).map(s => ({ label: s.nome, value: s.nome }));
                return [dash_clientside.no_update, subcat_opts_filtered, prod_options_full, cat_value, null, null];
            }
        }

        // LÓGICA PADRÃO: Usuário selecionou uma CATEGORIA
        if (triggered_id === 'compra-categoria-dropdown') {
            if (cat_value) {
                const subcats_filtered = subcategorias.filter(s => s.categoria === cat_value);
                const subcat_ids_filtered = subcats_filtered.map(s => s.id);
                const subcat_options_filtered = subcats_filtered.sort((a, b) => a.nome.localeCompare(b.nome)).map(s => ({ label: s.nome, value: s.nome }));
                const prod_options_filtered = produtos.filter(p => subcat_ids_filtered.includes(p.subcategoria_id)).sort((a, b) => a.nome_app.localeCompare(b.nome_app)).map(p => ({ label: p.nome_app, value: p.id }));
                return [cat_options, subcat_options_filtered, prod_options_filtered, cat_value, null, null];
            } else { // Limpou a categoria
                return [cat_options, subcat_options_full, prod_options_full, null, null, null];
            }
        }

        // Fallback: reseta tudo
        return [cat_options, subcat_options_full, prod_options_full, null, null, null];
    },

    // 3. Adiciona um item ao carrinho pelo Lançamento Rápido
    addToCartQuickLaunch: function(n_clicks, prod_id, qtd, preco, all_data) {
        if (!n_clicks || !prod_id || !qtd || !preco) {
            const feedback = { props: { children: "Preencha todos os campos.", className: "text-yellow-500" }, type: 'Span', namespace: 'dash_html_components' };
            return [window.dash_clientside.no_update, feedback, window.dash_clientside.no_update, window.dash_clientside.no_update, window.dash_clientside.no_update];
        }
        const produto = all_data.produtos.find(p => p.id === prod_id);
        if (!produto) return [window.dash_clientside.no_update, {props:{children:"Erro: Produto não encontrado"}}];
        
        const cart_item_data = {
            produto_id: prod_id,
            subcategoria_id: produto.subcategoria_id,
            quantidade: parseFloat(qtd),
            preco_unitario: parseFloat(preco)
        };

        return new Promise(resolve => {
            db.collection('carrinho').add(cart_item_data).then(() => {
                const feedback = { props: { children: `"${produto.nome_app}" adicionado!`, className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback, null, null, null]);
            }).catch(err => {
                const feedback = { props: { children: `Erro: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([window.dash_clientside.no_update, feedback, prod_id, qtd, preco]);
            });
        });
    },

    // 4. Limpa os campos do Lançamento Rápido
    clearQuickLaunch: function(n_clicks) {
        if (!n_clicks) return [null, null, null, null, null, ""];
        return [null, null, null, null, null, ""];
    },

    // 5. Deleta um item da tabela do carrinho
    deleteCartItem: function(n_clicks, all_data) {
        if (!n_clicks) return [window.dash_clientside.no_update, null];
        const triggered = dash_clientside.callback_context.triggered.find(t => t.value);
        if (!triggered) return [window.dash_clientside.no_update, null];
        const itemId = JSON.parse(triggered.prop_id.split('.')[0]).index;

        return new Promise(resolve => {
            db.collection('carrinho').doc(itemId).delete().then(() => {
                const feedback = { props: { children: "Item removido do carrinho.", className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback]);
            });
        });
    },

    // 6. Limpa todos os itens do carrinho
    clearCart: function(n_clicks, cart_data) {
        if (!n_clicks) {
            return [window.dash_clientside.no_update, window.dash_clientside.no_update];
        }
        if (!cart_data || cart_data.length === 0) {
            // --- CORREÇÃO AQUI: Retorna um componente Dash completo ---
            const feedback = {
                props: { children: "O carrinho já está vazio.", className: "text-yellow-500" },
                type: 'Span',
                namespace: 'dash_html_components'
            };
            return [window.dash_clientside.no_update, feedback];
        }
        
        const batch = db.batch();
        cart_data.forEach(item => {
            const docRef = db.collection('carrinho').doc(item.id);
            batch.delete(docRef);
        });

        return new Promise(resolve => {
            batch.commit().then(() => {
                // --- CORREÇÃO AQUI: Retorna um componente Dash completo ---
                const feedback = {
                    props: { children: "Carrinho limpo com sucesso!", className: "text-green-500" },
                    type: 'Span',
                    namespace: 'dash_html_components'
                };
                resolve([new Date().getTime(), feedback]);
            });
        });
    },

    // 7. Salva o carrinho (Checkout)
    saveCart: function(n_clicks, date, time, local, cart_data, all_data) {
        if (!n_clicks) return [window.dash_clientside.no_update, null, window.dash_clientside.no_update];

        if (!date || !time || !local || !local.trim()) {
            return [window.dash_clientside.no_update, {props:{children:"Preencha Data, Hora e Local da Compra."}}, window.dash_clientside.no_update];
        }
        if (!cart_data || cart_data.length === 0) {
            return [window.dash_clientside.no_update, {props:{children:"Carrinho está vazio."}}, window.dash_clientside.no_update];
        }

        const utc_date = new Date(`${date}T${time}:00`);
        const batch = db.batch();
        
        for (const item of cart_data) {
            if (!item.produto_id || !item.quantidade || item.quantidade <= 0) continue;

            const produto = all_data.produtos.find(p => p.id === item.produto_id);
            if (!produto) continue;

            const total_estoque = (parseFloat(produto.quantidade_por_unidade) || 1) * parseFloat(item.quantidade);
            const custo_total = item.quantidade * item.preco_unitario;

            const compra_data = {
                data: utc_date, local: local, subcategoria_id: item.subcategoria_id,
                produto_id: item.produto_id, quantidade_produtos: item.quantidade,
                total_adicionado_estoque: total_estoque, preco_por_produto: item.preco_unitario,
                custo_total_compra: `R$ ${custo_total.toFixed(2)}`
            };

            // Adiciona a nova compra
            const compraRef = db.collection('compras').doc();
            batch.set(compraRef, compra_data);

            // Atualiza o estoque da subcategoria
            const subcatRef = db.collection('subcategorias').doc(item.subcategoria_id);
            batch.update(subcatRef, { estoqueAtual: firebase.firestore.FieldValue.increment(total_estoque) });

            // Deleta o item do carrinho
            const cartRef = db.collection('carrinho').doc(item.id);
            batch.delete(cartRef);
        }

        return new Promise(resolve => {
            batch.commit().then(() => {
                resolve([new Date().getTime(), {props:{children:"Compras salvas com sucesso!"}}, new Date().getTime()]);
            }).catch(err => {
                resolve([window.dash_clientside.no_update, {props:{children:`Erro: ${err.message}`}}, window.dash_clientside.no_update]);
            });
        });
    },

    // 8. Preenche o carrinho com sugestões baseadas no estoque mínimo ("Auto Lista")
    generateAutoLista: function(n_clicks, all_data, cart_data) {
        if (!n_clicks || !all_data) {
            return [window.dash_clientside.no_update, {props:{children:"Dados não carregados."}}];
        }
        
        const { subcategorias } = all_data;
        
        // Filtra subcategorias que precisam de compra
        const a_comprar = subcategorias.filter(s => (s.estoqueAtual || 0) < (s.estoqueMinimo || 0));
        
        if (a_comprar.length === 0) {
            return [window.dash_clientside.no_update, {props:{children:"Nenhum item abaixo do estoque mínimo!"}}];
        }

        // Filtra itens que JÁ ESTÃO no carrinho para não duplicar
        const cart_subcat_ids = cart_data.map(item => item.subcategoria_id);
        const novos_itens_para_carrinho = a_comprar.filter(s => !cart_subcat_ids.includes(s.id));

        if (novos_itens_para_carrinho.length === 0) {
            return [window.dash_clientside.no_update, {props:{children:"Todos os itens necessários já estão no carrinho."}}];
        }

        // Usa um batch write para adicionar todos os novos itens de uma vez
        const batch = db.batch();
        novos_itens_para_carrinho.forEach(subcat => {
            const cart_item = {
                produto_id: null, // O usuário preencherá o produto específico
                subcategoria_id: subcat.id,
                quantidade: 1, // Começa com 1
                preco_unitario: 0,
            };
            const cartRef = db.collection('carrinho').doc();
            batch.set(cartRef, cart_item);
        });

        return new Promise(resolve => {
            batch.commit().then(() => {
                const feedback = { props: { children: `${novos_itens_para_carrinho.length} iten(s) adicionado(s) ao carrinho!`, className: "text-green-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([new Date().getTime(), feedback]);
            }).catch(err => {
                const feedback = { props: { children: `Erro: ${err.message}`, className: "text-red-500" }, type: 'Span', namespace: 'dash_html_components' };
                resolve([window.dash_clientside.no_update, feedback]);
            });
        });
    },

    // 9. Salva a alteração e atualiza o SUBTOTAL da linha
    updateSubtotalAndSave: function(trigger_value, state_value, trigger_id) {
        if (trigger_value === null || trigger_value === undefined || !trigger_id) {
            return window.dash_clientside.no_update;
        }

        const itemId = trigger_id.index;
        const fieldType = trigger_id.type;

        // 1. Determina qual campo é qual e salva a alteração no Firebase
        const fieldToUpdate = fieldType === 'cart-qtd-input' ? 'quantidade' : 'preco_unitario';
        db.collection('carrinho').doc(itemId).update({ [fieldToUpdate]: parseFloat(trigger_value) || 0 });

        // 2. Calcula o novo subtotal usando os dois valores
        const qtd = fieldType === 'cart-qtd-input' ? parseFloat(trigger_value) : parseFloat(state_value);
        const preco = fieldType === 'cart-preco-input' ? parseFloat(trigger_value) : parseFloat(state_value);
        
        const new_subtotal = (qtd || 0) * (preco || 0);
        return `R$ ${new_subtotal.toFixed(2).replace('.', ',')}`;
    },

    // 10. Salva a alteração e atualiza o TOTAL da linha
    updateGrandTotal: function(quantidades, precos) {
        if (!quantidades || !precos) {
            return window.dash_clientside.no_update;
        }

        let new_total = 0;
        for (let i = 0; i < quantidades.length; i++) {
            const qtd = parseFloat(quantidades[i]) || 0;
            const preco = parseFloat(precos[i]) || 0;
            new_total += qtd * preco;
        }

        return `R$ ${new_total.toFixed(2).replace('.', ',')}`;
    },

    // 11. Salva o produto específico selecionado para um item do carrinho
    updateCartProductSelection: function(product_id, id) {
        if (!product_id || !id) {
            return window.dash_clientside.no_update;
        }
        const cartItemId = id.index;
        db.collection('carrinho').doc(cartItemId).update({ produto_id: product_id });
        
        // Nenhuma saída visual precisa ser atualizada, apenas salvamos no DB
        return window.dash_clientside.no_update; 
    },

    // 11. Atualiza o placeholder de quantidade com base no produto selecionado (VERSÃO CORRIGIDA)
    updateQuantityPlaceholder: function(product_id, cart_id_dict, all_data, cart_data) { // <-- NOVO ARGUMENTO
        if (!product_id || !all_data || !cart_data) { // <-- CHECAGEM ADICIONADA
            return "Qtd...";
        }

        const cartItemId = cart_id_dict.index;
        // --- A CORREÇÃO ESTÁ AQUI ---
        // Procura o item do carrinho no lugar certo (na variável cart_data)
        const cart_item = cart_data.find(item => item.id === cartItemId);
        // --- FIM DA CORREÇÃO ---
        
        if (!cart_item) { return "Qtd..."; } // Item não encontrado no carrinho

        const subcat = all_data.subcategorias.find(s => s.id === cart_item.subcategoria_id);
        const product = all_data.produtos.find(p => p.id === product_id);

        if (!subcat || !product || !product.quantidade_por_unidade) {
            return "Qtd...";
        }
        
        const sugestao = (subcat.estoqueAlvo || 0) - (subcat.estoqueAtual || 0);
        if (sugestao <= 0) {
            return "Qtd...";
        }

        const qtd_sugerida = window.dash_clientside.clientside.calculateSuggestedQuantity(subcat, product, all_data.medidas);
        return `Sug: ${qtd_sugerida}`;
    },

    // 12. Gera a tabela do carrinho dinamicamente
    generateShoppingListTable: function(carrinho_itens, all_data) {
        const createComponent = (type, namespace, props) => ({ props, type, namespace });
        const BTN_GREEN_CLASS = "bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 text-sm rounded";
        const BTN_GREEN_DISABLED_CLASS = "bg-gray-400 text-white font-bold py-1 px-2 text-sm rounded cursor-not-allowed";
        const BTN_RED_CLASS = "bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 text-sm rounded flex items-center justify-center";

        if (!carrinho_itens || carrinho_itens.length === 0) {
            const empty_layout = createComponent('Div', 'dash_html_components', {
                className: "text-center p-10 bg-gray-50 rounded-lg",
                children: [
                    createComponent('I', 'dash_html_components', { className: "fas fa-shopping-cart text-gray-400 text-4xl mb-4" }),
                    createComponent('H4', 'dash_html_components', { children: "Carrinho Vazio", className: "text-xl font-semibold text-gray-700" }),
                    createComponent('P', 'dash_html_components', { children: "Adicione itens ou use a 'Auto Lista'.", className: "text-gray-500" })
                ]
            });
            return [empty_layout, "R$ 0,00", true, BTN_GREEN_DISABLED_CLASS];
        }

        if (!all_data) {
            return [createComponent('P', 'dash_html_components', {children: "Carregando dados..."}), "R$ 0,00", true, BTN_GREEN_DISABLED_CLASS];
        }

        const produtos_dict = all_data.produtos.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
        const subcat_dict = all_data.subcategorias.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});
        let total_carrinho = 0;

        const grouped_by_category = carrinho_itens.reduce((acc, item) => {
            const subcat_info = subcat_dict[item.subcategoria_id];
            if (subcat_info) {
                const category = subcat_info.categoria || 'Sem Categoria';
                if (!acc[category]) acc[category] = [];
                acc[category].push(item);
            }
            return acc;
        }, {});

        const sorted_categories = Object.keys(grouped_by_category).sort();
        let table_body_content = [];

        sorted_categories.forEach(category => {
            table_body_content.push(createComponent('Tr', 'dash_html_components', {
                children: createComponent('Td', 'dash_html_components', {
                    children: category,
                    className: "p-2 font-bold text-lg text-gray-700 bg-gray-100",
                    colSpan: 6
                })
            }));

            const items_in_category = grouped_by_category[category].sort((a, b) => {
                const nameA = subcat_dict[a.subcategoria_id]?.nome || '';
                const nameB = subcat_dict[b.subcategoria_id]?.nome || '';
                return nameA.localeCompare(nameB);
            });

            items_in_category.forEach(item => {
                const subcat_info = subcat_dict[item.subcategoria_id];
                if (!subcat_info) return;

                const sugestao_text = `Sug: ${Math.max(0, (subcat_info.estoqueAlvo || 0) - (subcat_info.estoqueAtual || 0))} ${subcat_info.unidade || ''}`;
                const produtos_da_subcat = all_data.produtos
                    .filter(p => p.subcategoria_id === subcat_info.id)
                    .map(p => ({ label: p.nome_app, value: p.id }));

                const is_auto_lista_item = !item.produto_id;
                const quantidade_val = !is_auto_lista_item ? item.quantidade : null;
                const preco_val = !is_auto_lista_item ? item.preco_unitario : null;
                const subtotal = (quantidade_val || 0) * (preco_val || 0);
                total_carrinho += subtotal;
                
                table_body_content.push(createComponent('Tr', 'dash_html_components', {
                    children: [
                        createComponent('Td', 'dash_html_components', { children: [ createComponent('P', 'dash_html_components', { children: subcat_info.nome, className: "font-semibold" }), createComponent('P', 'dash_html_components', { children: sugestao_text, className: "text-xs text-gray-500" }) ] }),
                        createComponent('Td', 'dash_html_components', { children: createComponent('Dropdown', 'dash_core_components', { id: { type: 'cart-product-select', index: item.id }, options: produtos_da_subcat, value: item.produto_id, placeholder: "Selecione o produto...", clearable: true }) }),
                        createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'cart-qtd-input', index: item.id }, value: quantidade_val, type: 'number', min: 0, className: "w-full p-1 border rounded" }) }),
                        createComponent('Td', 'dash_html_components', { children: createComponent('Input', 'dash_core_components', { id: { type: 'cart-preco-input', index: item.id }, value: preco_val, type: 'number', min: 0, className: "w-full p-1 border rounded" }) }),
                        createComponent('Td', 'dash_html_components', { children: `R$ ${subtotal.toFixed(2)}`.replace('.', ','), id: { type: 'cart-subtotal', index: item.id } }),
                        createComponent('Td', 'dash_html_components', { className: "text-center align-middle", children: createComponent('Button', 'dash_html_components', { id: { type: 'btn-delete-cart-item', index: item.id }, n_clicks: 0, children: createComponent('I', 'dash_html_components', { className: "fas fa-trash-alt" }), className: BTN_RED_CLASS }) })
                    ]
                }));
            });
        });

        const header = createComponent('Thead', 'dash_html_components', { className: "bg-gray-50", children: createComponent('Tr', 'dash_html_components', { children: [
            createComponent('Th', 'dash_html_components', {children: "Subcategoria", className:"p-2 text-left"}),
            createComponent('Th', 'dash_html_components', {children: "Produto Comprado", className:"p-2 text-left w-1/3"}),
            createComponent('Th', 'dash_html_components', {children: "Qtd.", className:"p-2 text-left w-20"}),
            createComponent('Th', 'dash_html_components', {children: "Preço Unit.", className:"p-2 text-left w-28"}),
            createComponent('Th', 'dash_html_components', {children: "Subtotal", className:"p-2 text-left w-24"}),
            createComponent('Th', 'dash_html_components', {children: "Ação", className:"p-2 text-center w-20"})
        ]})});

        const tabela_carrinho = createComponent('Table', 'dash_html_components', {
            children: [header, createComponent('Tbody', 'dash_html_components', { children: table_body_content })],
            className: "w-full text-sm"
        });

        const total_formatado = `R$ ${total_carrinho.toFixed(2)}`.replace('.', ',');
        
        return [tabela_carrinho, total_formatado, false, BTN_GREEN_CLASS];
    },

    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});