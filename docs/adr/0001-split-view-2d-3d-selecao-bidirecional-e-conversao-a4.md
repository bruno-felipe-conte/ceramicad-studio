# ADR 0001: Split-View 2D+3D com Seleção Bidirecional de Partes e Subdivisão Inteligente para Folha A4

- **Status**: Proposto (aguardando aprovação do `/plan`)
- **Data**: 2026-11-09

## Contexto
1. Nas refatorações recentes (`477f66e` e `c73a298`), o painel de controle lateral (`#left-control-panel`) e o rodapé de telemetria (`#app-footer`) ficaram ocultos fora da tela (`-translate-x-full`), fazendo desaparecer todas as funções de modelagem 3D e 2D que o usuário utilizava.
2. O catálogo de 100 peças sobrescreveu os modelos #11–#100 com curvas genéricas de 5 nós sem apêndices (`attachments: []`), e `rebuildVase()` passou a interceptar peças de placa retornando cedo sem permitir edição.
3. Ao alternar para a aba 2D (`setStudioAppMode('2d')`), o palco 3D (`#studio-view-3d`) era ocultado com `display: none` (`hidden`), impedindo visualizar o objeto 3D enquanto se analisam os moldes 2D e impedindo selecionar visualmente cada parte do objeto de placa para compreender sua montagem.
4. Na conversão de objetos 3D para folhas A4 (`182 × 253 mm` de área útil):
   - Qualquer anel cilíndrico ou cônico com raio $R > 36\text{ mm}$ possui perímetro $2\pi R \cdot 1.12 > 253\text{ mm}$, excedendo o tamanho de uma única folha A4. O motor de nesting classificava esses anéis como `oversized` e os omitia da lista `sheets` exibida na pré-visualização A4.
   - O estágio `disco` era processado duas vezes em `prepareAllVasePatternItems()`: uma como faixa retangular lateral e outra como disco circular.
   - Quando o usuário estava no modo `spline`, a aba 2D de moldes e o PDF A4 liam `vaseStages` antigos em vez de converter a silhueta 3D ativa.

## Opções Consideradas

### Opção 1 (Escolhida ⭐): Painel Lateral Visível + Split-View 2D/3D com `partId` Bidirecional + Subdivisão Inteligente A4
- Manter `#left-control-panel` visível com todas as ferramentas (Silhueta & Spline, 54 Modelos Clássicos reais com alças/bicos/tampas, Camadas Conectadas C⁰, Motor HD de Placas e Torno/Queima).
- No **Modo 2D**, exibir o **Estúdio 2D** e o **Palco 3D** lado a lado (*Split-View*), permitindo clicar ou passar o mouse sobre qualquer molde 2D na folha A4 ou clicar na peça 3D (via `THREE.Raycaster`) para destacar a parte correspondente em ambos com suas dimensões, par de costura e ângulo de chanfro.
- Sincronizar automaticamente o modelo 3D ativo para moldes 2D, eliminar a duplicação do `disco` e subdividir automaticamente anéis largos em segmentos iguais ($1/2$, $1/3$, $1/4$) que cabem perfeitamente na folha A4 com marcação de costura `[A1↔A2]` e bisel de $45^\circ$ (com alternância opcional para *Tiling*).

### Opção 2: Abas 2D e 3D Isoladas + Apenas Tiling Multi-Folhas
- Manter 3D e 2D separados (ou com mini-janela PiP) e obrigar o usuário a colar várias folhas A4 para qualquer anel com $R > 36\text{ mm}$.
- **Descartada**: Prejudica a compreensão espacial da montagem das placas e gera desperdício de papel A4 em ateliê.

## Decisão
Adotar a **Opção 1**, unificando o contrato `partId` entre todas as sub-malhas 3D do `activeMeshGroup` e os polígonos empacotados nas folhas A4 de `#studio-moldes-canvas`, `#hd-interactive-pattern-canvas` e `generateVasePDF()`.

## Consequências
- **Positivas**:
  - Restauração imediata de 100% das funções de modelagem 3D e 2D.
  - Compreensão visual imediata de como cada molde 2D (disco, anel/meia-faixa, gomo, alça, bico, tampa, placa chanfrada) se encaixa no objeto 3D.
  - Conversão 3D ➔ 2D em folha A4 100% confiável, sem peças faltando e sem discos duplicados.
- **Cuidados Técnicos**:
  - Ao alternar entre Modo 3D (tela cheia para o palco 3D) e Modo 2D (Split-View 2D + 3D), disparar o redimensionamento do `renderer` e atualização do `camera.aspect` para evitar distorção de proporção no WebGL.
