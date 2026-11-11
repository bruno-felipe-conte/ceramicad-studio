# Retrospectiva e Melhoria Contínua (/act) — Ciclo 02

**Data:** 10/11/2026 23:27  
**Ciclo:** PDCA 02 — Filtro Hierárquico em Cascata de Modelos 3D  
**DoD Referência:** [docs/goal.md](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/goal.md) e [docs/plan.md](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/plan.md)  
**Decisão Arquitetural:** [ADR 0002](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/adr/0002-filtro-hierarquico-em-cascata-modelos-3d.md)

---

## 1. Comparação Numérica: Resultados vs. Metas (DoD)

| Critério de Aceite (SMART) | Meta Estipulada | Resultado Obtido | Status |
| :--- | :--- | :--- | :---: |
| **CA1 — Filtragem por Método** | Seleção `Plaqueira` isola 12 peças de placa + especiais compatíveis | 12 plaqueiras + 2 especiais vinculados isolados com 100% de precisão | ✅ Atingido |
| **CA2 — Filtragem por Categoria** | `Plaqueira` + `Decoração` exibe peças como Luminária, Cachepô e Incenso | Filtro exibe exatamente 5 modelos pertinentes (`bib_lampshade`, `#45`, `#68`, `#90`, `#51`) | ✅ Atingido |
| **CA3 — Breadcrumb Reativo** | Trilha visual atualizada em tempo real com breadcrumb clicável | Exibição síncrona `Plaqueira › Decoração › Cúpula de Luminária Vazada` com links de reset parcial | ✅ Atingido |
| **CA4 — Desempenho & Latência** | Filtragem reativa do dropdown em $< 50\text{ ms}$ | Execução pura em memória em $< 2\text{ ms}$ no DOM | ✅ Atingido |
| **CA5 — Testes Automatizados** | 100% de aprovação na suíte de testes de regressão (137/137) | **137/137 testes aprovados** (0 falhas, 0 exceções no console, tempo 162.21s) + teste E2E dedicado | ✅ Atingido |

---

## 2. Análise de Causa-Raiz (5 Porquês)

- **Problema Inicial:** O usuário sentia dificuldade para encontrar peças específicas no seletor entre os 66 modelos, que estavam dispersos em optgroups longos sem refinamento prévio por uso ou técnica construtiva.
- **Por que 1?** Porque o seletor `#classic-profile-select` exibia todas as 66 opções em uma lista única contínua.
- **Por que 2?** Porque não havia um nível intermediário de agregação conceitual entre a técnica (placa vs. torno) e a finalidade de uso (mesa, cozinha, decoração).
- **Por que 3?** Porque o acervo cresceu de 14 para 66 modelos rapidamente com a unificação das bibliotecas gregas, asiáticas e do construtor de placas sem uma taxonomia relacional declarada.
- **Por que 4?** Porque cada subsistema registrava seus modelos com chaves isoladas (`STUDIO_100_CATALOG`, `CLASSIC_CERAMIC_PROFILES`, `SLAB_PIECES_DEFINITIONS`).
- **Por que 5 (Causa-Raiz)?** Faltava uma camada canônica de metadados taxonômicos relacionando `key`, `methods` e `category` com desacoplamento puro de renderização.
- **Ação Corretiva Implementada:** Criação do array centralizado `CERAMIC_CATALOG_TAXONOMY` e motor puro `getFilteredCatalogPieces()` acoplado a um breadcrumb e seletores reativos com sincronização bidirecional.

---

## 3. Padrões Instituídos & Aprendizados

1. **Taxonomia Declarativa**: Novas peças adicionadas ao catálogo agora devem ser obrigatoriamente registradas em `CERAMIC_CATALOG_TAXONOMY` com seus métodos permitidos e categoria principal.
2. **Sincronização Reversa Defensiva**: Qualquer seleção externa de peça expande automaticamente os filtros se a peça pertencer a outra categoria, evitando que o seletor fique em estado inconsistente ou vazio.
3. **Preservação de IDs de Contrato**: Manter o elemento `<select id="classic-profile-select">` permitiu que 100% dos testes legados e interações por teclado continuassem funcionando sem necessidade de alteração na suíte de testes existente.

---

## 4. Dívida Técnica & Riscos Residuais

| Item | Impacto | Esforço | Prioridade |
| :--- | :---: | :---: | :---: |
| **Busca Textual (Fuzzy Search)**: Adicionar input de texto para filtrar peças por nome | Médio | Baixo | Média |
| **Miniaturas de Pré-visualização**: Ícones SVG ou thumbnails em mini-galeria visual ao lado do seletor | Médio | Médio | Baixa |
| **Exportação em Lote**: Permitir exportar múltiplos moldes de uma mesma categoria filtrada | Alto | Médio | Próximo Ciclo |

---

## 5. Proposta para o Próximo Ciclo PDCA

- **Sugestão:** Otimização do fluxo de moldes de corte A4 para peças de placa filtradas (adicionar anotação de ângulo de bisel nos moldes 2D para montagem direta no ateliê).
