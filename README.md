# 🏺 CeramiCAD Studio — CAD Cerâmico & Olaria Digital

[![Deploy to GitHub Pages](https://img.shields.io/badge/Acessar-Demo%20Online-B84A39?style=for-the-badge&logo=githubpages&logoColor=white)](https://bruno-felipe-conte.github.io/ceramicad-studio/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-stone?style=for-the-badge)](LICENSE)

O **CeramiCAD Studio** é um estúdio paramétrico completo voltado para ceramistas artesanais, designers de produto e entusiastas da impressão 3D (PLA / Cerâmica Líquida). Ele combina a precisão da modelagem matemática com a sensibilidade tátil dos ateliês de cerâmica tradicionais.

---

## 🌐 Acesso Online Imediato (GitHub Pages)

Você pode utilizar a aplicação diretamente no seu navegador, sem necessidade de instalação ou servidor:
👉 **[https://bruno-felipe-conte.github.io/ceramicad-studio/](https://bruno-felipe-conte.github.io/ceramicad-studio/)**

---

## ✨ Principais Funcionalidades

### 🏺 1. Modelagem Dual de Vasos & Cachepôs
- **Modo Spline Escultural (Contínuo):**
  - Editor 2D interativo com nós arrastáveis para desenhar a silhueta do vaso.
  - Interpolação suave por *Spline Catmull-Rom* ou *Polilinha Angular* com controle de tensão ($0\%$ a $100\%$).
  - **Auto-Trace por Foto:** Insira uma imagem de referência para extrair a silhueta e gerar o vaso 3D automaticamente.
  - **Seções Transversais Paramétricas:** Círculos, polígonos regulares (3 a 24 lados) e pétalas onduladas/caneladas.
  - **Simetrias & Torção:** Simetrias Bilateral, Quádrupla e Moinho de Vento (*Windmill*), além de torção contínua de $-360^\circ$ a $+360^\circ$.
  - **Texturas 1D/2D:** Canelado romano, ondas senoidais, facetas em diamante (*spikes*) e escamas.
  - **Engenharia de Cachepô:** Furo de drenagem calibrável para plantas e filete arredondado na base para evitar trincas na secagem da argila.
- **Modo Estágios de Placas (Slab Building):**
  - Empilhamento de cilindros, cones e anéis esféricos com **Juntas Compartilhadas $C^0$ rigorosamente contínuas** ($0{,}000\text{ mm}$ de desvio).
  - Malha *watertight manifold* unificada em Three.js com fundo maciço e corte de inspeção 270°.
  - **Planificação 2D em Leques Curvos:** Cálculo exato de geratrizes e exportação em **PDF A4 1:1** com paginação multi-folhas (*tiling*), alvos de registro `⊕` e régua de conferência de 50 mm.

---

### ✂️ 2. Cortadores & Ejetores de Argila em 3 Peças
- Geração instantânea de conjunto completo de corte e estampa:
  1. **Matriz de Corte:** Lâmina afiada com chanfro progressivo ($0{,}4\text{ mm}$) e aba superior ergonômica.
  2. **Êmbolo Ejetor:** Relevo com ângulo de saída (*draft angle* de $7^\circ$ a $15^\circ$), respiros contra vácuo e curso limitado.
  3. **Botão Superior:** Para desmolde limpo sem deformar a argila úmida.
- **Live Preview STL & Prompts de IA:** Visualizador 3D dedicado e prompts calibrados para gerar modelos 3D a partir de imagens PB.

---

### 🌀 3. Utilitários de Ateliê Cerâmico
- **Rolos de Textura 360°:** Gravação contínua sobre cilindro oco para rolar sobre placas de argila.
- **Carimbos Manuais:** Modelos com pega anatômica e face positiva/negativa.
- **Litofania 3D:** Converte fotos em relevos translúcidos de porcelana ou filamento (plana, arco ou cilíndrica).
- **Caxilhos Modulares de Gesso (*Coddle Boards*):** Peças em "L" ajustáveis para moldagem de barbotina.
- **Réguas e Gabaritos:** Guias de espessura de placa (5 mm a 12 mm) e suportes de secagem.
- **Placas QR Code & Carimbos de Assinatura:** Displays com Pix/Instagram e marcadores espelhados para fundo de vasos.

---

### 📦 4. Biblioteca 3D & Analisador de Arquivos
- **9 Modelos Cerâmicos Prontos:** Ânfora Grega, Vaso Torcido, Vaso Nórdico Canelado, Cúpula de Luminária, Chawan Japonês, Cachepô Facetado, Costela de Oleiro, Chanfrador 45° e Bocal de Extrusora.
- **Analisador de Arquivos `.stl` e `.gcode`:** Leitura em tempo real de dimensões cúbicas, peso estimado, tempo de impressão FDM e quantidade de camadas.

---

### 💰 5. Precificador Técnico de Argila & Ateliê
- Integração direta com a malha 3D: importa o peso da argila úmida e a área superficial de esmaltação ($\text{cm}^2$) com um clique.
- **Massa Cerâmica:** Grés, Terracota, Porcelana, Argila Branca Taboão e Argila Chamotada.
- **Rateio Real de Forno:** Cálculo preciso do custo de queima de biscoito e alta temperatura por peça.
- **Mão de Obra por Etapa:** Modelagem, acabamento em ponto de couro e esmaltação.
- **Taxa de Risco de Queima (%):** Margem para cobertura de peças danificadas no forno.
- **Ficha Técnica Comercial em PDF:** Relatório completo com custo direto, custo total, preço de atacado e preço de varejo.

---

### 💡 6. Sistema Didático de 75 Tooltips `(?)` (WCAG 2.1 AA)
- Cada parâmetro técnico conta com um círculo interativo `(?)` que abre um balão pedagógico em 3 camadas:
  1. **Tag de Categoria** (ex: *Engenharia Cerâmica*, *Morfologia 3D*).
  2. **Conceito Essencial** sem termos herméticos.
  3. **Explicação Prática + 💡 Dica de Ateliê** com faixas numéricas recomendadas e boas práticas de secagem e impressão.
- Posicionamento inteligente contra vazamento de tela, suporte a toque mobile e fechamento com a tecla `Escape`.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & Vanilla JavaScript:** Arquitetura 100% *client-side*, sem necessidade de compilação ou frameworks pesados.
- **[Three.js (r128)](https://threejs.org/):** Renderização 3D WebGL acelerada por hardware, controle de iluminação de estúdio e cálculo de normais.
- **[Tailwind CSS (CDN)](https://tailwindcss.com/):** Design System responsivo "Nordic Ceramic Atelier" com suporte completo a Modo Claro e Modo Escuro.
- **[jsPDF](https://github.com/parallax/jsPDF):** Geração vetorial precisa em escala real 1:1 de pranchas de corte A4 e fichas técnicas.

---

## 🚀 Como Executar Localmente

Como a aplicação é um arquivo autônomo, basta clonar o repositório e abrir o `index.html` em qualquer navegador moderno:

```bash
# Clone o repositório
git clone https://github.com/bruno-felipe-conte/ceramicad-studio.git

# Acesse a pasta
cd ceramicad-studio

# Abra diretamente no navegador ou inicie um servidor local simples
python3 -m http.server 3000
```
Acesse no seu navegador: `http://localhost:3000`

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte `LICENSE` para mais informações.
