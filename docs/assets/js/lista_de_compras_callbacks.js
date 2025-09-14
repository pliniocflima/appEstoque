// assets/js/lista_de_compras_callbacks.js
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

    // 1. Gera a lista de compras
    generateShoppingList: function(n_clicks) {
        if (n_clicks === undefined || n_clicks === 0) {
            return window.dash_clientside.no_update;
        }

        return new Promise((resolve) => {
            db.collection("subcategorias").get().then((querySnapshot) => {
                
                let subcategorias = [];
                querySnapshot.forEach((doc) => {
                    subcategorias.push(doc.data());
                });

                if (subcategorias.length === 0) {
                    resolve({ props: { children: "Não há subcategorias cadastradas." }, type: 'P', namespace: 'dash_html_components' });
                    return;
                }

                // --- INÍCIO DA LÓGICA COM JAVASCRIPT PURO ---

                // 1. Filtra os itens a comprar e calcula a quantidade necessária
                const itens_a_comprar = subcategorias
                    .map(item => {
                        // Garante que os valores de estoque são números, tratando nulos/undefined como 0
                        const estoqueAtual = parseFloat(item.estoqueAtual) || 0;
                        const estoqueMinimo = parseFloat(item.estoqueMinimo) || 0;
                        const estoqueAlvo = parseFloat(item.estoqueAlvo) || 0;

                        return { ...item, estoqueAtual, estoqueMinimo, estoqueAlvo };
                    })
                    .filter(item => item.estoqueAtual < item.estoqueMinimo)
                    .map(item => {
                        const a_comprar = item.estoqueAlvo - item.estoqueAtual;
                        return { ...item, a_comprar };
                    })
                    .filter(item => item.a_comprar > 0);


                if (itens_a_comprar.length === 0) {
                    resolve({ props: { children: "🎉 Parabéns! Seu estoque está completo.", className: "text-center text-green-600 font-semibold" }, type: 'H4', namespace: 'dash_html_components' });
                    return;
                }

                // 2. Agrupa os itens por categoria
                const agrupado_por_categoria = itens_a_comprar.reduce((acc, item) => {
                    const categoria = item.categoria || 'Sem Categoria';
                    if (!acc[categoria]) {
                        acc[categoria] = [];
                    }
                    acc[categoria].push(item);
                    return acc;
                }, {});

                // 3. Monta a saída para o Dash
                const lista_formatada = [];
                // Ordena as categorias alfabeticamente
                Object.keys(agrupado_por_categoria).sort().forEach(categoria => {
                    lista_formatada.push({
                        props: { children: categoria, className: "text-xl font-semibold text-gray-700 mt-6 pb-2 border-b" },
                        type: 'H5', namespace: 'dash_html_components'
                    });

                    const itens_categoria = agrupado_por_categoria[categoria];
                    const lista_itens_li = itens_categoria.map(item => {
                        const texto_item = `${item.nome} - Comprar ${item.a_comprar} ${item.unidade || ''}`;
                        return { props: { children: texto_item, className: "text-gray-600" }, type: 'Li', namespace: 'dash_html_components' };
                    });

                    lista_formatada.push({
                        props: { children: lista_itens_li, className: "list-disc list-inside mt-2 space-y-1" },
                        type: 'Ul', namespace: 'dash_html_components'
                    });
                });
                
                // --- FIM DA LÓGICA COM JAVASCRIPT PURO ---

                resolve({ props: { children: lista_formatada }, type: 'Div', namespace: 'dash_html_components' });

            }).catch(error => {
                console.error("Erro ao processar dados: ", error);
                resolve({ props: { children: `Erro ao gerar lista: ${error.message}`, className: "text-center text-red-500 font-semibold" }, type: 'H4', namespace: 'dash_html_components' });
            });
        });
    }

    // +---------------------------------------------------------------------------------------------+
    // |    1. FIM DOS CALLBACKS                                                                     |
    // +---------------------------------------------------------------------------------------------+

});