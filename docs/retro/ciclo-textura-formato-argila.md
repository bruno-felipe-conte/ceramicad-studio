# Verificação Independente (/check) & Retrospectiva (/act) — Textura PBR, Formato de Seção e Relevo da Argila

**Data:** 2026-11-09
**Status:** 120/120 Testes E2E Aprovados (100.0% PASS, 0 Erros de Console)

## 1. Problema Identificado (5 Porquês)
1. **Por que todos os vasos apresentavam a mesma ondulação na estrutura?**
   Porque `#v-loft-mid` tinha o valor padrão estático `'petals'` com torção de `45°` no HTML/JS e `loadCatalogPiece()` não redefinia os parâmetros de seção transversal ao trocar de peça.
2. **Por que alterar a textura/acabamento no dock 3D parecia não funcionar?**
   Porque os botões do dock passavam `'esmalte_celadon'` e `'porcelana_biscuit'` para `CinnabarMaterialSystem.getMaterial()`, que esperava `'celadon'` e `'porcelana'`, caindo no fallback padrão (`terracota`), e `applyCeramicFinish()` não percorria sub-malhas recursivamente (`traverse`).

## 2. Solução Implementada (`/build`)
- **Calibração Morfológica Inteligente ([`index.html`](file:///mnt/c/Users/bruno/Documents/cer%C3%A2miKa/index.html)):**
  - Padrão de `#v-loft-mid` alterado para `'circle'` e `#v-twist-angle` para `0°`.
  - `loadCatalogPiece()` agora detecta automaticamente se a peça é circular de torno, facetada/poligonal, canelada ou ondulada e aplica os parâmetros exatos.
- **Seletores Rápidos no Viewport 3D ([`index.html`](file:///mnt/c/Users/bruno/Documents/cer%C3%A2miKa/index.html)):**
  - Adicionados no canto superior direito do viewport 3D os seletores **Forma** (`Circular`, `Facetado`, `Ondulado`, `Torcido`) e **Relevo** (`Liso Suave`, `Canelado Vertical`, `Martelado Manual`, `Ondas Zen`, `Corda Espiral`, `Favo 3D`, `Gomos`, `Trama Cesto`, `Senoidal`, `Escamas`).
- **Suporte em Peças de Placas ([`CeramicMeshFactory.js`](file:///mnt/c/Users/bruno/Documents/cer%C3%A2miKa/CeramicMeshFactory.js)):**
  - Implementado `applyProceduralClayModifiers()` com subdivisão adaptativa de malha e deslocamento de vértices ao longo das normais para aplicar relevos e torções também nas peças de placas.
- **Motor PBR (`CinnabarMaterialSystem`):**
  - Suporte a aliases, botão dedicado para `Raku`, destaque ativo nos botões `#dock-finish-*` e atualização via `activeMeshGroup.traverse()`.

## 3. Evidências de Verificação (`/check`)
- **Suíte Automatizada (`tests/run_tests.js`):** `120/120 PASS` (`0` falhas, `0` erros de console).
- **Inspeção Visual (1440×850):**
  - `clay_circular_liso_terracota.png`: Xícara cônica (#1) 100% circular e lisa em Terracota.
  - `clay_canelado_celadon.png`: Xícara com relevo Canelado Vertical e esmalte Celadon craquelado.
  - `clay_facetado_raku.png`: Xícara com seção Facetada Poligonal, relevo Ondas Zen e acabamento Raku metálico.
