# ADR 0002: Arquitetura de Filtragem Hierárquica em Cascata para Seleção de Peças Cerâmicas

## Status
Proposto (Aguardando Aprovação no `/plan`)

## Contexto
O CeramiCAD Studio cresceu de um gerador simples de vasos para um ecossistema com mais de 66 modelos curados e 100 peças catalogadas, englobando técnicas muito distintas:
- Peças de torno de revolução contínua axissimétrica (xícaras, vasos gregos, garrafas asiáticas).
- Peças modulares em placas planas ($C^0$ + anexos) para corte em folha A4 (manteigueiras canadenses, saboneteiras com calha, caixas e bandejas dobradas).
- Origamis facetados e luminárias poligonais.

Com um único `<select>` longo contendo dezenas de itens, a navegação torna-se cansativa e desorientada para o oleiro, que pensa primariamente na **técnica de oficina** disponível (ex.: se vai trabalhar na placa de corte ou no torno giratório) e na **finalidade de uso** (decoração, mesa, cozinha).

O usuário solicitou explicitamente:
> *"na parte de seleção de objeto deve haver um filtro, antes de selecionar o objeto primeiro deve ter por exemplo: plaqueira > decoração > luminaria"*

## Decisão
Implementar uma arquitetura de filtragem em 3 níveis (Método ➔ Categoria ➔ Objeto) com os seguintes pilares:

1. **Taxonomia Padronizada**:
   - `metodo`: `'plaqueira'` (Slab building / Placas), `'torno'` (Torneamento / Revolução), `'especial'` (Origami / Facetados / Ferramentas).
   - `categoria`: `'decoracao'` (Decoração & Iluminação), `'mesa'` (Mesa & Servir), `'cozinha'` (Cozinha & Panelas), `'historico'` (Clássicos da Antiguidade).
2. **Cascata Reativa Não Destrutiva**:
   - Os metadados das peças continuam canonicamente em `STUDIO_100_CATALOG` e `CLASSIC_CERAMIC_PROFILES`.
   - O seletor `#classic-profile-select` é populado dinamicamente através de uma função pura `renderFilteredProfileSelect()`, que filtra o catálogo completo com base no estado `activeFilterMethod` e `activeFilterCategory`.
   - O seletor mantém seu ID e evento `onchange="loadClassicProfilePreset(this.value)"` intactos, garantindo 100% de compatibilidade com os testes e a sincronização bidirecional.
3. **Breadcrumb Informativo**:
   - Um elemento visual compacto `<div id="catalog-breadcrumb">` exibe o caminho hierárquico ativo (`Plaqueira > Decoração > Cúpula de Luminária`), proporcionando clareza de contexto e zero poluição visual.

## Consequências
- **Positivas**:
  - Encontrar qualquer peça em 2 cliques ou seleções rápidas.
  - Elimina a sobrecarga cognitiva do dropdown monolítico de 66 opções.
  - Flexibilidade: opção "Todos" em cada filtro permite ao usuário navegar pelo acervo completo sem restrição.
  - 100% retrocompatível com testes e atalhos de teclado.
- **Negativas / Mitigações**:
  - Necessidade de atualizar dinamicamente o innerHTML das `<option>` do seletor: mitigado por debounce e cache de renderização (< 5 ms).
