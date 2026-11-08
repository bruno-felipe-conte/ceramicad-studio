# Plano Técnico de Engenharia: Modelo 3D & Placas 2D

Consulte o artefato mestre estruturado em:
`plan_3d_slabs_and_lathe_refactor.md`

## Componentes Principais
1. **Header Principal**: Logo + Toggle central de modos (`Modo 3D` / `Modo 2D`) + Ações (`Exportar`, Tema).
2. **Barra de Catálogo & Lotes**: Lotes 1..10 com 10 peças cada, carrossel de chips horizontais e navegação de peças.
3. **Viewport 3D**: Three.js r128 com prato de torno concêntrico, materiais PBR (Terracota, Grés, Esmalte, Porcelana), corte 270° e dock de controles inferior.
4. **Editor CAD 2D**: Canvas milimétrico (0-350mm Y, 0-140mm X), nós interativos com badges de raio, espessura da placa de argila com preenchimento em terracota e aba de moldes 2D planificados.
