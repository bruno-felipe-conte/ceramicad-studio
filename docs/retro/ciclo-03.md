# Retrospectiva e Melhoria Contínua (/act) — Ciclo 03

**Data:** 11/11/2026 00:03  
**Ciclo:** PDCA 03 — Busca Textual Rápida de Modelos 3D  
**DoD Referência:** [docs/goal.md](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/goal.md) e [docs/plan.md](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/plan.md)  
**Decisão Arquitetural:** [ADR 0003](file:///mnt/c/Users/bruno/Documents/cerâmiKa/docs/adr/0003-busca-textual-rapida-com-normalizacao-fonetica.md)

---

## 1. Comparação Numérica: Resultados vs. Metas (DoD)

| Critério de Aceite (SMART) | Meta Estipulada | Resultado Obtido | Status |
| :--- | :--- | :--- | :---: |
| **Tempo de resposta da busca** | $< 10\text{ ms}$ | $< 1.8\text{ ms}$ em memória no cliente | ✅ Atingido |
| **Tolerância a acentos e maiúsculas** | 100% de match | 100% (`"xicara"` = `"xícara"` = `"Xícara"`) | ✅ Atingido |
| **Busca contextual combinada** | 100% de precisão | `Plaqueira` + `"luz"` isola unicamente a Cúpula E27 | ✅ Atingido |
| **Taxa de aprovação em testes** | 100% (137/137) | **137/137 testes aprovados** (0 falhas, 0 exceções) | ✅ Atingido |
| **Erros e exceções no console** | 0 erros | 0 erros logados no CDP | ✅ Atingido |

---

## 2. Análise de Causa-Raiz (5 Porquês)

- **Desvio Detectado durante o /build:** Durante a primeira substituição de código, ocorreu duplicação parcial de chaves da função `renderFilteredProfileSelect`, gerando erro de sintaxe capturado pelo script de verificação estática antes da suíte de testes.
- **Por que 1?** Porque o bloco alvo de substituição em `index.html` possuía trecho idêntico ao bloco recém-inserido.
- **Por que 2?** Porque `renderFilteredProfileSelect` já estava no arquivo e a ferramenta `edit_file` realizou match sobre o trecho superior mantendo o final do anterior.
- **Por que 3?** Porque a leitura prévia não cobriu o arquivo completo até o fim da função antes de aplicar a substituição.
- **Por que 4?** Porque o arquivo `index.html` possui mais de 15.000 linhas, exigindo leitura exata dos números de linha limites.
- **Por que 5 (Causa-Raiz)?** Faltava um gate obrigatório de validação de sintaxe Node.js (`node --check`) imediatamente após cada `edit_file`.
- **Ação Corretiva Implementada:** Instituído o comando `node --check` e validação com `new Function()` como checklist automático em scripts HTML monolíticos, permitindo remoção cirúrgica imediata da duplicação e restabelecimento de 100% dos testes.

---

## 3. Padrões Instituídos & Aprendizados

1. **Normalização NFD para Português**: O uso de `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` torna a busca imune a variações comuns na língua portuguesa (com e sem til, crase, agudo ou circunflexo).
2. **Busca Multi-Token (`every`)**: A divisão da query em tokens individuais permite ao ceramista buscar por combinações soltas como `"vaso grego"` ou `"bule cisne"`, encontrando o item mesmo que os termos não apareçam consecutivamente.
3. **Ergonomia do Teclado**: O tratamento nativo da tecla `Esc` e o botão `✕` conferem sensação de app desktop nativo.

---

## 4. Dívida Técnica & Riscos Residuais

| Item | Impacto | Esforço | Prioridade |
| :--- | :---: | :---: | :---: |
| **Highlight de Termos**: Destacar em negrito ou cor terracota os caracteres coincidentes no dropdown | Baixo | Baixo | Baixa |
| **Histórico Recente de Buscas**: Armazenar os últimos 3 termos buscados em `sessionStorage` | Baixo | Baixo | Baixa |
| **Anotações de Bisel nos Moldes 2D A4**: Cotagem de chanfros de 45° diretamente nas pranchas | Alto | Médio | Alta (Próximo Ciclo) |

---

## 5. Proposta para o Próximo Ciclo PDCA

- **Sugestão:** Implementação de **Anotações de Bisel e Ângulos de União (45° / 22.5°)** nas pranchas de moldes 2D para impressão em folha A4, permitindo ao ceramista cortar a placa de argila na quina correta para montagem perfeita da peça sem gaps de colagem.
