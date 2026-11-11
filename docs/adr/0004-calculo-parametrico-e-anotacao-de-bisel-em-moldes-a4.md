# ADR 0004: Cálculo Paramétrico e Anotações de Bisel (45° / 30° / 22.5°) em Moldes 2D para Folha A4

## Status
Aprovado

## Contexto
No ateliê de cerâmica em placas (*slab building*), para unir duas placas planas de argila em ponto de couro formando um sólido tridimensional (um prisma quadrado, hexagonal ou octogonal, ou um cilindro enrolado), as bordas não podem ser coladas a topo (90° contra 90°), pois a junta racha na secagem e na queima e deixa a espessura da placa visível. As quinas devem ser cortadas em bisel (*miter joint*) na metade do ângulo suplementar da quina:

$$\text{Ângulo Interno} = \frac{(N - 2) \cdot 180^\circ}{N}$$
$$\text{Ângulo de Bisel} = \frac{180^\circ - \text{Ângulo Interno}}{2} = \frac{180^\circ}{N}$$

- Para $N = 4$ (quadrado): $\text{Bisel} = \frac{180^\circ}{4} = 45^\circ$
- Para $N = 6$ (hexágono): $\text{Bisel} = \frac{180^\circ}{6} = 30^\circ$
- Para $N = 8$ (octógono): $\text{Bisel} = \frac{180^\circ}{8} = 22.5^\circ$
- Para cilindros/cones contínuos enrolados: a emenda axial recebe bisel de $45^\circ$ para junção com sobreposição de barbotina.

## Opções Consideradas

1. **Opção A (Anotação Genérica Estática)**:
   - Exibir texto genérico fixo "Bisel 45°" em todas as folhas A4.
   - *Desvantagem*: Errado para peças com 6 ou 8 lados (como a Garrafa #68 ou o Cachepô #45), onde o ângulo correto é 30° ou 22.5°, induzindo o ceramista a cortar com ângulo errado e gerando deformação da peça.

2. **Opção B (Cálculo Paramétrico Geométrico Rigoroso com Estampa nas Arestas — ⭐ Escolhida)**:
   - Determinar automaticamente o número de lados $N$ a partir do estágio ou modelo (ex.: `curPiece.segments` ou contagem de faces da placa).
   - Injetar no objeto do molde: `bevelDeg`, `bevelLabel` e marcação visual nas bordas de costura lateral com linha guia e símbolo `∠`.
   - Incluir a cota correspondente no PDF A4 (jsPDF) em escala 1:1.

## Decisão
Adotar a **Opção B**.

## Consequências
- **Positivas**: Precisão de engenharia cerâmica, facilidade extrema para o ceramista no momento do corte na bancada com ferramenta chanfradora (como o chanfrador #53), acabamento profissional sem frestas.
- **Negativas / Limitações**: Requer cálculo em todas as peças que planificam em arcos/placas.
