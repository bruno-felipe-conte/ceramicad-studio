# Meta do Ciclo PDCA: Alternador 2D/3D & Expansão de Peças Utilitárias em Placas

## Objetivo
Desenvolver uma experiência técnica completa e interativa de alternância entre a modelagem tridimensional e a planificação em placas de argila crua (*Slab Building*), complementando o catálogo cerâmico com 7 peças utilitárias (monoplacas vincadas e peças compostas multi-placas com chanfros de meia-esquadria a 45°).

## Escopo
1. **Alternador Interativo de Visualização (2D ↔ 3D)**: Transição direta e reativa no topo entre o desdobramento técnico dos moldes de corte e a montagem tridimensional volumétrica fechada.
2. **Desdobramento 2D Técnico com Normas de Modelagem**: Exibição de linhas de corte contínuas, linhas de vinco/meio-corte demarcadas (dobras em montanha e vale), cotas nominais em mm e indicação de ângulos de chanfro.
3. **Expansão do Catálogo de Placas Cerâmicas**:
   - 4 Peças de placa única: Porta-copos geométrico com borda vincada, saboneteira com calha e dreno, porta-incenso canoa e descanso de talheres.
   - 3 Peças técnicas multi-placas: Manteigueira Francesa com vedação por água, saleiro de parede/mesa chanfrado com aba protetora e garrafa/vaso facetado.
4. **Tolerâncias de Espessura e Retração de Queima**: Manutenção das folgas e espessuras de placas de 4 a 8 mm e compensação linear de retração de secagem/queima (fator 1.12x).

## Critérios de Sucesso
- 100% de cobertura nos testes E2E com zero erros de console.
- Malhas 3D volumétricas válidas com espessura e sem `NaNs`.
- Moldes 2D legíveis com cotas reais compatíveis com recorte em placa e exportação em PDF A4 1:1.
