# Modelo de Ameaças (STRIDE)

| Fronteira de Confiança | Componente | Ameaça STRIDE | Mitigação |
|---|---|---|---|
| Borda do Usuário | Canvas 2D (Editor de Nós) | **T (Tampering)**: inserção de raios degenerados, negativos ou $NaN$. | Clamping rígido ($X \in [4, 140]$, $Y \in [0, 350]$), sanitização monotônica. |
| Pipeline WebGL | Renderizador 3D Three.js | **D (Denial of Service)**: explosão de geometria por subdivisões excessivas. | Trava estrita de resolução (máx. 72 radiais, 120 axiais) e pool de geometrias. |
| Exportador PDF | jsPDF | **E (Elevation/Injection)**: caracteres especiais maliciosos em rótulos de peças. | Sanitização estrita de strings UTF-8 antes do render vetorial. |
