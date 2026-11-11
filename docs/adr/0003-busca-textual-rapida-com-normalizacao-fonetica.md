# ADR 0003: Busca Textual Rápida com Normalização de Acentos (In-Memory Client-Side)

## Status
Aprovado

## Contexto
O CeramiCAD Studio Pro possui 66 modelos cerâmicos no seletor centralizado e 100 peças no catálogo geral. Embora os filtros em cascata de Método e Categoria facilitem a navegação por grupos, os usuários frequentemente conhecem palavras-chave específicas da peça que desejam modelar (ex.: "azeite", "dionísio", "soquete", "calha", "matcha", "concha") ou preferem digitar "xic" em vez de navegar nos menus suspensos.

## Opções Consideradas

1. **Opção A (Indexador Externo / Biblioteca como Fuse.js)**:
   - Adicionar uma dependência externa como Fuse.js ou Lunr.js via CDN ou npm.
   - *Prós*: Algoritmo avançado de distância de Levenshtein.
   - *Contras*: Dependência adicional desnecessária (20 KB+) para um catálogo estático de 66 a 100 peças; viola a regra de KISS e YAGNI da Constituição de Engenharia.

2. **Opção B (Motor de Busca Nativo Puro com Normalização NFD — ⭐ Escolhida)**:
   - Implementar uma função pura `normalizeSearchText(str)` utilizando a API nativa JavaScript `str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()`.
   - Comparar substrings em múltiplos campos da peça (`label`, `desc`, `keywords`, `key`).
   - *Prós*: Zero dependências externas; execução ultrarrápida ($< 2\text{ ms}$); compatibilidade total com navegadores modernos; imune a vulnerabilidades de dependências.

## Decisão
Adotar a **Opção B**. Cada item da taxonomia terá um campo computado ou avaliado em tempo de busca contendo termos normalizados. A busca operará com debounce de 150 ms e filtrará em conjunto com os seletores de método e categoria ativos.

## Consequências
- **Positivas**: Resposta instantânea, tolerância a digitação com ou sem acentos (ex.: "xicara" encontra "Xícara"), experiência rica sem inflar o bundle.
- **Negativas / Limitações**: Não faz correção de digitação com erros severos de digitação (ex.: "ksikara"), o que é aceitável para um acervo técnico de termos cerâmicos.
