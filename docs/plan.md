# Plano Técnico de Engenharia: Alternador 2D ↔ 3D & Placas Cerâmicas

Consulte o documento mestre de planejamento com especificações completas em:
[`plan_2d_3d_slabs_expansion.md`](file:///home/bruno/.gemini/antigravity/brain/af9dde2a-7b63-46cd-9550-6c362e6e5900/plan_2d_3d_slabs_expansion.md)

## Componentes Técnicos
1. **Alternador Unificado 2D ↔ 3D**:
   - Alternância na barra superior (`setStudioAppMode('3d')` / `setStudioAppMode('2d')`) sincronizada com o estado da peça ativa.
   - Modo 3D: renderização volumétrica Three.js com prato de torno giratório e OrbitControls.
   - Modo 2D: visualizador técnico de desdobramento com linhas de corte contínuo, linhas de vinco tracejadas e cotas em mm.
2. **Catálogo de 7 Peças Utilitárias em Placas**:
   - Monoplacas vincadas: Porta-copos geométrico, Saboneteira com calha, Porta-incenso canoa, Descanso de talheres.
   - Multi-placas compostas: Manteigueira Francesa com vedação hidráulica, Saleiro de parede/mesa chanfrado 45° e Vaso/Garrafa facetada.
3. **Módulo de Geometria Tridimensional (`CeramicMeshFactory.js`)**:
   - Criação de geometrias com cálculo manual de normais de faceta e espessura real de placa de argila crua.
4. **Motor de Desdobramento e Cotas 2D**:
   - `renderStudioMoldesCanvas()` aprimorado com desenho normatizado de moldes de corte e vincos.
