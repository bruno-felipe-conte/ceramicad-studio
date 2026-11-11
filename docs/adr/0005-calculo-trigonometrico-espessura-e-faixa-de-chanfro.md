# ADR 0005: Cálculo Paramétrico da Espessura da Placa (E) e Largura da Faixa de Chanfro (w)

## Contexto
No Ciclo 04 foi implementado o cálculo dos ângulos de bisel $\theta$ (45°, 30°, 22.5°). No entanto, para um artesão ceramista cortar a placa de argila na bancada utilizando uma régua de metal e um estilete ou chanfrador, conhecer apenas o ângulo $\theta$ exige medição angular no olho. Conhecendo a largura da faixa horizontal na superfície da placa ($w$), o artesão pode simplesmente posicionar a régua a uma distância $w$ da borda e cortar com a lâmina inclinada até a quina oposta inferior, obtendo um chanfro matematicamente perfeito.

## Opções Consideradas
1. **Apenas ângulo $\theta$ (Status Quo do Ciclo 04)**: O ceramista deve estimar o ângulo do corte visualmente.
2. **Largura da Faixa $w = E \cdot \tan(\theta)$ estática fixada em 6 mm**: Ignora peças de paredes mais finas (ex: 4 mm) ou mais grossas (ex: 8-10 mm).
3. **Cálculo Trigonométrico Paramétrico Reativo ($w = E \cdot \tan(\theta)$) com renderização gráfica da faixa translúcida**: Obtém $E$ da peça ou do slider de espessura, calcula $w$ em milímetros reais e projeta a área translúcida na escala 1:1 no Canvas A4 e PDF.

## Decisão
Adotar a **Opção 3**:
- A espessura $E$ é extraída via cascata: `item.dimensions?.thickness || item.thickness || parseFloat(document.getElementById('v-espessura')?.value) || 6.0`.
- A largura de desbaste horizontal é dada por:
  $$w = E \cdot \tan\left(\theta \cdot \frac{\pi}{180}\right)$$
- Para $\theta = 45^\circ$: $w = E \cdot 1.0 = E$ (para $E=6\text{ mm} \implies w=6.0\text{ mm}$).
- Para $\theta = 30^\circ$: $w = E \cdot 0.577$ (para $E=6\text{ mm} \implies w=3.5\text{ mm}$).
- Para $\theta = 22.5^\circ$: $w = E \cdot 0.414$ (para $E=6\text{ mm} \implies w=2.5\text{ mm}$).
- Rótulo formatado: `∠ {deg}° · Esp. {E}mm · Faixa {w}mm`.
- Representação gráfica: Faixa translúcida `rgba(217, 119, 6, 0.14)` desenhada ao longo da aresta na largura proporcional $w \cdot \text{scale}$.

## Consequências
- **Positivas**: Reduz a zero o desperdício de argila e fechamentos imperfeitos com frestas; acelera a confecção manual no ateliê.
- **Negativas/Complexidade**: Exige desenhar um polígono de offset interno (`inward strip`) ou traçar a linha pontilhada com preenchimento entre a borda externa e a linha interna de recuo $w$.
