# Meta do Ciclo PDCA: Restauração Completa das Abas 3D/2D, Split-View 2D+3D com Seleção Visual de Partes e Correção da Conversão A4

## Objetivo
Restaurar 100% das funcionalidades da aba de **Modelagem de Vasos 3D & Placas 2D** (`#left-control-panel` e rodapé de telemetria), recuperar a fidelidade geométrica dos **54 Modelos Clássicos** (com alças, bicos, tampas e pés torneados reais) no catálogo, permitir a **visualização 3D simultânea dentro da aba 2D (Split-View)** com **seleção visual bidirecional (2D ↔ 3D)** das partes que compõem objetos de placa, e corrigir integralmente o motor de **conversão de objetos 3D para moldes 2D em folhas A4 (1:1)**.

## Escopo Aprovado
1. **Restauração Completa do Painel Lateral e Controles (`#left-control-panel` & `#app-footer`)**:
   - Tornar novamente visível e fixo o painel de controle completo com os sub-modos **Silhueta & Spline** e **Estágios de Placas (Slab Building)**.
   - Restaurar acesso direto à **Coleção de 54 Silhuetas Clássicas, Utilitários & Biblioteca**, **Editor de Silhueta 2D**, **11 Texturas Esculturais 3D**, **Esmaltes PBR Cinnabar**, **Loft Base➔Meio➔Boca**, **Torção Espiral**, **Auto-Trace de Foto**, **Receitas JSON**, **14 Receitas de Camadas Conectadas C⁰** (`+Cilindro`, `+Cone`, `+Bojo Esf.`, `+Disco`, `+Alça`, `+Bico`, `+Tampa`, `+Borda/Pé`), **Motor HD de Placas Multi-Peças**, **Torno & Queima** (Costela de Ataque, Gabarito Negativo e Volume Pós-Queima) e **Barra de Telemetria** (Argila kg, Capacidade mL, PLA g, Custo/Venda).
2. **Correção da Geometria 3D dos Modelos do Catálogo**:
   - Vincular os itens do catálogo diretamente aos perfis reais de `CLASSIC_CERAMIC_PROFILES` (preservando alças, bicos, tampas e pés kodai) e remover o bloqueio prematuro em `rebuildVase()` que forçava geometrias simplificadas e impedia a edição de parâmetros.
3. **Visualização 3D Dentro da Aba 2D (Split-View) & Seleção Visual Bidirecional de Partes (2D ↔ 3D)**:
   - Exibir o palco 3D interativo lado a lado com o estúdio 2D (Perfil CAD e Moldes Planificados A4) quando o usuário estiver no **Modo 2D**.
   - Permitir **selecionar visualmente** (clique e *hover*) qualquer parte de um objeto de placa (tanto nos moldes 2D em folha A4 quanto clicando diretamente na peça 3D via `THREE.Raycaster`), destacando a peça em âmbar luminoso em ambas as vistas (2D e 3D) e exibindo um inspetor da parte selecionada (nome da parte, dimensões em mm, espessura, par de costura `[A1↔A2]` e ângulo de chanfro/bisel).
   - Suportar seleção visual de partes para **todos** os modos: Camadas Conectadas C⁰ (fundo/disco, anéis cilíndricos/cônicos/bojos, alças, bico, tampa, borda/pé), Coleção HD de Placas (gomos, base, bico, alça, tampa/flange) e Peças Utilitárias de Placas.
4. **Revisão e Correção da Conversão 3D ➔ 2D em Folha A4 (Escala 1:1)**:
   - **Sincronização automática 3D ➔ 2D**: Qualquer modelo 3D ativo (mesmo modelado em *Silhueta & Spline* ou selecionado do catálogo) gera automaticamente seus anéis e apêndices (alça, bico, tampa, pé) para planificação A4 sem exigir conversão manual prévia ou usar estágios obsoletos.
   - **Fim da duplicação do Disco de Base**: Corrigir `prepareAllVasePatternItems()` para não desenrolar estágios do tipo `disco` como faixas retangulares duplicadas além do disco circular.
   - **Subdivisão Inteligente para Caber na Folha A4**: Quando o desenvolvimento de um anel cilíndrico ou cônico ultrapassar a área útil da folha A4 ($182 \times 253\text{ mm}$), subdividir automaticamente o anel em $2$, $3$ ou $4$ segmentos iguais (ex.: *Meia-Faixa 1/2 e 2/2* com indicação de costura `[S2-A ↔ S2-B]` e chanfro a $45^\circ$), garantindo que **100% das partes do vaso apareçam empacotadas nas folhas A4** na tela e no PDF (mantendo também a opção de *Tiling* multi-folhas com marcas `⊕`).
   - **Paginação e Visualização Fiel de Folhas A4 no Canvas 2D**: Renderizar no `#studio-moldes-canvas` as folhas A4 reais (escala proporcional com margens, régua de $50\text{ mm}$, linhas de corte contínuas, linhas de vinco tracejadas, furos de dreno e cotas) com navegação entre folhas (`Folha 1/N`) e seleção interativa de cada molde.

## Critérios de Sucesso (SMART)
- **CS1**: Painel esquerdo `#left-control-panel` e rodapé `#app-footer` 100% visíveis e operacionais nos modos 3D e 2D.
- **CS2**: Todos os 54 modelos clássicos e utilitários renderizam com suas curvas reais e apêndices 3D (alças, bicos, tampas, bordas).
- **CS3**: No Modo 2D, o Palco 3D permanece visível em *Split-View* e clicar/passar o mouse sobre qualquer parte no molde 2D ou na malha 3D destaca a parte correspondente em ambos (2D ↔ 3D) com telemetria da peça.
- **CS4**: Qualquer objeto 3D (Spline, Camadas C⁰, HD Placas ou Utilitários) converte 100% de suas partes para folhas A4 ($210 \times 297\text{ mm}$) sem omitir anéis largos, sem duplicar o disco de base e sem cortar desenhos fora do canvas.
- **CS5**: 100% de aprovação na suíte E2E (`tests/run_tests.js`) com zero erros de console.
