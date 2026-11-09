# Modelo de Ameaças (STRIDE): Alternador 2D/3D & Placas Cerâmicas

## Fronteiras de Confiança
- **Entrada do Usuário (UI/DOM)**: Inputs de espessura de placa, fator de retração, busca e seleção de presets.
- **Processamento Gráfico Local (Browser Client)**: Three.js WebGL Renderer, Canvas 2D Rendering Context e jsPDF.

## Análise STRIDE

| Elemento | Ameaça | Classificação | Mitigação Aplicada |
|---|---|---|---|
| **Inputs Numéricos (Espessura / Retração)** | Injeção de valores negativos, infinitos ou `NaN` gerando corrupção de vértices no Three.js e quebra do WebGL context. | **Tampering / DoS** | Clamping rigoroso com limites físicos seguros: espessura entre 2.0 mm e 25.0 mm; retração entre 1.00 e 1.35; sanitização via `parseFloat()` com fallbacks defensivos. |
| **Geração de Geometrias 3D (`CeramicMeshFactory.js`)** | Consumo excessivo de memória GPU por excesso de subdivisão em peças facetadas. | **Denial of Service** | Limite rígido no número de segmentos e facetas; descarte explícito de geometrias e materiais órfãos via `.dispose()`. |
| **Renderização 2D de Moldes no Canvas** | Falha de renderização por coordenadas fora dos limites de escala A4. | **Tampering** | Normalização de escala baseada no bounding box do molde com margem mínima de segurança de 20 mm. |
| **Exportação de Moldes em PDF** | Manipulação do fluxo de download local do cliente. | **Information Disclosure** | Operação 100% isolada na sandbox do navegador via jsPDF (client-side Blob), sem comunicação com servidores externos. |
