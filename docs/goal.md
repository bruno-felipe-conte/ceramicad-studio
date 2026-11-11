# Meta do Ciclo PDCA: Gabarito 1:1 de Curvatura de Alças, Marcações de Barbotina na Placa e Catálogo Enriquecido de Alças e Tampas

## Objetivo do Ciclo
Prover aos ceramistas ferramentas de extrema precisão prática para modelagem e colagem de alças e tampas:
1. **Gabarito Lateral 1:1 de Curvatura da Alça**: Gerar na folha A4 a representação "de lado" da alça (perfil curvo real com espessura e projeção) além da tira esticada ("de comprido"), permitindo apoiar e curvar a argila úmida diretamente sobre o papel até atingir a forma correta com facilidade.
2. **Marcações de Encaixe e Barbotina na Placa**: Estampar na planificação 2D da placa do corpo (cilindro ou cone) retângulos pontilhados com hachura e texto de orientação `Colagem da Alça (Barbotina)`, indicando exatamente onde posicionar e barbotinar as raízes superior e inferior da alça.
3. **Catálogo Paramétrico Expandido de Alças e Tampas**:
   - Alças: Fita Caneca em 'C' Ergonômico, Puxada em Gota, Alça Ponte/Arco e Alça de Aperto Duplo (Dupla Oposta).
   - Tampas: Tampa com Plug/Rebaixo de vedação interno, Cúpula Clássica com puxador esférico, e Tampa com Galeria Embutida.

---

## Resultados Mensuráveis

| Métrica | Valor-Alvo | Como Medir |
| :--- | :--- | :--- |
| **Gabarito Lateral 1:1 no A4** | 100% das alças em tira geram gabarito de curvatura lateral | Presença de item `type: 'gabarito_curva'` no packing A4 com escala 1:1 |
| **Marcação de Barbotina na Placa** | 100% de placas receptoras contêm ancoragens visuais | Presença de marcadores nos itens de molde cilíndricos/cônicos |
| **Renderização Visual no Canvas e PDF** | Retângulos pontilhados legíveis com hachura suave | Canvas interativo A4 e PDF vetorial (`generateVasePDF`) |
| **Seletores de UI Atualizados** | Novos tipos de alça e tampa disponíveis e funcionais | Interação no painel de estágios e renderização 3D |
| **Taxa de Aprovação em Testes** | 100% (137/137) | `node tests/run_tests.js --station 1` |
| **Erros e Exceções no Console** | 0 erros | Monitoramento no Chromium headless via CDP |

---

## Escopo Dentro / Escopo Fora

- **Dentro do Escopo:**
  1. Criação do gerador de perfil lateral 1:1 da alça em `getVaseRingsPattern()`, gerando item de molde com `outerArcMm`, altura e projeção reais.
  2. Adição de metadados de ancoragem (`anchors: [{ y, w, h, label }]`) nos moldes cilíndricos/cônicos que recebem alças.
  3. Renderização gráfica no Canvas A4 (`renderStudioMoldesCanvas`) e no PDF (`generateVasePDF`) dos retângulos de barbotina.
  4. Novos tipos de alça (Caneca em 'C', Gota, Ponte/Arco, Dupla Oposta) e tampas (Plug de vedação, Cúpula esférica, Galeria embutida) no seletor de UI e no construtor 3D `buildVaseAttachments3D`.
- **Fora do Escopo:**
  - Simulação física de elementos finitos (FEA) de fadiga estrutural da alça cozida.
  - Exportação para máquinas CNC de 5 eixos.

---

## Definição de Pronto (DoD)
- [ ] Critérios de aceite implementados e testados via automação CDP.
- [ ] 137/137 testes automatizados Station 1 aprovados sem regressões (100% pass rate).
- [ ] Renderização correta no visualizador 2D e na exportação PDF A4.
- [ ] Código limpo, sem duplicações e sem avisos de linter.
- [ ] Documentação (`docs/plan.md`, `docs/threat-model.md`) atualizada.
