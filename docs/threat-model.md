# Modelo de Ameaças (STRIDE) & Checklist OWASP ASVS

## 1. Fronteiras de Confiança
1. **Fronteira 1 — Entrada de Parâmetros do Usuário e Upload Local (DOM / FileReader)**:
   - Sliders numéricos (altura, raio, espessura de parede, retração, quantidade de gomos/anéis), busca textual no catálogo e importação de receitas JSON / fotos de referência.
2. **Fronteira 2 — Motor de Geometria 3D, Raycasting & Nesting A4 (Memória / WebGL / Canvas 2D)**:
   - Geração de malhas `THREE.BufferGeometry`, interseção de raios (`THREE.Raycaster`), subdivisão de anéis para folha A4 e cálculo de fecho convexo (`packPatternsToA4Sheets`).
3. **Fronteira 3 — Exportação de Arquivos Locais (Blob / jsPDF / STLExporter)**:
   - Geração de arquivos `.pdf` e `.stl` no navegador do usuário.

---

## 2. Análise STRIDE por Fronteira

| Ameaça (STRIDE) | Fronteira | Cenário de Risco | Mitigação Aplicada |
| :--- | :--- | :--- | :--- |
| **S — Spoofing** | F1 | Carregamento de arquivo JSON malformado fingindo ser receita do CeramiCAD. | Validação estrita de tipos numéricos (`Number.isFinite`, limites `min`/`max`) em `importVasePatternJSON()`. |
| **T — Tampering** | F1 / F2 | Manipulação de inputs numéricos no DOM (`rBase <= 0`, `aneis = 0`, `retracao <= 0`) causando `NaN` ou geometria degenerada. | Clamping matemático defensivo em `computeFrustumRings()`, `splitRingToFitA4()` e `evaluateSplineRadius()` (`Math.max`, `Math.min`). |
| **R — Repudiation** | F3 | Divergência entre as dimensões exibidas na tela e o molde impresso em papel A4. | Cabeçalho técnico auditável em cada folha A4 com fator de retração explícito, cotas em mm e régua física de calibração de $50\text{ mm}$. |
| **I — Information Disclosure** | F1 / F3 | Vazamento de dados em logs ou chamadas externas. | Processamento 100% local (client-side); nenhum dado de projeto ou imagem do usuário é enviado a servidores externos. |
| **D — Denial of Service (DoS)** | F2 | Loop infinito ou travamento da thread principal no Nesting A4 ou na subdivisão de anéis muito largos. | Limite superior determinístico no número de subdivisões ($K \le 8$), passos fixos de $15^\circ$ no nesting e descarte seguro de geometrias vazias. |
| **E — Elevation of Privilege** | F1 | Injeção de HTML/XSS via nomes de peças ou importação de JSON na renderização de listas e badges. | Uso de `textContent` ou templates controlados com dados numéricos sanitizados; zero uso de `eval()`. |

---

## 3. Checklist OWASP ASVS (Aplicável a Aplicação Web Client-Side CAD)
- [x] **V1.1**: Arquitetura e fronteiras de confiança documentadas com fluxos de dados claros.
- [x] **V5.1 (Validação de Entrada)**: Todos os parâmetros geométricos possuem limites mínimos e máximos impostos no código antes do cálculo de malhas 3D e moldes 2D.
- [x] **V5.3 (Codificação de Saída)**: Dados dinâmicos em rótulos de peças e telemetria não permitem execução de scripts.
- [x] **V14.2 (Integridade de Dependências)**: Bibliotecas carregadas de CDNs oficiais em versões fixadas (`three@0.128.0`, `jspdf@2.5.1`).
