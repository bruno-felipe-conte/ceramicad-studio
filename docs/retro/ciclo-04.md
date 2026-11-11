# Relatório de Verificação, Retrospectiva e Fechamento (/act) — Ciclo 04 (PDCA)

## 1. Comparação Numérica: Metas de `docs/goal.md` vs. Realizado

| Métrica | Meta (`docs/goal.md`) | Realizado no Ciclo 04 | Status |
| :--- | :--- | :--- | :---: |
| **Precisão dos ângulos de bisel** | 100% de exatidão matemática | 4 lados = 45.0°, 6 lados = 30.0°, 8 lados = 22.5°, cilindros/bases = 45.0° | ✅ **100%** |
| **Exibição visual no Canvas A4** | Visível em todos os moldes | Linha guia âmbar `#d97706` pontilhada + rótulo `∠ XX° [Bisel]` renderizados | ✅ **100%** |
| **Inclusão no PDF A4 exportado** | 100% dos moldes cotados | Cota técnica de bisel inclusa em `generateVasePDF` com escala 1:1 e régua de teste | ✅ **100%** |
| **Taxa de aprovação em testes** | 100% (137/137) | `node tests/run_tests.js --station 1`: **137/137 aprovados** | ✅ **100%** |
| **Erros e exceções no console** | 0 erros | 0 erros logados no CDP após os ajustes | ✅ **0 erros** |

---

## 2. Análise de Causa-Raiz (5 Porquês)

### Defeito 1: `RangeError: Maximum call stack size exceeded` em `enrichItemsWithBevelInfo`
1. *Por que ocorreu o estouro de pilha?* A função `enrichItemsWithBevelInfo` chamava a si mesma recursivamente sem condição de parada.
2. *Por que chamava a si mesma?* Na última linha da função, foi digitado `return enrichItemsWithBevelInfo(items);` em vez de `return items;`.
3. *Por que isso foi digitado?* Erro de digitação mecânica durante a edição do bloco de normalização.
4. *Por que não quebrou a sintaxe do interpretador?* Sintaticamente a recursão infinita é válida em JS e só estoura em tempo de execução.
5. *Ação Corretiva adotada:* Corrigido para `return items;` e validado via automação CDP no navegador real antes de qualquer merge.

### Defeito 2: `TypeError: Cannot read properties of undefined (reading 'children')` em `clearActiveGroup`
1. *Por que ocorreu o TypeError?* `clearActiveGroup()` tentou iterar `activeMeshGroup.children` quando `activeMeshGroup` era `undefined`.
2. *Por que `activeMeshGroup` era `undefined`?* `switchTool('vasos')` foi executado no início do teste Station 1 antes do término assíncrono de `initThree()`.
3. *Por que `switchTool` manipulava a malha antes do Three.js estar pronto?* Não havia guarda de pré-condição verificando a existência da instância de `activeMeshGroup`.
4. *Por que essa falha não aparecia no uso manual?* No uso humano, a página já carregou completamente antes do primeiro clique; mas em testes headless rápidos via CDP a chamada ocorre em milissegundos.
5. *Ação Corretiva adotada:* Adicionada guarda defensiva `if (!activeMeshGroup) return;` tanto em `clearActiveGroup()` quanto em `updateViewportBoundingBox()`.

---

## 3. Padrões Instituídos & Regras
- **Padrão de Guarda em Three.js**: Funções do ciclo de vida que manipulam malhas ativas (`clearActiveGroup`, `updateViewportBoundingBox`) devem sempre validar `if (!activeMeshGroup) return;` para garantir estabilidade em automações assíncronas.
- **Padrão Paramétrico de Bisel**: Todo molde de montagem para placas cerâmicas agora possui metadados `{ bevelDeg, bevelLabel, bevelType }` enriquecidos de forma determinística por `computeBevelInfoForPatternItem`.

---

## 4. Dívida Técnica & Riscos Residuais

| Item | Impacto | Esforço | Prioridade |
| :--- | :--- | :--- | :---: |
| Indicador de Espessura da Placa ($E$) estampada na cota de bisel (ex: `∠ 45° (Esp. 6mm)`) | Médio | Baixo | P1 |
| Exportação de gabarito para corte a laser em MDF / Acrílico (SVG com layers separadas por cor) | Alto | Médio | P2 |
| Simulador de encaixe 3D das quinas chanfradas com textura de barbotina visível | Baixo | Alto | P3 |

---

## 5. Proposta para o Próximo Ciclo PDCA (Ciclo 05)
Opções de incremento identificadas para validação do usuário.
