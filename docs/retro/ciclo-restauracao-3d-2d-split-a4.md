# Relatório de Verificação (`/check`) — Ciclo: Restauração 3D/2D, Split-View 2D+3D, Seleção Visual de Partes e Conversão A4

**Data**: 2026-11-09  
**Escopo**: Restauração integral das ferramentas das abas 3D e 2D (`#left-control-panel` e `#app-footer`), aprimoramento dos 100 modelos 3D com anexos reais, visualização 3D dentro da aba 2D (Split-View), seleção visual bidirecional de partes (2D ↔ 3D) e correção da conversão 3D ➔ 2D em folhas A4.

---

## Tabela de Verificação (`item × status × evidência`)

| # | Categoria | Item Verificado | Status | Evidência Técnica |
| :--- | :--- | :--- | :---: | :--- |
| 1 | **Funcional** | Restauração do painel completo de funções 3D e 2D (`#left-control-panel` / `#panel-vasos`) e barra de telemetria (`#app-footer`) | ✅ | `leftPanelVisible: true`, `footerVisible: true` no teste `s1_toggle_2d_3d_mode` e screenshot `check_1_modo_3d_painel_completo.png`. Todas as 54 silhuetas, 8 botões de estágios C⁰, Loft, Twist, 11 texturas 3D, Costela, Gabarito e Volume Pós-Queima operacionais. |
| 2 | **Funcional** | Qualidade dos 100 modelos 3D (`STUDIO_100_CATALOG`) e correção do despachante `rebuildVase()` | ✅ | Sincronizados com `CLASSIC_CERAMIC_PROFILES`, anexos 3D (`alca`, `bico`, `tampa`, `borda`) adicionados aos itens `#11–#100`, flag `isSlabPieceModeActive` impede travamento em `renderSlabPiece3D()`. 54/54 perfis e 7/7 peças de placa aprovadas sem `NaN`. |
| 3 | **Funcional** | Visualização 3D simultânea dentro da aba 2D (Split-View 2D + 3D) | ✅ | Container `#studio-views-split-wrapper` exibe `#studio-view-2d` (esquerda/centro) e `#studio-view-3d` (direita, 44%) simultaneamente com `resizeUnified3DViewport()`. Evidenciado em `check_2_aba_2d_split_view_3d_selecao_parte.png` e `s1_toggle_2d_3d_mode` (`Split2D+3D: true`). |
| 4 | **Funcional** | Seleção Visual Bidirecional de Partes (2D ↔ 3D) em objetos de placa e estágios | ✅ | `selectSlabPart2D3D(partId)` e `apply3DPartHighlight(partId)` destacam a sub-peça em ouro-âmbar (`0xFFB020`) no 3D e na folha A4 2D via clique no canvas 2D, chips `🎯 Partes 2D↔3D` ou `THREE.Raycaster` no 3D (`PartSelect: true`). |
| 5 | **Funcional** | Conversão 3D ➔ 2D em Folha A4 (Disco único + Subdivisão Inteligente em Arcos + PDF 1:1) | ✅ | Corrigida duplicação do disco de base (`if (rg.tipo === 'disco') return;` em `prepareAllVasePatternItems`, `BaseÚnica: true`). Anéis com arco $> 253\text{ mm}$ são subdivididos em $K \in \{2,3,4,6,8\}$ arcos com costuras `[S1-A ↔ S1-B]` (`ZeroOversizedA4: true`, `oversizedCountAcrossSample: 0`). |
| 6 | **Testes** | Suíte E2E Automatizada Opaque-Box (`node tests/run_tests.js --station 1`) | ✅ | **120 / 120 testes PASS (100.0%)**, 0 falhas, 0 exceções em `tests/results/test_results.json`. |
| 7 | **Segurança** | Scan de segredos, SAST e superfície XSS/rede | ✅ | `grep -rnE "AIza|sk-|AKIA|PRIVATE KEY"` retornou `ZERO_SECRETS_FOUND`. Processamento 100% client-side offline sem exfiltração de dados. |
| 8 | **Visual e UX** | Inspeção visual em Chromium Headless (Temas Escuro e Claro, Modo 3D e Split-View 2D+3D, Paginação 1/N e Grade 2×2) | ✅ | 4 capturas em 1440×900 (`check_1_modo_3d_painel_completo.png`, `check_2_aba_2d_split_view_3d_selecao_parte.png`, `check_3_conversao_a4_subdivisao_sem_corte.png`, `check_4_tema_claro_split_view.png`). |
| 9 | **Acessibilidade** | Controles interativos rotulados, contraste e estados visuais (WCAG 2.2 AA) | ✅ | 98 botões e 71 inputs/selects auditados com rótulos semânticos e `title` descritivos; destaque visual de seleção com duplo indicador (cor âmbar + rótulo textual com costura e dimensões). |
| 10 | **Desempenho & Redundância** | Tempo de reconstrução 3D+2D, validação sintática e atualização do grafo | ✅ | `node --check CeramicMeshFactory.js` sem erros; `consoleErrors: 0`, `exceptions: 0`; `graphify update .` concluído (189 nós, 274 arestas). |

---

## Retrospectiva, Causa-Raiz (5 Porquês) e Melhoria Contínua (`/act`)

### 1. Comparação Quantitativa com as Metas (`docs/goal.md`)

| Critério (`goal.md`) | Meta Quantitativa | Resultado Medido | Status |
| :--- | :--- | :--- | :---: |
| **CS1 — Painel Lateral e Telemetria** | 100% dos controles de `#left-control-panel` e `#app-footer` visíveis e funcionais em 3D e 2D | **98 botões** e **71 inputs/selects** ativos, `leftPanelVisible: true`, `footerVisible: true` | ✅ |
| **CS2 — Fidelidade 3D dos Modelos** | 54/54 perfis clássicos + 100/100 itens do catálogo com curvas reais, anexos 3D e 0 `NaN` | **54/54 perfis PASS**, **7/7 placas utilitárias PASS**, **0 vértices `NaN`**, anexos 3D (`alca`, `bico`, `tampa`, `borda`) presentes | ✅ |
| **CS3 — Split-View 2D+3D & Seleção 2D↔3D** | Palco 3D visível na aba 2D + seleção visual bidirecional (2D ↔ 3D) em todos os modos | `Split2D+3D: true`, `PartSelect: true`, destaque sincronizado em `0xFFB020` via clique 2D, chips e `THREE.Raycaster` 3D | ✅ |
| **CS4 — Conversão 3D ➔ 2D em Folha A4** | `1` único disco de base + `0` peças cortadas fora da área útil A4 ($182 \times 253\text{ mm}$) | `BaseÚnica: true` (`discItems.length === 1`), `oversizedCountAcrossSample: 0` em 100% da amostra auditada | ✅ |
| **CS5 — Suíte E2E Automatizada** | 100% de aprovação na Estação 1 com 0 erros de console | **120 / 120 testes PASS (100.0%)**, `consoleErrors: 0`, `exceptions: 0` | ✅ |

---

### 2. Análise de Causa-Raiz (5 Porquês) e Ações Corretivas

#### Desvio A — Funções da antiga aba 3D/2D inacessíveis e modelos presos em geometria simplificada
1. **Por que as funções antigas sumiram?** Porque `#left-control-panel` (`#panel-vasos`) e `#app-footer` estavam com a classe `hidden` estática no HTML.
2. **Por que receberam `hidden`?** Porque uma iteração anterior de interface ocultou a coluna técnica para priorizar o catálogo horizontal de 100 peças.
3. **Por que os modelos 3D também pareciam travados ou genéricos?** Porque `rebuildVase()` verificava `curPiece.isSlabModel` antes de `vaseDesignMode`, desviando qualquer tentativa de editar perfis ou estágios para `renderSlabPiece3D()`.
4. **Por que os itens `#11–#100` do catálogo tinham silhuetas parecidas?** Porque haviam sido populados com 5 nós proporcionais genéricos sem sincronizar `CLASSIC_CERAMIC_PROFILES` e sem anexos 3D.
5. **Por que isso não foi barrado antes?** Porque o teste anterior verificava apenas se a malha tinha vértices (`totalVertices > 0`), sem exigir que `#left-control-panel` estivesse visível nem que `loadClassicProfilePreset` saísse do modo de placa.
- **Ação Corretiva Implementada**: Removido `hidden` de `#left-control-panel` e `#app-footer`, introduzida a flag explícita `isSlabPieceModeActive`, criado `synthesizeStagesFromSpline()` e sincronizados os 100 modelos do catálogo com `CLASSIC_CERAMIC_PROFILES` e anexos 3D.

#### Desvio B — Conversão 3D ➔ 2D em Folha A4 gerando disco duplicado e cortando faixas largas
1. **Por que a conversão A4 falhava em vasos/panelas largas?** Porque faixas cilíndricas ou cônicas com raio $R > 40\text{ mm}$ possuem comprimento de arco $2\pi R > 253\text{ mm}$, excedendo a dimensão útil da folha A4 ($182 \times 253\text{ mm}$).
2. **Por que essas faixas não cabiam na visualização A4?** Porque `frustumPatternPoints(rg)` sempre desenvolvia $360^\circ$ ($1.0$ volta inteira) em uma única peça indivisível, jogando o molde para `oversized` (fora das folhas A4).
3. **Por que o disco da base aparecia duplicado como uma tira retangular extra?** Porque `computeFrustumRings()` inclui o estágio `disco` como um anel cilíndrico de $8\text{ mm}$ para fechar a base 3D, e `prepareAllVasePatternItems()` convertia todos os `rings` em tiras laterais antes de adicionar o círculo do `disco`.
4. **Por que o modo Spline mostrava moldes desatualizados na aba 2D?** Porque a aba 2D lia apenas `vaseStages` antigo em vez de amostrar a curva Spline ativa ou o modelo HD ativo.
5. **Por que a falha persistia visualmente no canvas?** Porque `#studio-moldes-canvas` desenhava empilhamento vertical simples em vez das páginas A4 reais ($210 \times 297\text{ mm}$) do motor `packPatternsToA4Sheets()`.
- **Ação Corretiva Implementada**: Ignorado `rg.tipo === 'disco'` no loop de faixas laterais de `prepareAllVasePatternItems()`, adicionado parâmetro `angleFraction` em `frustumPatternPoints(rg, angleFraction)` com subdivisão automática em $K \in \{2, 3, 4, 6, 8\}$ arcos e costuras `[S1-A ↔ S1-B]`, criado o seletor unificado `getActivePatternItemsForA4()` e paginado `#studio-moldes-canvas` em folhas A4 reais (individual ou grade 2×2).

---

### 3. Padronização do Aprendizado
- **Contrato de Rastreabilidade de Partes (`userData.partId`)**: Toda sub-malha 3D gerada por `rebuildVaseFromSpline()`, `rebuildVase()`, `buildVaseAttachments3D()`, `rebuildHDSlabEngine()` ou `CeramicMeshFactory.createSlabPieceParts()` carrega obrigatoriamente `userData = { partId, partLabel, _isPrimaryClay }`, pareado 1:1 com o `partId` de cada item retornado por `getActivePatternItemsForA4()`.
- **Teste de Regressão Permanente**: O teste `s1_toggle_2d_3d_mode` em [`tests/stations/station1.js`](file:///mnt/c/Users/bruno/Documents/cerâmiKa/tests/stations/station1.js#L917-L993) agora falha imediatamente se `#left-control-panel` ou `#app-footer` forem ocultados, se o Split-View 2D+3D quebrar, se `selectSlabPart2D3D()` não exibir o badge da parte ou se `packPatternsToA4Sheets()` gerar qualquer `oversized` no modo `subdivide`.
- **ADR Consolidado**: Decisão arquitetural formalizada em [`docs/adr/0001-split-view-2d-3d-selecao-bidirecional-e-conversao-a4.md`](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/adr/0001-split-view-2d-3d-selecao-bidirecional-e-conversao-a4.md).

---

### 4. Dívida Técnica e Riscos Residuais (Priorizados por Impacto × Esforço)

| Prioridade | Item de Dívida Técnica / Risco Residual | Impacto | Esforço | Ação Recomendada |
| :---: | :--- | :---: | :---: | :--- |
| **P1 (Alta)** | **Suítes Legadas das Estações 2 a 5 (`tests/stations/station2..5.js`)**: O runner `tests/run_tests.js --station all` ainda referencia controles de estações antigas (`#c-native-mode`, `loadPresetPattern`) que foram removidas quando o app focou no Estúdio de Vasos e Placas. | Médio | Baixo | Atualizar ou arquivar `station2..5.js` em `tests/run_tests.js` para que `--station all` execute apenas as estações ativas sem falso-negativo. |
| **P2 (Média)** | **Modularização de `index.html` (~14.000 linhas)**: Dados de catálogo (`STUDIO_100_CATALOG`, `CLASSIC_CERAMIC_PROFILES`) e motores 2D/3D coexistem em arquivo monolítico. | Médio | Médio | Extrair catálogos estáticos para `CatalogData.js` mantendo compatibilidade local sem bundler. |
| **P3 (Baixa)** | **Exportação DXF / SVG Vetorial para Plotter de Recorte e Laser**: Atualmente a exportação 2D gera PDF A4 1:1. Ateliês com plotter de corte se beneficiariam de exportação SVG/DXF 1:1. | Baixo | Baixo | Adicionar botão de exportação `.SVG` 1:1 ao lado do botão `Baixar PDF A4 (1:1)`. |
