/**
 * =============================================================================
 * CERAMICAD STUDIO PRO — CeramicMeshFactory.js
 * =============================================================================
 * Fábrica de geometrias e malhas cerâmicas tridimensionais especializadas em:
 * 1. Geometrias de Origami (Yoshimura, Miura-ori, Waterbomb e Facetadas).
 * 2. Cálculo manual de vértices, normais e UVs para cada vinco e face plana.
 * 3. Substituição de LatheGeometry para geometrias não-circulares / angulares,
 *    garantindo arestas e vincos nítidos sem interpolação borrada de normais.
 * 4. Modelagem com espessura de placa de argila (parede externa, interna, bocal e fundo).
 * =============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    const exports = factory();
    root.CeramicMeshFactory = exports.CeramicMeshFactory || exports;
    if (typeof globalThis !== 'undefined') {
      globalThis.CeramicMeshFactory = root.CeramicMeshFactory;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {

  let _customThree = null;

  function getTHREE(override) {
    if (override) return override;
    if (_customThree) return _customThree;
    if (typeof THREE !== 'undefined') return THREE;
    if (typeof globalThis !== 'undefined' && globalThis.THREE) return globalThis.THREE;
    if (typeof window !== 'undefined' && window.THREE) return window.THREE;
    return null;
  }

  const CeramicMeshFactory = {

    /**
     * Permite injetar uma instância customizada do Three.js (ex: em testes Node.js ou bundlers).
     * @param {object} customThree
     */
    setTHREE(customThree) {
      _customThree = customThree;
    },

    /**
     * Substitui diretamente THREE.LatheGeometry para peças não circulares, facetadas e com vincos.
     * Enquanto o LatheGeometry tradicional interpola e arredonda normais de vértices em geometrias
     * poligonais (destruindo a nitidez das facetas cerâmicas), este método calcula vértices
     * independentes para cada face plana com normais ortogonais de face.
     *
     * @param {Array<{x: number, y: number}|THREE.Vector2>} profilePoints
     * @param {number} segments
     * @param {object} options
     * @returns {THREE.BufferGeometry}
     */
    replaceLatheGeometry(profilePoints, segments = 8, options = {}) {
      return this.createFacetedProfileGeometry(profilePoints, segments, options);
    },

    /**
     * Substitui THREE.LatheGeometry para geometrias não circulares e facetadas.
     * Gera uma malha BufferGeometry onde cada face tem seus próprios vértices
     * independentes, garantindo que as arestas e vincos fiquem perfeitamente
     * nítidos, planos e angulares (sem normais médias arredondadas).
     *
     * @param {Array<{x: number, y: number}|THREE.Vector2>} profilePoints - Pontos do perfil (raio x, altura y)
     * @param {number} segments - Número de faces poligonais ao redor do eixo Y (ex: 3 a 24)
     * @param {object} options - Opções avançadas (twistRad, creaseAmp, wallThickness, hollow, reverseNormals)
     * @returns {THREE.BufferGeometry}
     */
    createFacetedProfileGeometry(profilePoints, segments = 8, options = {}) {
      const THREE = getTHREE();
      if (!THREE) throw new Error('Three.js não encontrado.');

      const N = Math.max(3, parseInt(segments) || 8);
      const twistRad = options.twistRad || 0;
      const creaseAmp = options.creaseAmp || 0;
      const creaseFreq = options.creaseFreq || 1;
      const thetaStart = options.thetaStart || 0;
      const thetaLength = options.thetaLength || (Math.PI * 2);
      const reverseNormals = Boolean(options.reverseNormals);

      const P = profilePoints.map(pt => ({
        r: Math.max(0.1, pt.x !== undefined ? pt.x : (pt.r !== undefined ? pt.r : 0)),
        y: pt.y !== undefined ? pt.y : 0
      }));

      if (P.length < 2) {
        throw new Error('createFacetedProfileGeometry requer ao menos 2 pontos de perfil.');
      }

      const totalH = Math.max(1, P[P.length - 1].y - P[0].y);
      const vertices = [];
      const normals = [];
      const uvs = [];

      // Função que calcula a posição 3D de um vértice de vinco
      const computeCreaseVertex = (sliceIdx, segIdx) => {
        const pt = P[sliceIdx];
        const tY = (pt.y - P[0].y) / totalH;
        const baseAngle = thetaStart + (segIdx / N) * thetaLength;
        const currentAngle = baseAngle + twistRad * tY;

        // Modulação de vinco alternado (origami fold)
        let rMod = pt.r;
        if (creaseAmp !== 0) {
          const foldPhase = sliceIdx % 2 === 0 ? 1 : -1;
          const segPhase = (segIdx * creaseFreq) % 2 === 0 ? 1 : -1;
          rMod += creaseAmp * foldPhase * segPhase;
          rMod = Math.max(1.0, rMod);
        }

        const x = rMod * Math.sin(currentAngle);
        const z = rMod * Math.cos(currentAngle);
        const y = pt.y;
        return new THREE.Vector3(x, y, z);
      };

      // Monta cada face quadrangular subdividida em 2 triângulos independentes
      for (let j = 0; j < P.length - 1; j++) {
        const vNorm0 = (P[j].y - P[0].y) / totalH;
        const vNorm1 = (P[j + 1].y - P[0].y) / totalH;

        for (let i = 0; i < N; i++) {
          const uNorm0 = i / N;
          const uNorm1 = (i + 1) / N;

          // 4 vértices do vinco no quadrilátero
          const v00 = computeCreaseVertex(j, i);
          const v10 = computeCreaseVertex(j + 1, i);
          const v11 = computeCreaseVertex(j + 1, i + 1);
          const v01 = computeCreaseVertex(j, i + 1);

          // Função auxiliar para registrar triângulo com normais de face puras (flat)
          const addTriangle = (pA, pB, pC, uvA, uvB, uvC) => {
            const edge1 = new THREE.Vector3().subVectors(pB, pA);
            const edge2 = new THREE.Vector3().subVectors(pC, pA);
            const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

            if (reverseNormals) {
              normal.negate();
            }

            vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
            normals.push(
              normal.x, normal.y, normal.z,
              normal.x, normal.y, normal.z,
              normal.x, normal.y, normal.z
            );
            uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
          };

          if (!reverseNormals) {
            // Triângulo 1
            addTriangle(v00, v10, v11, [uNorm0, vNorm0], [uNorm0, vNorm1], [uNorm1, vNorm1]);
            // Triângulo 2
            addTriangle(v00, v11, v01, [uNorm0, vNorm0], [uNorm1, vNorm1], [uNorm1, vNorm0]);
          } else {
            // Triângulo 1 (invertido)
            addTriangle(v00, v11, v10, [1 - uNorm0, vNorm0], [1 - uNorm1, vNorm1], [1 - uNorm0, vNorm1]);
            // Triângulo 2 (invertido)
            addTriangle(v00, v01, v11, [1 - uNorm0, vNorm0], [1 - uNorm1, vNorm0], [1 - uNorm1, vNorm1]);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      return geo;
    },

    /**
     * Cria geometria de origami estilo Yoshimura (triangular diamond tessellation).
     * O padrão Yoshimura consiste em anéis de vincos onde vértices de montanha e vale
     * se alternam angular e radialmente, formando facetas triangulares e diamantadas.
     *
     * @param {object} options
     * @returns {THREE.BufferGeometry}
     */
    createOrigamiYoshimuraGeometry(options = {}) {
      const THREE = getTHREE();
      if (!THREE) throw new Error('Three.js não encontrado.');

      const height = Math.max(20, options.height || 140);
      const baseRadius = Math.max(15, options.baseRadius || 45);
      const topRadius = Math.max(15, options.topRadius || 42);
      const midRadius = Math.max(15, options.midRadius || 55);
      const columns = Math.max(4, parseInt(options.columns) || 8); // Número de facetas circunferenciais
      const tiers = Math.max(3, parseInt(options.tiers) || 7);     // Número de linhas horizontais de vinco
      const creaseDepth = options.creaseDepth !== undefined ? options.creaseDepth : 6.5; // Profundidade do vinco
      const wall = Math.max(1.5, options.wallThickness || 5.0);   // Espessura da placa de argila
      const hollow = options.hollow !== false;                    // Se deve criar casca oca com fundo e boca
      const verCorte = Boolean(options.verCorte);

      const maxCols = verCorte ? Math.ceil(columns * 0.75) : columns;
      const anglePerCol = (Math.PI * 2) / columns;

      // Avalia o raio macro do vaso em dada altura normalizada t in [0, 1]
      const evaluateMacroRadius = (t) => {
        // Interpolação quadrática suave: base -> mid -> topo
        if (t <= 0.5) {
          const u = t / 0.5;
          return (1 - u) * baseRadius + u * midRadius;
        } else {
          const u = (t - 0.5) / 0.5;
          return (1 - u) * midRadius + u * topRadius;
        }
      };

      // Matriz de vértices de vinco calculados manualmente: grid[tier][col]
      const generateOrigamiGrid = (wallOffset = 0) => {
        const grid = [];
        for (let j = 0; j <= tiers; j++) {
          const t = j / tiers;
          const y = t * height;
          const rMacro = Math.max(4.0, evaluateMacroRadius(t) - wallOffset);
          const isOddTier = (j % 2 === 1);
          const tierAngularShift = isOddTier ? (anglePerCol * 0.5) : 0;
          const tierCreaseSign = isOddTier ? -1 : 1; // Montanha vs Vale

          const row = [];
          for (let i = 0; i <= maxCols; i++) {
            const angle = i * anglePerCol + tierAngularShift;
            // Vértice de vinco com recuo ou projeção angular
            const rCrease = Math.max(2.0, rMacro + tierCreaseSign * creaseDepth);
            const x = rCrease * Math.sin(angle);
            const z = rCrease * Math.cos(angle);
            row.push(new THREE.Vector3(x, y, z));
          }
          grid.push(row);
        }
        return grid;
      };

      const outerGrid = generateOrigamiGrid(0);
      const innerGrid = hollow ? generateOrigamiGrid(wall) : null;

      const vertices = [];
      const normals = [];
      const uvs = [];

      const addFlatTriangle = (pA, pB, pC, uvA, uvB, uvC, reverse = false) => {
        const edge1 = new THREE.Vector3().subVectors(pB, pA);
        const edge2 = new THREE.Vector3().subVectors(pC, pA);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        if (reverse) normal.negate();

        if (reverse) {
          vertices.push(pA.x, pA.y, pA.z, pC.x, pC.y, pC.z, pB.x, pB.y, pB.z);
          normals.push(
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z
          );
          uvs.push(uvA[0], uvA[1], uvC[0], uvC[1], uvB[0], uvB[1]);
        } else {
          vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
          normals.push(
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z,
            normal.x, normal.y, normal.z
          );
          uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
        }
      };

      // 1. Constrói a Casca Externa Yoshimura
      for (let j = 0; j < tiers; j++) {
        const v0 = j / tiers;
        const v1 = (j + 1) / tiers;
        const isAlternating = (j % 2 === 1);

        for (let i = 0; i < maxCols; i++) {
          const u0 = i / columns;
          const u1 = (i + 1) / columns;

          const p00 = outerGrid[j][i];
          const p10 = outerGrid[j + 1][i];
          const p11 = outerGrid[j + 1][i + 1];
          const p01 = outerGrid[j][i + 1];

          // Tesselação diagonal dos vincos Yoshimura:
          // A diagonal inverte a cada camada alternada para criar o efeito de diamante sanfonado
          if (!isAlternating) {
            addFlatTriangle(p00, p10, p11, [u0, v0], [u0, v1], [u1, v1], false);
            addFlatTriangle(p00, p11, p01, [u0, v0], [u1, v1], [u1, v0], false);
          } else {
            addFlatTriangle(p00, p10, p01, [u0, v0], [u0, v1], [u1, v0], false);
            addFlatTriangle(p10, p11, p01, [u0, v1], [u1, v1], [u1, v0], false);
          }
        }
      }

      // 2. Constrói a Casca Interna Oca (Normais Invertidas)
      if (hollow && innerGrid) {
        for (let j = 0; j < tiers; j++) {
          const v0 = j / tiers;
          const v1 = (j + 1) / tiers;
          const isAlternating = (j % 2 === 1);

          for (let i = 0; i < maxCols; i++) {
            const u0 = i / columns;
            const u1 = (i + 1) / columns;

            const p00 = innerGrid[j][i];
            const p10 = innerGrid[j + 1][i];
            const p11 = innerGrid[j + 1][i + 1];
            const p01 = innerGrid[j][i + 1];

            if (!isAlternating) {
              addFlatTriangle(p00, p10, p11, [u0, v0], [u0, v1], [u1, v1], true);
              addFlatTriangle(p00, p11, p01, [u0, v0], [u1, v1], [u1, v0], true);
            } else {
              addFlatTriangle(p00, p10, p01, [u0, v0], [u0, v1], [u1, v0], true);
              addFlatTriangle(p10, p11, p01, [u0, v1], [u1, v1], [u1, v0], true);
            }
          }
        }

        // 3. Conecta a Borda do Bocal (Rim / Lip) no Topo (j = tiers)
        const topJ = tiers;
        for (let i = 0; i < maxCols; i++) {
          const out0 = outerGrid[topJ][i];
          const out1 = outerGrid[topJ][i + 1];
          const in0 = innerGrid[topJ][i];
          const in1 = innerGrid[topJ][i + 1];

          addFlatTriangle(out0, out1, in1, [0, 1], [1, 1], [1, 0], false);
          addFlatTriangle(out0, in1, in0, [0, 1], [1, 0], [0, 0], false);
        }

        // 4. Conecta o Fundo da Base (Solid Base Floor) em Y = 0
        const centerOuter = new THREE.Vector3(0, 0, 0);
        const centerInner = new THREE.Vector3(0, wall, 0);

        for (let i = 0; i < maxCols; i++) {
          const out0 = outerGrid[0][i];
          const out1 = outerGrid[0][i + 1];
          // Base externa apontando para baixo
          addFlatTriangle(centerOuter, out1, out0, [0.5, 0.5], [1, 0], [0, 0], false);

          const in0 = innerGrid[0][i];
          const in1 = innerGrid[0][i + 1];
          // Fundo interno apontando para cima
          addFlatTriangle(centerInner, in0, in1, [0.5, 0.5], [0, 0], [1, 0], false);
        }

        // Se houver corte 270°, fecha as paredes laterais do corte
        if (verCorte) {
          // Parede lateral inicial (i = 0)
          for (let j = 0; j < tiers; j++) {
            const out0 = outerGrid[j][0];
            const out1 = outerGrid[j + 1][0];
            const in0 = innerGrid[j][0];
            const in1 = innerGrid[j + 1][0];
            addFlatTriangle(out0, in0, in1, [0, 0], [1, 0], [1, 1], false);
            addFlatTriangle(out0, in1, out1, [0, 0], [1, 1], [0, 1], false);
          }
          // Parede lateral final (i = maxCols)
          for (let j = 0; j < tiers; j++) {
            const out0 = outerGrid[j][maxCols];
            const out1 = outerGrid[j + 1][maxCols];
            const in0 = innerGrid[j][maxCols];
            const in1 = innerGrid[j + 1][maxCols];
            addFlatTriangle(out0, in1, in0, [0, 0], [1, 1], [1, 0], false);
            addFlatTriangle(out0, out1, in1, [0, 0], [0, 1], [1, 1], false);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      return geo;
    },

    /**
     * Constrói geometria de origami com vincos Miura-ori (Chevron / Herringbone).
     *
     * @param {object} options
     * @returns {THREE.BufferGeometry}
     */
    createOrigamiMiuraGeometry(options = {}) {
      const THREE = getTHREE();
      if (!THREE) throw new Error('Three.js não encontrado.');

      const height = Math.max(20, options.height || 140);
      const radius = Math.max(15, options.radius || 48);
      const columns = Math.max(4, parseInt(options.columns) || 8);
      const tiers = Math.max(3, parseInt(options.tiers) || 8);
      const creaseDepth = options.creaseDepth !== undefined ? options.creaseDepth : 5.0;
      const twistDeg = options.twistDeg || 0;
      const twistRad = (twistDeg * Math.PI) / 180;

      // Cria pontos de perfil com ziguezague nas alturas
      const profilePoints = [];
      for (let j = 0; j <= tiers; j++) {
        const t = j / tiers;
        const y = t * height;
        const r = radius;
        profilePoints.push({ x: r, y });
      }

      return this.createFacetedProfileGeometry(profilePoints, columns, {
        twistRad,
        creaseAmp: creaseDepth,
        creaseFreq: 1,
        hollow: options.hollow !== false
      });
    },

    /**
     * Cria geometria de origami estilo Waterbomb (Hourglass / Star Tessellation).
     * Cada célula quadrangular é vincada diagonalmente para um vértice central
     * tridimensional, gerando facetas em pirâmide alternada que produzem o clássico
     * relevo facetado de origami cerâmico de alto impacto visual.
     *
     * @param {object} options
     * @returns {THREE.BufferGeometry}
     */
    createOrigamiWaterbombGeometry(options = {}) {
      const THREE = getTHREE();
      if (!THREE) throw new Error('Three.js não encontrado.');

      const height = Math.max(20, options.height || 140);
      const baseRadius = Math.max(15, options.baseRadius || 45);
      const topRadius = Math.max(15, options.topRadius || 40);
      const midRadius = Math.max(15, options.midRadius || 55);
      const columns = Math.max(4, parseInt(options.columns) || 8);
      const tiers = Math.max(3, parseInt(options.tiers) || 6);
      const creaseDepth = options.creaseDepth !== undefined ? options.creaseDepth : 6.0;
      const wall = Math.max(1.5, options.wallThickness || 5.0);
      const hollow = options.hollow !== false;
      const verCorte = Boolean(options.verCorte);

      const maxCols = verCorte ? Math.ceil(columns * 0.75) : columns;
      const anglePerCol = (Math.PI * 2) / columns;

      const evalRadius = (t, offset = 0) => {
        let r;
        if (t <= 0.5) {
          const u = t / 0.5;
          r = (1 - u) * baseRadius + u * midRadius;
        } else {
          const u = (t - 0.5) / 0.5;
          r = (1 - u) * midRadius + u * topRadius;
        }
        return Math.max(3.0, r - offset);
      };

      const buildGrid = (offset = 0) => {
        const corners = [];
        for (let j = 0; j <= tiers; j++) {
          const t = j / tiers;
          const y = t * height;
          const r = evalRadius(t, offset);
          const row = [];
          for (let i = 0; i <= maxCols; i++) {
            const ang = i * anglePerCol;
            row.push(new THREE.Vector3(r * Math.sin(ang), y, r * Math.cos(ang)));
          }
          corners.push(row);
        }

        const centers = [];
        for (let j = 0; j < tiers; j++) {
          const t = (j + 0.5) / tiers;
          const y = t * height;
          const rBase = evalRadius(t, offset);
          const row = [];
          for (let i = 0; i < maxCols; i++) {
            const ang = (i + 0.5) * anglePerCol;
            const sign = ((i + j) % 2 === 0) ? 1 : -1;
            const rCrease = Math.max(2.0, rBase + sign * creaseDepth);
            row.push(new THREE.Vector3(rCrease * Math.sin(ang), y, rCrease * Math.cos(ang)));
          }
          centers.push(row);
        }

        return { corners, centers };
      };

      const outer = buildGrid(0);
      const inner = hollow ? buildGrid(wall) : null;

      const vertices = [];
      const normals = [];
      const uvs = [];

      const addTri = (pA, pB, pC, uvA, uvB, uvC, reverse = false) => {
        const edge1 = new THREE.Vector3().subVectors(pB, pA);
        const edge2 = new THREE.Vector3().subVectors(pC, pA);
        const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        if (reverse) normal.negate();

        const v1 = reverse ? pA : pA;
        const v2 = reverse ? pC : pB;
        const v3 = reverse ? pB : pC;
        const u1 = reverse ? uvA : uvA;
        const u2 = reverse ? uvC : uvB;
        const u3 = reverse ? uvB : uvC;

        vertices.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
        normals.push(
          normal.x, normal.y, normal.z,
          normal.x, normal.y, normal.z,
          normal.x, normal.y, normal.z
        );
        uvs.push(u1[0], u1[1], u2[0], u2[1], u3[0], u3[1]);
      };

      const tessellateCells = (grid, reverse = false) => {
        for (let j = 0; j < tiers; j++) {
          const v0 = j / tiers;
          const v1 = (j + 1) / tiers;
          const vMid = (j + 0.5) / tiers;

          for (let i = 0; i < maxCols; i++) {
            const u0 = i / columns;
            const u1 = (i + 1) / columns;
            const uMid = (i + 0.5) / columns;

            const p00 = grid.corners[j][i];
            const p01 = grid.corners[j][i + 1];
            const p11 = grid.corners[j + 1][i + 1];
            const p10 = grid.corners[j + 1][i];
            const pCenter = grid.centers[j][i];

            // 4 triângulos de vinco angular com normais planas independentes
            addTri(p00, p01, pCenter, [u0, v0], [u1, v0], [uMid, vMid], reverse);
            addTri(p01, p11, pCenter, [u1, v0], [u1, v1], [uMid, vMid], reverse);
            addTri(p11, p10, pCenter, [u1, v1], [u0, v1], [uMid, vMid], reverse);
            addTri(p10, p00, pCenter, [u0, v1], [u0, v0], [uMid, vMid], reverse);
          }
        }
      };

      // Casca externa
      tessellateCells(outer, false);

      if (hollow && inner) {
        // Casca interna oca
        tessellateCells(inner, true);

        // Borda superior (Rim)
        const topJ = tiers;
        for (let i = 0; i < maxCols; i++) {
          const o0 = outer.corners[topJ][i];
          const o1 = outer.corners[topJ][i + 1];
          const i0 = inner.corners[topJ][i];
          const i1 = inner.corners[topJ][i + 1];
          addTri(o0, o1, i1, [0, 1], [1, 1], [1, 0], false);
          addTri(o0, i1, i0, [0, 1], [1, 0], [0, 0], false);
        }

        // Fundo em Y = 0 (Base sólida)
        const cOut = new THREE.Vector3(0, 0, 0);
        const cIn = new THREE.Vector3(0, wall, 0);
        for (let i = 0; i < maxCols; i++) {
          const o0 = outer.corners[0][i];
          const o1 = outer.corners[0][i + 1];
          addTri(cOut, o1, o0, [0.5, 0.5], [1, 0], [0, 0], false);

          const i0 = inner.corners[0][i];
          const i1 = inner.corners[0][i + 1];
          addTri(cIn, i0, i1, [0.5, 0.5], [0, 0], [1, 0], false);
        }

        // Paredes do corte 270°
        if (verCorte) {
          for (let j = 0; j < tiers; j++) {
            const o0 = outer.corners[j][0];
            const o1 = outer.corners[j + 1][0];
            const i0 = inner.corners[j][0];
            const i1 = inner.corners[j + 1][0];
            addTri(o0, i0, i1, [0, 0], [1, 0], [1, 1], false);
            addTri(o0, i1, o1, [0, 0], [1, 1], [0, 1], false);

            const o0E = outer.corners[j][maxCols];
            const o1E = outer.corners[j + 1][maxCols];
            const i0E = inner.corners[j][maxCols];
            const i1E = inner.corners[j + 1][maxCols];
            addTri(o0E, i1E, i0E, [0, 0], [1, 1], [1, 0], false);
            addTri(o0E, o1E, i1E, [0, 0], [0, 1], [1, 1], false);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      return geo;
    },

    /**
     * Constrói malha completa (Mesh) de um vaso de origami cerâmico,
     * pronta para inserção direta na cena do Three.js.
     *
     * @param {object} options
     * @param {THREE.Material} material
     * @returns {THREE.Mesh}
     */
    createOrigamiVaseMesh(options = {}, material = null) {
      const THREE = getTHREE();
      if (!THREE) throw new Error('Three.js não encontrado.');

      const type = options.patternType || 'yoshimura';
      let geo;

      if (type === 'yoshimura') {
        geo = this.createOrigamiYoshimuraGeometry(options);
      } else if (type === 'miura') {
        geo = this.createOrigamiMiuraGeometry(options);
      } else if (type === 'waterbomb') {
        geo = this.createOrigamiWaterbombGeometry(options);
      } else {
        const pts = options.profilePoints || [
          { x: 25, y: 0 },
          { x: 42, y: 35 },
          { x: 55, y: 80 },
          { x: 48, y: 120 },
          { x: 40, y: 145 }
        ];
        geo = this.createFacetedProfileGeometry(pts, options.columns || 8, options);
      }

      const mat = material || new THREE.MeshStandardMaterial({
        color: 0xc86446,
        roughness: 0.45,
        metalness: 0.05,
        flatShading: true,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = options.name || 'origamiCeramicVase';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    },

    /**
     * Calcula o padrão de vincos 2D (Crease Pattern) desenrolado da peça de origami
     * para que o ceramista possa imprimir ou traçar diretamente na placa de argila crua.
     *
     * @param {object} options
     * @returns {object} { widthMm, heightMm, mountainCreases, valleyCreases, outline }
     */
    createOrigamiCreasePattern2D(options = {}) {
      const height = options.height || 140;
      const radius = options.radius || 48;
      const columns = Math.max(4, options.columns || 8);
      const tiers = Math.max(3, options.tiers || 7);
      const perimeter = 2 * Math.PI * radius;

      const colW = perimeter / columns;
      const rowH = height / tiers;

      const mountainCreases = [];
      const valleyCreases = [];
      const outline = [
        { x: 0, y: 0 },
        { x: perimeter, y: 0 },
        { x: perimeter, y: height },
        { x: 0, y: height }
      ];

      const patternType = options.patternType || 'yoshimura';

      // Linhas horizontais de vinco
      for (let j = 1; j < tiers; j++) {
        const y = j * rowH;
        const isMountain = (j % 2 === 0);
        const list = isMountain ? mountainCreases : valleyCreases;
        list.push({ p1: { x: 0, y }, p2: { x: perimeter, y }, type: isMountain ? 'mountain' : 'valley' });
      }

      // Linhas diagonais de vinco (Waterbomb vs Yoshimura)
      for (let j = 0; j < tiers; j++) {
        const y0 = j * rowH;
        const y1 = (j + 1) * rowH;
        const isAlt = (j % 2 === 1);

        for (let i = 0; i < columns; i++) {
          const x0 = i * colW;
          const x1 = (i + 1) * colW;

          if (patternType === 'waterbomb') {
            // Em Waterbomb, cada célula possui vincos diagonais cruzados formando 4 facetas triangulares
            const isMountainCell = ((i + j) % 2 === 0);
            if (isMountainCell) {
              mountainCreases.push({ p1: { x: x0, y: y0 }, p2: { x: x1, y: y1 }, type: 'mountain' });
              mountainCreases.push({ p1: { x: x1, y: y0 }, p2: { x: x0, y: y1 }, type: 'mountain' });
            } else {
              valleyCreases.push({ p1: { x: x0, y: y0 }, p2: { x: x1, y: y1 }, type: 'valley' });
              valleyCreases.push({ p1: { x: x1, y: y0 }, p2: { x: x0, y: y1 }, type: 'valley' });
            }
          } else {
            // Yoshimura / Miura
            if (!isAlt) {
              mountainCreases.push({ p1: { x: x0, y: y0 }, p2: { x: x1, y: y1 }, type: 'mountain' });
              valleyCreases.push({ p1: { x: x1, y: y0 }, p2: { x: x0, y: y1 }, type: 'valley' });
            } else {
              valleyCreases.push({ p1: { x: x0, y: y0 }, p2: { x: x1, y: y1 }, type: 'valley' });
              mountainCreases.push({ p1: { x: x1, y: y0 }, p2: { x: x0, y: y1 }, type: 'mountain' });
            }
          }
        }
      }

      return {
        widthMm: perimeter,
        heightMm: height,
        columns,
        tiers,
        mountainCreases,
        valleyCreases,
        outline
      };
    },

    /**
     * Gera malha volumétrica sólida de placa cerâmica plana com espessura t.
     * @param {Array<{x:number, y:number, z:number}>} vertices3D Vértices coplanares da face neutra
     * @param {THREE.Vector3} normal Vetor normal à face
     * @param {number} thickness Espessura da placa de argila (mm)
     * @param {Array<number>} indices Triangulação da face frontal
     */
    buildThickPlate(vertices3D, normal, thickness, indices = null) {
      const THREE = getTHREE();
      const n = normal.clone().normalize();
      const halfT = thickness * 0.5;

      const topVerts = vertices3D.map(v => new THREE.Vector3(v.x + n.x * halfT, v.y + n.y * halfT, v.z + n.z * halfT));
      const botVerts = vertices3D.map(v => new THREE.Vector3(v.x - n.x * halfT, v.y - n.y * halfT, v.z - n.z * halfT));

      const positions = [];
      const normals = [];
      const uvs = [];

      function addTri(pA, pB, pC, norm) {
        positions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
        normals.push(norm.x, norm.y, norm.z, norm.x, norm.y, norm.z, norm.x, norm.y, norm.z);
        const uvScale = 0.015;
        uvs.push(
          (pA.x + pA.z) * uvScale, (pA.y + pA.z) * uvScale,
          (pB.x + pB.z) * uvScale, (pB.y + pB.z) * uvScale,
          (pC.x + pC.z) * uvScale, (pC.y + pC.z) * uvScale
        );
      }

      // Triangulação da face superior e inferior
      const numV = vertices3D.length;
      if (!indices) {
        // Leque triangular padrão (fan) a partir do vértice 0
        for (let i = 1; i < numV - 1; i++) {
          addTri(topVerts[0], topVerts[i], topVerts[i + 1], n);
          addTri(botVerts[0], botVerts[i + 1], botVerts[i], n.clone().negate());
        }
      } else {
        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
          addTri(topVerts[i0], topVerts[i1], topVerts[i2], n);
          addTri(botVerts[i0], botVerts[i2], botVerts[i1], n.clone().negate());
        }
      }

      // Bordas laterais
      for (let i = 0; i < numV; i++) {
        const next = (i + 1) % numV;
        const edge = new THREE.Vector3().subVectors(vertices3D[next], vertices3D[i]).normalize();
        const sideNorm = new THREE.Vector3().crossVectors(edge, n).normalize();

        const tA = topVerts[i], tB = topVerts[next];
        const bA = botVerts[i], bB = botVerts[next];

        addTri(tA, tB, bB, sideNorm);
        addTri(tA, bB, bA, sideNorm);
      }

      return { positions, normals, uvs };
    },

    /**
     * 1. Porta-Copos Geométrico com Borda Vincada (Monoplaca)
     * Placa hexagonal com abas periféricas dobradas a 45° e cantos chanfrados em alívio.
     */
    createPortaCoposVincadoGeometry(options = {}) {
      const THREE = getTHREE();
      const radius = options.radius || 48; // Raio base ~96mm diâmetro
      const flangeW = options.flangeWidth || 14;
      const flangeAngle = (options.flangeAngleDeg || 45) * Math.PI / 180;
      const wall = options.wallThickness || 5.5;
      const sides = options.sides || 6;

      const positions = [];
      const normals = [];
      const uvs = [];

      // 1. Placa Base Central Hexagonal
      const basePoints = [];
      for (let i = 0; i < sides; i++) {
        const ang = (i * 2 * Math.PI) / sides;
        basePoints.push(new THREE.Vector3(radius * Math.cos(ang), 0, radius * Math.sin(ang)));
      }
      const baseMesh = this.buildThickPlate(basePoints, new THREE.Vector3(0, 1, 0), wall);
      positions.push(...baseMesh.positions);
      normals.push(...baseMesh.normals);
      uvs.push(...baseMesh.uvs);

      // 2. Abas periféricas dobradas
      for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        const pA = basePoints[i];
        const pB = basePoints[next];

        const edgeDir = new THREE.Vector3().subVectors(pB, pA).normalize();
        const outDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), edgeDir).normalize();

        // Elevação da aba segundo o flangeAngle
        const flapDir = new THREE.Vector3()
          .addScaledVector(outDir, Math.cos(flangeAngle))
          .addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(flangeAngle))
          .normalize();

        const pA_top = pA.clone().addScaledVector(flapDir, flangeW);
        const pB_top = pB.clone().addScaledVector(flapDir, flangeW);

        const flapNorm = new THREE.Vector3().crossVectors(flapDir, edgeDir).normalize();
        const flapMesh = this.buildThickPlate([pA, pB, pB_top, pA_top], flapNorm, wall);
        positions.push(...flapMesh.positions);
        normals.push(...flapMesh.normals);
        uvs.push(...flapMesh.uvs);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    /**
     * 2. Saboneteira com Escorredor Dobrado & Calha Central (Monoplaca)
     * Placa retangular com vincos longitudinais formando calha em V (15°),
     * furos oblongos de drenagem e pés de apoio inferiores.
     */
    createSaboneteiraDrenadaGeometry(options = {}) {
      const THREE = getTHREE();
      const length = options.length || 135;
      const width = options.width || 90;
      const angleDeg = options.slopeAngleDeg || 14;
      const wall = options.wallThickness || 6.0;

      const positions = [];
      const normals = [];
      const uvs = [];

      const slope = Math.tan(angleDeg * Math.PI / 180);
      const halfL = length * 0.5;
      const halfW = width * 0.5;
      const gutterY = 0;
      const wingY = halfW * slope;

      // Asa esquerda (descendo até a calha X = 0)
      const pLeft = [
        new THREE.Vector3(-halfW, wingY, -halfL),
        new THREE.Vector3(0, gutterY, -halfL),
        new THREE.Vector3(0, gutterY, halfL),
        new THREE.Vector3(-halfW, wingY, halfL)
      ];
      const normL = new THREE.Vector3(Math.sin(angleDeg * Math.PI / 180), Math.cos(angleDeg * Math.PI / 180), 0).normalize();
      const meshL = this.buildThickPlate(pLeft, normL, wall);
      positions.push(...meshL.positions); normals.push(...meshL.normals); uvs.push(...meshL.uvs);

      // Asa direita (subindo da calha X = 0)
      const pRight = [
        new THREE.Vector3(0, gutterY, -halfL),
        new THREE.Vector3(halfW, wingY, -halfL),
        new THREE.Vector3(halfW, wingY, halfL),
        new THREE.Vector3(0, gutterY, halfL)
      ];
      const normR = new THREE.Vector3(-Math.sin(angleDeg * Math.PI / 180), Math.cos(angleDeg * Math.PI / 180), 0).normalize();
      const meshR = this.buildThickPlate(pRight, normR, wall);
      positions.push(...meshR.positions); normals.push(...meshR.normals); uvs.push(...meshR.uvs);

      // 4 Pés inferiores cilíndricos/cônicos de apoio
      [-halfW * 0.65, halfW * 0.65].forEach(x => {
        [-halfL * 0.7, halfL * 0.7].forEach(z => {
          const footY = (Math.abs(x) * slope);
          const footGeo = new THREE.CylinderGeometry(5.5, 7.0, footY + 4, 16);
          footGeo.translate(x, -(footY + 4) * 0.5, z);
          const posArr = footGeo.attributes.position.array;
          const normArr = footGeo.attributes.normal.array;
          for (let i = 0; i < posArr.length; i += 3) {
            positions.push(posArr[i], posArr[i + 1], posArr[i + 2]);
            normals.push(normArr[i], normArr[i + 1], normArr[i + 2]);
            uvs.push(0.5, 0.5);
          }
        });
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    /**
     * 3. Porta-Incenso Tipo Canoa Parabólica (Monoplaca)
     * Placa esbelta alongada com perfil curvado em calha cônica, berço de cinzas e orifício de queima.
     */
    createPortaIncensoCanoaGeometry(options = {}) {
      const THREE = getTHREE();
      const length = options.length || 240;
      const maxW = options.maxWidth || 50;
      const wall = options.wallThickness || 5.0;
      const segmentsL = 24;

      const positions = [];
      const normals = [];
      const uvs = [];

      for (let i = 0; i < segmentsL; i++) {
        const u0 = i / segmentsL;
        const u1 = (i + 1) / segmentsL;
        const z0 = -length * 0.5 + u0 * length;
        const z1 = -length * 0.5 + u1 * length;

        // Largura em ogiva parabólica
        const w0 = Math.sin(u0 * Math.PI) * maxW * 0.5;
        const w1 = Math.sin(u1 * Math.PI) * maxW * 0.5;

        // Curvatura longitudinal e elevação das pontas
        const yTip0 = Math.pow(Math.abs(u0 - 0.5) * 2, 2.5) * 18;
        const yTip1 = Math.pow(Math.abs(u1 - 0.5) * 2, 2.5) * 18;

        // Faceta central esquerda e direita
        const vA = new THREE.Vector3(-w0, yTip0 + 10, z0);
        const vB = new THREE.Vector3(0, yTip0, z0);
        const vC = new THREE.Vector3(w0, yTip0 + 10, z0);

        const vD = new THREE.Vector3(-w1, yTip1 + 10, z1);
        const vE = new THREE.Vector3(0, yTip1, z1);
        const vF = new THREE.Vector3(w1, yTip1 + 10, z1);

        const meshL = this.buildThickPlate([vA, vB, vE, vD], new THREE.Vector3(0.5, 0.8, 0).normalize(), wall);
        const meshR = this.buildThickPlate([vB, vC, vF, vE], new THREE.Vector3(-0.5, 0.8, 0).normalize(), wall);

        positions.push(...meshL.positions, ...meshR.positions);
        normals.push(...meshL.normals, ...meshR.normals);
        uvs.push(...meshL.uvs, ...meshR.uvs);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    /**
     * 4. Descanso de Talheres / Hashe Dobrado em Zigue-Zague (Monoplaca)
     * Placa dobrada com 2 calhas em V para apoiar garfo, faca ou hashis sem tocar a mesa.
     */
    createDescansoTalheresGeometry(options = {}) {
      const THREE = getTHREE();
      const length = options.length || 85;
      const width = options.width || 42;
      const wall = options.wallThickness || 5.0;

      // 4 dobras em zigue-zague ao longo do comprimento X
      const profile = [
        { x: -length * 0.5, y: 0 },
        { x: -length * 0.25, y: 14 },
        { x: 0, y: 3 },
        { x: length * 0.25, y: 14 },
        { x: length * 0.5, y: 0 }
      ];

      const positions = [];
      const normals = [];
      const uvs = [];

      for (let i = 0; i < profile.length - 1; i++) {
        const p0 = profile[i];
        const p1 = profile[i + 1];

        const vA = new THREE.Vector3(p0.x, p0.y, -width * 0.5);
        const vB = new THREE.Vector3(p1.x, p1.y, -width * 0.5);
        const vC = new THREE.Vector3(p1.x, p1.y, width * 0.5);
        const vD = new THREE.Vector3(p0.x, p0.y, width * 0.5);

        const edgeX = p1.x - p0.x;
        const edgeY = p1.y - p0.y;
        const norm = new THREE.Vector3(-edgeY, edgeX, 0).normalize();

        const mesh = this.buildThickPlate([vA, vB, vC, vD], norm, wall);
        positions.push(...mesh.positions);
        normals.push(...mesh.normals);
        uvs.push(...mesh.uvs);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    /**
     * 5. Manteigueira Francesa / Canadense (French Butter Bell - Multi-placas)
     * Conjunto de Pote Base para Água Fria + Tampa-Cúpula interna com sino de manteiga.
     */
    createManteigueiraFrancesaGeometry(options = {}) {
      const THREE = getTHREE();
      const wall = options.wallThickness || 6.0;
      const rBase = options.radiusBase || 50; // Ø100mm
      const hBase = options.heightBase || 78;

      const positions = [];
      const normals = [];
      const uvs = [];

      // 1. Pote Base d'água cilíndrico/troncocônico oco
      const baseProf = [
        new THREE.Vector2(rBase * 0.85, 0),
        new THREE.Vector2(rBase, 8),
        new THREE.Vector2(rBase, hBase - 10),
        new THREE.Vector2(rBase + 4, hBase) // Aba externa de apoio
      ];
      const baseGeo = this.replaceLatheGeometry(baseProf, 32, {
        wallThickness: wall,
        bottomThickness: wall,
        closedBottom: true
      });

      // 2. Cúpula Invertida da Manteiga (Sino que encaixa na base)
      const rBell = rBase * 0.78;
      const hBell = hBase * 0.75;
      const domeProf = [
        new THREE.Vector2(12, hBase + 28), // Puxador superior
        new THREE.Vector2(rBase + 6, hBase + 6), // Flange que apoia na boca
        new THREE.Vector2(rBell, hBase - 4),
        new THREE.Vector2(rBell, hBase - hBell), // Boca do sino imersa na água
        new THREE.Vector2(rBell - wall, hBase - hBell),
        new THREE.Vector2(rBell - wall, hBase - 4),
        new THREE.Vector2(0, hBase + 4)
      ];
      const domeGeo = this.replaceLatheGeometry(domeProf, 32, {
        wallThickness: wall,
        closedBottom: false
      });

      // Mescla as duas partes
      [baseGeo, domeGeo].forEach(g => {
        const p = g.attributes.position.array;
        const n = g.attributes.normal.array;
        for (let i = 0; i < p.length; i += 3) {
          positions.push(p[i], p[i + 1], p[i + 2]);
          normals.push(n[i], n[i + 1], n[i + 2]);
          uvs.push(0.5, 0.5);
        }
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    /**
     * 6. Saleiro de Mesa / Paredão (Multi-placas chanfradas a 45°)
     * Caixa utilitária retangular com laterais inclinadas, boca frontal de acesso e aba protetora.
     */
    createSaleiroParedaoGeometry(options = {}) {
      const THREE = getTHREE();
      const wall = options.wallThickness || 6.0;
      const width = options.width || 110;
      const depth = options.depth || 90;
      const height = options.height || 120;
      const frontH = height * 0.45; // Frente rebaixada para acesso à mão

      const halfW = width * 0.5;
      const halfD = depth * 0.5;

      const positions = [];
      const normals = [];
      const uvs = [];

      // 1. Placa Fundo
      const pFundo = [
        new THREE.Vector3(-halfW, 0, -halfD),
        new THREE.Vector3(halfW, 0, -halfD),
        new THREE.Vector3(halfW, 0, halfD),
        new THREE.Vector3(-halfW, 0, halfD)
      ];
      const mFundo = this.buildThickPlate(pFundo, new THREE.Vector3(0, 1, 0), wall);
      positions.push(...mFundo.positions); normals.push(...mFundo.normals); uvs.push(...mFundo.uvs);

      // 2. Placa Traseira (Paredão Alto)
      const pTraseira = [
        new THREE.Vector3(-halfW, 0, -halfD),
        new THREE.Vector3(halfW, 0, -halfD),
        new THREE.Vector3(halfW, height, -halfD),
        new THREE.Vector3(-halfW, height, -halfD)
      ];
      const mTras = this.buildThickPlate(pTraseira, new THREE.Vector3(0, 0, 1), wall);
      positions.push(...mTras.positions); normals.push(...mTras.normals); uvs.push(...mTras.uvs);

      // 3. Placa Frontal (Baixa)
      const pFrente = [
        new THREE.Vector3(-halfW, 0, halfD),
        new THREE.Vector3(halfW, 0, halfD),
        new THREE.Vector3(halfW, frontH, halfD),
        new THREE.Vector3(-halfW, frontH, halfD)
      ];
      const mFrente = this.buildThickPlate(pFrente, new THREE.Vector3(0, 0, -1), wall);
      positions.push(...mFrente.positions); normals.push(...mFrente.normals); uvs.push(...mFrente.uvs);

      // 4. Laterais Trapezoidais Esquerda e Direita
      [-halfW, halfW].forEach(x => {
        const isLeft = x < 0;
        const pLat = [
          new THREE.Vector3(x, 0, -halfD),
          new THREE.Vector3(x, 0, halfD),
          new THREE.Vector3(x, frontH, halfD),
          new THREE.Vector3(x, height, -halfD)
        ];
        const mLat = this.buildThickPlate(pLat, new THREE.Vector3(isLeft ? 1 : -1, 0, 0), wall);
        positions.push(...mLat.positions); normals.push(...mLat.normals); uvs.push(...mLat.uvs);
      });

      // 5. Aba Superior Protetora Inclinada (Capô de proteção contra umidade)
      const pAba = [
        new THREE.Vector3(-halfW, height, -halfD),
        new THREE.Vector3(halfW, height, -halfD),
        new THREE.Vector3(halfW, height - 15, -halfD + 45),
        new THREE.Vector3(-halfW, height - 15, -halfD + 45)
      ];
      const mAba = this.buildThickPlate(pAba, new THREE.Vector3(0, 1, 0.4).normalize(), wall);
      positions.push(...mAba.positions); normals.push(...mAba.normals); uvs.push(...mAba.uvs);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    /**
     * 7. Vaso / Garrafa Facetada (Prisma de Placas Trapezoidais com Chanfro a 45°)
     * Geometria facetada precisa com faces planas nítidas e chanfros angulares.
     */
    createGarrafaFacetadaGeometry(options = {}) {
      const sides = options.sides || 8;
      const rBase = options.radiusBase || 42;
      const rBody = options.radiusBody || 65;
      const rNeck = options.radiusNeck || 26;
      const height = options.height || 180;
      const wall = options.wallThickness || 6.0;

      const profile = [
        { y: 0, r: rBase },
        { y: height * 0.45, r: rBody },
        { y: height * 0.82, r: rNeck },
        { y: height, r: rNeck * 1.1 }
      ];

      return this.replaceLatheGeometry(
        profile.map(p => ({ x: p.r, y: p.y })),
        sides,
        {
          wallThickness: wall,
          bottomThickness: wall,
          closedBottom: true,
          faceted: true
        }
      );
    },

    /**
     * Aplica modificadores morfológicos de formato (seção/torção) e relevo de superfície
     * em malhas de placas cerâmicas, subdividindo triângulos largos quando necessário.
     */
    applyProceduralClayModifiers(geo, options = {}) {
      const THREE = getTHREE();
      const tex = options.surfaceTexture || 'liso';
      const shapeMode = options.shapeMode || 'auto';
      const texAmp = options.texAmp || 1.4;
      const texFreq = options.texFreq || 16;

      if (tex === 'liso' && (shapeMode === 'auto' || shapeMode === 'polygon')) {
        return geo;
      }

      // 1. Subdivide triângulos grandes (2 passes) para suportar relevo contínuo
      let posArr = Array.from(geo.getAttribute('position').array);
      let normArr = Array.from(geo.getAttribute('normal').array);
      let uvArr = geo.getAttribute('uv') ? Array.from(geo.getAttribute('uv').array) : new Array((posArr.length / 3) * 2).fill(0);

      for (let pass = 0; pass < 2; pass++) {
        const nextPos = [];
        const nextNorm = [];
        const nextUv = [];
        const triCount = posArr.length / 9;

        for (let t = 0; t < triCount; t++) {
          const b = t * 9;
          const u = t * 6;
          const ax = posArr[b], ay = posArr[b + 1], az = posArr[b + 2];
          const bx = posArr[b + 3], by = posArr[b + 4], bz = posArr[b + 5];
          const cx = posArr[b + 6], cy = posArr[b + 7], cz = posArr[b + 8];

          const dAB = Math.hypot(bx - ax, by - ay, bz - az);
          const dBC = Math.hypot(cx - bx, cy - by, cz - bz);
          const dCA = Math.hypot(ax - cx, ay - cy, az - cz);

          if (Math.max(dAB, dBC, dCA) > 14) {
            const mxAB = (ax + bx) * 0.5, myAB = (ay + by) * 0.5, mzAB = (az + bz) * 0.5;
            const mxBC = (bx + cx) * 0.5, myBC = (by + cy) * 0.5, mzBC = (bz + cz) * 0.5;
            const mxCA = (cx + ax) * 0.5, myCA = (cy + ay) * 0.5, mzCA = (cz + az) * 0.5;

            const nx = normArr[b], ny = normArr[b + 1], nz = normArr[b + 2];
            const pushSubTri = (x1, y1, z1, x2, y2, z2, x3, y3, z3) => {
              nextPos.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
              nextNorm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
              nextUv.push((x1 + z1) * 0.015, (y1 + z1) * 0.015, (x2 + z2) * 0.015, (y2 + z2) * 0.015, (x3 + z3) * 0.015, (y3 + z3) * 0.015);
            };
            pushSubTri(ax, ay, az, mxAB, myAB, mzAB, mxCA, myCA, mzCA);
            pushSubTri(mxAB, myAB, mzAB, bx, by, bz, mxBC, myBC, mzBC);
            pushSubTri(mxCA, myCA, mzCA, mxBC, myBC, mzBC, cx, cy, cz);
            pushSubTri(mxAB, myAB, mzAB, mxBC, myBC, mzBC, mxCA, myCA, mzCA);
          } else {
            for (let k = 0; k < 9; k++) {
              nextPos.push(posArr[b + k]);
              nextNorm.push(normArr[b + k]);
            }
            for (let k = 0; k < 6; k++) {
              nextUv.push(uvArr[u + k]);
            }
          }
        }
        posArr = nextPos;
        normArr = nextNorm;
        uvArr = nextUv;
      }

      geo.computeBoundingBox();
      const minY = geo.boundingBox ? geo.boundingBox.min.y : 0;
      const maxY = geo.boundingBox ? Math.max(minY + 10, geo.boundingBox.max.y) : 100;
      const spanY = Math.max(10, maxY - minY);

      // 2. Desloca cada vértice segundo o formato e o relevo de argila
      const vCount = posArr.length / 3;
      for (let i = 0; i < vCount; i++) {
        const idx = i * 3;
        let vx = posArr[idx];
        let vy = posArr[idx + 1];
        let vz = posArr[idx + 2];
        const nx = normArr[idx];
        const ny = normArr[idx + 1];
        const nz = normArr[idx + 2];

        const yNorm = Math.max(0, Math.min(1, (vy - minY) / spanY));
        const phi = Math.atan2(vx, vz);

        // Modificador de forma (se selecionado pelo usuário)
        if (shapeMode === 'twisted') {
          const twistAng = yNorm * (Math.PI / 3);
          const cosT = Math.cos(twistAng);
          const sinT = Math.sin(twistAng);
          const rx = vx * cosT - vz * sinT;
          const rz = vx * sinT + vz * cosT;
          vx = rx;
          vz = rz;
        } else if (shapeMode === 'petals') {
          const wave = Math.cos(phi * 8) * 2.2 * Math.sin(yNorm * Math.PI);
          const rad = Math.hypot(vx, vz);
          if (rad > 2) {
            const scale = (rad + wave) / rad;
            vx *= scale;
            vz *= scale;
          }
        }

        // Modificador de relevo superficial
        let texDelta = 0;
        const coordU = (vx + vz) * 0.08;
        const coordV = vy * 0.08;
        if (tex === 'canelado') {
          texDelta = Math.cos(phi * texFreq + vx * 0.15) * texAmp;
        } else if (tex === 'senoidal') {
          texDelta = Math.sin(coordV * 2.2) * texAmp;
        } else if (tex === 'martelado') {
          const c1 = Math.sin(vx * 0.22) * Math.cos(vy * 0.22 + vz * 0.22);
          const c2 = Math.cos(vz * 0.18 - vx * 0.15);
          texDelta = -Math.abs(c1 * 0.7 + c2 * 0.3) * texAmp * 1.1;
        } else if (tex === 'ondas_zen') {
          texDelta = Math.sin(coordV * 2.5 + Math.sin(coordU * 1.5) * 1.5) * texAmp * 0.85;
        } else if (tex === 'espiral_corda') {
          texDelta = Math.pow(Math.max(0, Math.cos(phi * 6 + yNorm * Math.PI * 14)), 1.6) * texAmp;
        } else if (tex === 'favo_3d') {
          const rH = coordV * 1.2;
          const cA = coordU * 1.2 + (Math.floor(rH) % 2) * 0.5;
          const dHex = Math.hypot((cA - Math.floor(cA)) - 0.5, (rH - Math.floor(rH)) - 0.5);
          texDelta = (0.35 - Math.min(0.45, dHex)) * texAmp * 2.0;
        } else if (tex === 'gomos_abobora') {
          const gomo = Math.abs(Math.sin(phi * 6));
          texDelta = (Math.pow(gomo, 0.55) - 0.35) * texAmp * 1.4;
        } else if (tex === 'trama_cesto') {
          const wU = Math.sin(coordU * 2.5) * Math.cos(coordV * 2.5);
          const wV = Math.cos(coordU * 2.5) * Math.sin(coordV * 2.5);
          texDelta = (Math.abs(wU) - Math.abs(wV)) * texAmp * 0.9;
        } else if (tex === 'escamas') {
          texDelta = Math.max(0, Math.sin(coordV * 2.2 + Math.cos(coordU * 2.2))) * texAmp;
        }

        // Não desloca a sola inferior (vy próximo de minY com normal apontando para baixo)
        const bottomWeight = (vy - minY < 3.0 && ny < -0.5) ? 0.0 : 1.0;
        posArr[idx] = vx + nx * texDelta * bottomWeight;
        posArr[idx + 1] = vy + ny * texDelta * bottomWeight;
        posArr[idx + 2] = vz + nz * texDelta * bottomWeight;
      }

      const outGeo = new THREE.BufferGeometry();
      outGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      outGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
      outGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
      outGeo.computeVertexNormals();
      outGeo.computeBoundingBox();
      return outGeo;
    },

    /**
     * Ponto de entrada unificado para criação de qualquer peça utilitária de placas.
     * @param {string} pieceKey
     * @param {object} options
     * @returns {THREE.BufferGeometry}
     */
    createSlabPieceGeometry(pieceKey, options = {}) {
      const shapeMode = options.shapeMode || 'auto';
      const opts = Object.assign({}, options);
      if (shapeMode === 'circle') {
        opts.sides = 24;
      } else if (shapeMode === 'polygon') {
        opts.sides = options.sides || 6;
      }

      let baseGeo;
      switch (pieceKey) {
        case 'porta_copos_vincado':
          baseGeo = this.createPortaCoposVincadoGeometry(opts);
          break;
        case 'saboneteira_escorredor':
          baseGeo = this.createSaboneteiraDrenadaGeometry(opts);
          break;
        case 'porta_incenso_canoa':
          baseGeo = this.createPortaIncensoCanoaGeometry(opts);
          break;
        case 'descanso_talheres':
          baseGeo = this.createDescansoTalheresGeometry(opts);
          break;
        case 'manteigueira_francesa':
          baseGeo = this.createManteigueiraFrancesaGeometry(opts);
          break;
        case 'saleiro_paredao':
          baseGeo = this.createSaleiroParedaoGeometry(opts);
          break;
        case 'vaso_bonsai':
          baseGeo = this.createVasoBonsaiGeometry(opts);
          break;
        case 'bib_facetado':
          baseGeo = this.createBibFacetadoGeometry(opts);
          break;
        case 'cachepo_cubico':
          baseGeo = this.createCachepoCubicoGeometry(opts);
          break;
        case 'jardineira_placa':
          baseGeo = this.createJardineiraPlacaGeometry(opts);
          break;
        case 'copo_termico':
        case 'copo_take_away':
          baseGeo = this.createCopoTakeAwayGeometry(opts);
          break;
        case 'abajur_conico':
          baseGeo = this.createAbajurConicoGeometry(opts);
          break;
        case 'arandela_parede':
          baseGeo = this.createArandelaParedeGeometry(opts);
          break;
        case 'centro_ondulado':
          baseGeo = this.createCentroOnduladoGeometry(opts);
          break;
        case 'porta_velas':
          baseGeo = this.createPortaVelasGeometry(opts);
          break;
        case 'escultura_arco':
          baseGeo = this.createEsculturaArcoGeometry(opts);
          break;
        case 'porta_incenso':
          baseGeo = this.createPortaIncensoGeometry(opts);
          break;
        case 'tool_gauge':
          baseGeo = this.createToolGaugeGeometry(opts);
          break;
        case 'tool_chamfer':
          baseGeo = this.createToolChamferGeometry(opts);
          break;
        case 'tool_caliper':
          baseGeo = this.createToolCaliperGeometry(opts);
          break;
        case 'tool_ruler':
          baseGeo = this.createToolRulerGeometry(opts);
          break;
        case 'bib_costela':
          baseGeo = this.createBibCostelaGeometry(opts);
          break;
        case 'tool_rib_garrity':
          baseGeo = this.createToolRibGarrityGeometry(opts);
          break;
        case 'bib_extrusora':
          baseGeo = this.createBibExtrusoraGeometry(opts);
          break;
        case 'garrafa_facetada':
        default:
          baseGeo = this.createGarrafaFacetadaGeometry(opts);
          break;
      }

      return this.applyProceduralClayModifiers(baseGeo, opts);
    },

    /**
     * Retorna as partes individuais de uma peça utilitária de placas com seus respectivos partId
     * para seleção visual bidirecional 2D ↔ 3D (sincronizado com SLAB_PIECES_DEFINITIONS).
     * @param {string} pieceKey
     * @param {object} options
     * @returns {Array<{partId: string, geometry: THREE.BufferGeometry}>}
     */
    createSlabPieceParts(pieceKey, options = {}) {
      const THREE = getTHREE();
      const shapeMode = options.shapeMode || 'auto';
      const opts = Object.assign({}, options);
      if (shapeMode === 'circle') {
        opts.sides = 24;
      } else if (shapeMode === 'polygon') {
        opts.sides = options.sides || 6;
      }
      const wall = opts.wallThickness || 6.0;

      const buildGeoFromPlate = (m) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(m.positions, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(m.normals, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uvs, 2));
        g.computeBoundingBox();
        return this.applyProceduralClayModifiers(g, opts);
      };

      if (pieceKey === 'saleiro_paredao') {
        const width = opts.width || 110;
        const depth = opts.depth || 90;
        const height = opts.height || 120;
        const frontH = height * 0.45;
        const halfW = width * 0.5;
        const halfD = depth * 0.5;

        const mFundo = this.buildThickPlate([
          new THREE.Vector3(-halfW, 0, -halfD),
          new THREE.Vector3(halfW, 0, -halfD),
          new THREE.Vector3(halfW, 0, halfD),
          new THREE.Vector3(-halfW, 0, halfD)
        ], new THREE.Vector3(0, 1, 0), wall);

        const mTras = this.buildThickPlate([
          new THREE.Vector3(-halfW, 0, -halfD),
          new THREE.Vector3(halfW, 0, -halfD),
          new THREE.Vector3(halfW, height, -halfD),
          new THREE.Vector3(-halfW, height, -halfD)
        ], new THREE.Vector3(0, 0, 1), wall);

        const mFrente = this.buildThickPlate([
          new THREE.Vector3(-halfW, 0, halfD),
          new THREE.Vector3(halfW, 0, halfD),
          new THREE.Vector3(halfW, frontH, halfD),
          new THREE.Vector3(-halfW, frontH, halfD)
        ], new THREE.Vector3(0, 0, -1), wall);

        const latPos = [], latNorm = [], latUv = [];
        [-halfW, halfW].forEach(x => {
          const isLeft = x < 0;
          const mLat = this.buildThickPlate([
            new THREE.Vector3(x, 0, -halfD),
            new THREE.Vector3(x, 0, halfD),
            new THREE.Vector3(x, frontH, halfD),
            new THREE.Vector3(x, height, -halfD)
          ], new THREE.Vector3(isLeft ? 1 : -1, 0, 0), wall);
          latPos.push(...mLat.positions);
          latNorm.push(...mLat.normals);
          latUv.push(...mLat.uvs);
        });

        const mAba = this.buildThickPlate([
          new THREE.Vector3(-halfW, height, -halfD),
          new THREE.Vector3(halfW, height, -halfD),
          new THREE.Vector3(halfW, height - 15, -halfD + 45),
          new THREE.Vector3(-halfW, height - 15, -halfD + 45)
        ], new THREE.Vector3(0, 1, 0.4).normalize(), wall);

        return [
          { partId: 'slab-part-0', geometry: buildGeoFromPlate(mFundo) },
          { partId: 'slab-part-1', geometry: buildGeoFromPlate(mTras) },
          { partId: 'slab-part-2', geometry: buildGeoFromPlate(mFrente) },
          { partId: 'slab-part-3', geometry: buildGeoFromPlate({ positions: latPos, normals: latNorm, uvs: latUv }) },
          { partId: 'slab-part-4', geometry: buildGeoFromPlate(mAba) }
        ];
      }

      if (pieceKey === 'manteigueira_francesa') {
        const rBase = opts.radiusBase || 50;
        const hBase = opts.heightBase || 78;
        const rBell = rBase * 0.78;
        const hBell = hBase * 0.75;

        const gBaseDisc = this.replaceLatheGeometry([
          new THREE.Vector2(0.5, 0),
          new THREE.Vector2(rBase * 0.85, 0),
          new THREE.Vector2(rBase, 8)
        ], 32, { wallThickness: wall, bottomThickness: wall, closedBottom: true });

        const gBaseWall = this.replaceLatheGeometry([
          new THREE.Vector2(rBase, 8),
          new THREE.Vector2(rBase, hBase - 10),
          new THREE.Vector2(rBase + 4, hBase)
        ], 32, { wallThickness: wall, closedBottom: false });

        const gBell = this.replaceLatheGeometry([
          new THREE.Vector2(rBell, hBase - 4),
          new THREE.Vector2(rBell, hBase - hBell),
          new THREE.Vector2(rBell - wall, hBase - hBell),
          new THREE.Vector2(rBell - wall, hBase - 4)
        ], 32, { wallThickness: wall, closedBottom: false });

        const gFlange = this.replaceLatheGeometry([
          new THREE.Vector2(12, hBase + 28),
          new THREE.Vector2(rBase + 6, hBase + 6),
          new THREE.Vector2(rBell, hBase - 4)
        ], 32, { wallThickness: wall, closedBottom: false });

        return [
          { partId: 'slab-part-0', geometry: this.applyProceduralClayModifiers(gBaseDisc, opts) },
          { partId: 'slab-part-1', geometry: this.applyProceduralClayModifiers(gBaseWall, opts) },
          { partId: 'slab-part-2', geometry: this.applyProceduralClayModifiers(gBell, opts) },
          { partId: 'slab-part-3', geometry: this.applyProceduralClayModifiers(gFlange, opts) }
        ];
      }

      if (pieceKey === 'garrafa_facetada') {
        const sides = opts.sides || 8;
        const rBase = opts.radiusBase || 42;
        const rBody = opts.radiusBody || 65;
        const rNeck = opts.radiusNeck || 26;
        const height = opts.height || 180;

        const gBase = this.replaceLatheGeometry([
          { x: 0.5, y: 0 },
          { x: rBase, y: 0 },
          { x: rBase, y: wall }
        ], sides, { wallThickness: wall, bottomThickness: wall, closedBottom: true, faceted: true });

        const gWalls = this.replaceLatheGeometry([
          { x: rBase, y: wall },
          { x: rBody, y: height * 0.45 },
          { x: rNeck, y: height * 0.82 },
          { x: rNeck * 1.1, y: height }
        ], sides, { wallThickness: wall, closedBottom: false, faceted: true });

        return [
          { partId: 'slab-part-0', geometry: this.applyProceduralClayModifiers(gBase, opts) },
          { partId: 'slab-part-1', geometry: this.applyProceduralClayModifiers(gWalls, opts) }
        ];
      }

      if (pieceKey === 'vaso_bonsai') {
        const wall = opts.wallThickness || 7.0;
        const legH = 12;
        const height = opts.height || 65;
        const gBody = this.replaceLatheGeometry([
          { x: 64, y: legH }, { x: 70, y: legH + 8 }, { x: 75, y: legH + 20 },
          { x: 81, y: legH + 35 }, { x: 85, y: height - 5 }, { x: 83.5, y: height }
        ], 32, { wallThickness: wall, bottomThickness: 8.0, closedBottom: true, faceted: false });
        return [
          { partId: 'slab-part-0', geometry: this.applyProceduralClayModifiers(gBody, opts) }
        ];
      }

      if (pieceKey === 'cachepo_cubico') {
        return [
          { partId: 'slab-part-0', geometry: this.createCachepoCubicoGeometry(opts) }
        ];
      }

      if (pieceKey === 'jardineira_placa') {
        return [
          { partId: 'slab-part-0', geometry: this.createJardineiraPlacaGeometry(opts) }
        ];
      }

      if (pieceKey === 'copo_termico' || pieceKey === 'copo_take_away') {
        const wall = opts.wallThickness || 5.0;
        const height = opts.height || 120;
        const rBase = opts.radiusBase || 30.0;
        const rTop = opts.radiusTop || 42.5;

        const gFundo = this.replaceLatheGeometry([
          { x: 0.5, y: 0 }, { x: rBase, y: 0 }, { x: rBase, y: 6.0 }
        ], 32, { wallThickness: wall, bottomThickness: 6.0, closedBottom: true, faceted: false });

        const gParede = this.replaceLatheGeometry([
          { x: rBase, y: 6.0 }, { x: 32.0, y: 20 }, { x: 34.0, y: 40 },
          { x: 36.0, y: 60 }, { x: 38.0, y: 80 }, { x: 40.5, y: 100 }, { x: rTop, y: height }
        ], 32, { wallThickness: wall, closedBottom: false, faceted: false });

        const shape = new THREE.Shape();
        const angStart = Math.PI * 0.15;
        const angEnd = Math.PI * 0.85;
        const pX1 = rTop * Math.cos(angStart);
        const pZ1 = rTop * Math.sin(angStart);
        shape.moveTo(pX1, pZ1);
        shape.absarc(0, 0, rTop, angStart, angEnd, false);
        shape.lineTo(pX1, pZ1);

        const hole = new THREE.Path();
        hole.ellipse(0, rTop * 0.62, 12.5, 6.0, 0, Math.PI * 2, false);
        shape.holes.push(hole);

        const rawCrescent = new THREE.ExtrudeGeometry(shape, { depth: 5.0, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.8, bevelThickness: 0.8 });
        rawCrescent.rotateX(Math.PI / 2);
        rawCrescent.translate(0, height + 2.5, 0);
        const gCrescent = rawCrescent.index ? rawCrescent.toNonIndexed() : rawCrescent;
        gCrescent.computeVertexNormals();

        return [
          { partId: 'slab-part-0', geometry: this.applyProceduralClayModifiers(gFundo, opts) },
          { partId: 'slab-part-1', geometry: gCrescent },
          { partId: 'slab-part-2', geometry: this.applyProceduralClayModifiers(gParede, opts) }
        ];
      }

      if (pieceKey === 'abajur_conico') {
        const wall = opts.wallThickness || 6.0;
        const height = opts.height || 175;
        const gBase = this.replaceLatheGeometry([
          { x: 0.5, y: 0 }, { x: 49.0, y: 0 }, { x: 49.0, y: 8.0 }
        ], 32, { wallThickness: wall, bottomThickness: 8.0, closedBottom: true, faceted: false });
        const gWall = this.replaceLatheGeometry([
          { x: 49.0, y: 8.0 }, { x: 53.0, y: 50.0 }, { x: 60.0, y: 130.0 }, { x: 65.0, y: 170.0 }, { x: 65.0, y: height }
        ], 32, { wallThickness: wall, closedBottom: false, faceted: false });
        return [
          { partId: 'slab-part-0', geometry: this.applyProceduralClayModifiers(gBase, opts) },
          { partId: 'slab-part-1', geometry: this.applyProceduralClayModifiers(gWall, opts) }
        ];
      }

      if (pieceKey === 'arandela_parede') {
        return [
          { partId: 'slab-part-0', geometry: this.createArandelaParedeGeometry(opts) }
        ];
      }

      if (pieceKey === 'centro_ondulado') {
        return [
          { partId: 'slab-part-0', geometry: this.createCentroOnduladoGeometry(opts) }
        ];
      }

      if (pieceKey === 'porta_velas') {
        return [
          { partId: 'slab-part-0', geometry: this.createPortaVelasGeometry(opts) }
        ];
      }

      if (pieceKey === 'escultura_arco') {
        return [
          { partId: 'slab-part-0', geometry: this.createEsculturaArcoGeometry(opts) }
        ];
      }

      if (pieceKey === 'porta_incenso') {
        return [
          { partId: 'slab-part-0', geometry: this.createPortaIncensoGeometry(opts) }
        ];
      }

      if (pieceKey === 'tool_gauge') {
        return [
          { partId: 'slab-part-0', geometry: this.createToolGaugeGeometry(opts) }
        ];
      }

      if (pieceKey === 'tool_chamfer') {
        return [
          { partId: 'slab-part-0', geometry: this.createToolChamferGeometry(opts) }
        ];
      }

      if (pieceKey === 'tool_caliper') {
        return [
          { partId: 'slab-part-0', geometry: this.createToolCaliperGeometry(opts) }
        ];
      }

      if (pieceKey === 'tool_ruler') {
        return [
          { partId: 'slab-part-0', geometry: this.createToolRulerGeometry(opts) }
        ];
      }

      if (pieceKey === 'bib_costela') {
        return [
          { partId: 'slab-part-0', geometry: this.createBibCostelaGeometry(opts) }
        ];
      }

      if (pieceKey === 'tool_rib_garrity') {
        return [
          { partId: 'slab-part-0', geometry: this.createToolRibGarrityGeometry(opts) }
        ];
      }

      if (pieceKey === 'bib_extrusora') {
        return [
          { partId: 'slab-part-0', geometry: this.createBibExtrusoraGeometry(opts) }
        ];
      }

      return [
        { partId: 'slab-part-0', geometry: this.createSlabPieceGeometry(pieceKey, options) }
      ];
    },

    /**
     * #71. Vaso Cônico para Bonsai com Drenos
     */
    createVasoBonsaiGeometry(options = {}) {
      const wall = options.wallThickness || 7.0;
      const legH = 12;
      const height = options.height || 65;

      const bodyGeo = this.replaceLatheGeometry([
        { x: 64, y: legH }, { x: 70, y: legH + 8 }, { x: 75, y: legH + 20 },
        { x: 81, y: legH + 35 }, { x: 85, y: height - 5 }, { x: 83.5, y: height }
      ], 32, { wallThickness: wall, bottomThickness: 8.0, closedBottom: true, faceted: false });

      const positions = Array.from(bodyGeo.attributes.position.array);
      const normals = Array.from(bodyGeo.attributes.normal.array);
      const uvs = Array.from(bodyGeo.attributes.uv.array);

      const THREE = getTHREE();
      const legR = 54;
      const legW = 16;
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const lx = legR * Math.cos(angle);
        const lz = legR * Math.sin(angle);
        const legGeom = new THREE.BoxGeometry(legW, legH, legW);
        legGeom.translate(lx, legH / 2, lz);
        const lNonIdx = legGeom.index ? legGeom.toNonIndexed() : legGeom;
        positions.push(...Array.from(lNonIdx.attributes.position.array));
        normals.push(...Array.from(lNonIdx.attributes.normal.array));
        uvs.push(...Array.from(lNonIdx.attributes.uv.array));
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    createBibFacetadoGeometry(options = {}) {
      const wall = options.wallThickness || 6.0;
      const height = options.height || 140;
      return this.replaceLatheGeometry([
        { x: 41, y: 0 }, { x: 41, y: 8 }, { x: 48, y: 40 },
        { x: 55, y: 95 }, { x: 55, y: 132 }, { x: 53, y: height }
      ], 8, { wallThickness: wall, bottomThickness: 8.0, closedBottom: true, faceted: true });
    },

    createCachepoCubicoGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 115;
      const W = 100;
      const wall = options.wallThickness || 6.0;

      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, -W / 2);
      shape.lineTo(W / 2, -W / 2);
      shape.lineTo(W / 2, W / 2);
      shape.lineTo(-W / 2, W / 2);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(-W / 2 + wall, -W / 2 + wall);
      hole.lineTo(W / 2 - wall, -W / 2 + wall);
      hole.lineTo(W / 2 - wall, W / 2 - wall);
      hole.lineTo(-W / 2 + wall, W / 2 - wall);
      hole.closePath();
      shape.holes.push(hole);

      const rawWalls = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
      rawWalls.rotateX(-Math.PI / 2);
      const rawBase = new THREE.BoxGeometry(W, wall, W);
      rawBase.translate(0, wall / 2, 0);

      const positions = [];
      const normals = [];
      const uvs = [];

      [rawWalls, rawBase].forEach(g => {
        const nonIdx = g.index ? g.toNonIndexed() : g;
        positions.push(...Array.from(nonIdx.attributes.position.array));
        normals.push(...Array.from(nonIdx.attributes.normal.array));
        uvs.push(...Array.from(nonIdx.attributes.uv.array));
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createJardineiraPlacaGeometry(options = {}) {
      const THREE = getTHREE();
      const L = 240;
      const W = 100;
      const H = options.height || 80;
      const wall = options.wallThickness || 7.0;

      const shape = new THREE.Shape();
      shape.moveTo(-L / 2, -W / 2);
      shape.lineTo(L / 2, -W / 2);
      shape.lineTo(L / 2, W / 2);
      shape.lineTo(-L / 2, W / 2);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(-L / 2 + wall, -W / 2 + wall);
      hole.lineTo(L / 2 - wall, -W / 2 + wall);
      hole.lineTo(L / 2 - wall, W / 2 - wall);
      hole.lineTo(-L / 2 + wall, W / 2 - wall);
      hole.closePath();
      shape.holes.push(hole);

      const rawWalls = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
      rawWalls.rotateX(-Math.PI / 2);
      const rawBase = new THREE.BoxGeometry(L, wall, W);
      rawBase.translate(0, wall / 2, 0);

      const trayL = 255;
      const trayW = 115;
      const trayH = 15;
      const trayShape = new THREE.Shape();
      trayShape.moveTo(-trayL / 2, -trayW / 2);
      trayShape.lineTo(trayL / 2, -trayW / 2);
      trayShape.lineTo(trayL / 2, trayW / 2);
      trayShape.lineTo(-trayL / 2, trayW / 2);
      trayShape.closePath();
      const rawTray = new THREE.ExtrudeGeometry(trayShape, { depth: trayH, bevelEnabled: false });
      rawTray.rotateX(-Math.PI / 2);
      rawTray.translate(0, -trayH, 0);

      const positions = [];
      const normals = [];
      const uvs = [];

      [rawWalls, rawBase, rawTray].forEach(g => {
        const nonIdx = g.index ? g.toNonIndexed() : g;
        positions.push(...Array.from(nonIdx.attributes.position.array));
        normals.push(...Array.from(nonIdx.attributes.normal.array));
        uvs.push(...Array.from(nonIdx.attributes.uv.array));
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createCopoTakeAwayGeometry(options = {}) {
      const THREE = getTHREE();
      const wall = options.wallThickness || 5.0;
      const height = options.height || 120;
      const rBase = options.radiusBase || 30.0;
      const rTop = options.radiusTop || 42.5;

      const bodyGeo = this.replaceLatheGeometry([
        { x: 0.5, y: 0 }, { x: rBase, y: 0 }, { x: rBase, y: 6.0 },
        { x: 32.0, y: 20 }, { x: 34.0, y: 40 }, { x: 36.0, y: 60 },
        { x: 38.0, y: 80 }, { x: 40.5, y: 100 }, { x: rTop, y: height }
      ], 32, { wallThickness: wall, bottomThickness: 6.0, closedBottom: true, faceted: false });

      const positions = Array.from(bodyGeo.attributes.position.array);
      const normals = Array.from(bodyGeo.attributes.normal.array);
      const uvs = Array.from(bodyGeo.attributes.uv.array);

      const shape = new THREE.Shape();
      const angStart = Math.PI * 0.15;
      const angEnd = Math.PI * 0.85;
      const pX1 = rTop * Math.cos(angStart);
      const pZ1 = rTop * Math.sin(angStart);

      shape.moveTo(pX1, pZ1);
      shape.absarc(0, 0, rTop, angStart, angEnd, false);
      shape.lineTo(pX1, pZ1);

      const hole = new THREE.Path();
      hole.ellipse(0, rTop * 0.62, 12.5, 6.0, 0, Math.PI * 2, false);
      shape.holes.push(hole);

      const rawCrescent = new THREE.ExtrudeGeometry(shape, { depth: 5.0, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.8, bevelThickness: 0.8 });
      rawCrescent.rotateX(Math.PI / 2);
      rawCrescent.translate(0, height + 2.5, 0);

      const crescentGeo = rawCrescent.index ? rawCrescent.toNonIndexed() : rawCrescent;
      crescentGeo.computeVertexNormals();

      positions.push(...Array.from(crescentGeo.attributes.position.array));
      normals.push(...Array.from(crescentGeo.attributes.normal.array));
      uvs.push(...Array.from(crescentGeo.attributes.uv ? crescentGeo.attributes.uv.array : new Array((crescentGeo.attributes.position.count) * 2).fill(0)));

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeBoundingBox();
      return geo;
    },

    createAbajurConicoGeometry(options = {}) {
      const wall = options.wallThickness || 6.0;
      const height = options.height || 175;
      const pts = [
        { x: 0.5, y: 0 }, { x: 49.0, y: 0 }, { x: 49.0, y: 8.0 },
        { x: 53.0, y: 50.0 }, { x: 60.0, y: 130.0 }, { x: 65.0, y: 170.0 }, { x: 65.0, y: height }
      ];
      const geo = this.replaceLatheGeometry(pts, 36, { wallThickness: wall, bottomThickness: 8.0, closedBottom: true, faceted: false });
      geo.computeBoundingBox();
      return geo;
    },

    createArandelaParedeGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 150;
      const W = 120;
      const D = 75;
      const wall = options.wallThickness || 6.0;

      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.quadraticCurveTo(0, D * 2, W / 2, 0);
      shape.lineTo(W / 2 - wall, 0);
      shape.quadraticCurveTo(0, (D - wall) * 2, -W / 2 + wall, 0);
      shape.closePath();

      const raw = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.8, bevelThickness: 0.8 });
      raw.rotateX(-Math.PI / 2);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createCentroOnduladoGeometry(options = {}) {
      const wall = options.wallThickness || 6.0;
      const height = options.height || 50;
      const pts = [
        { x: 0.5, y: 0 }, { x: 40.0, y: 0 }, { x: 40.0, y: 8.0 },
        { x: 65.0, y: 20.0 }, { x: 85.0, y: 40.0 }, { x: 90.0, y: height }
      ];
      const geo = this.replaceLatheGeometry(pts, 48, { wallThickness: wall, bottomThickness: 6.0, closedBottom: true, faceted: false });
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const r = Math.hypot(x, z);
        if (r > 65 && y > 15) {
          const angle = Math.atan2(z, x);
          const wave = Math.sin(angle * 5) * 3.5 * ((r - 65) / 25);
          pos.setY(i, y + wave);
        }
      }
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createPortaVelasGeometry(options = {}) {
      const wall = options.wallThickness || 4.5;
      const height = options.height || 90;
      const pts = [
        { x: 0.5, y: 0 }, { x: 42.0, y: 0 }, { x: 42.0, y: 10.0 },
        { x: 42.0, y: 50.0 }, { x: 42.0, y: 85.0 }, { x: 42.0, y: height }
      ];
      const geo = this.replaceLatheGeometry(pts, 32, { wallThickness: wall, bottomThickness: 6.0, closedBottom: true, faceted: false });
      geo.computeBoundingBox();
      return geo;
    },

    createEsculturaArcoGeometry(options = {}) {
      const THREE = getTHREE();
      const rTube = 12.0;
      const H = options.height || 165;
      const curvePoints = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = Math.PI * t;
        const x = -40 * Math.cos(angle);
        const y = rTube + (H - rTube) * Math.sin(angle);
        curvePoints.push(new THREE.Vector3(x, y, 0));
      }
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const raw = new THREE.TubeGeometry(curve, 64, rTube, 24, false);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createPortaIncensoGeometry(options = {}) {
      const THREE = getTHREE();
      const L = 240;
      const W = 50;
      const H = 25;
      const wall = options.wallThickness || 5.5;

      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, H);
      shape.quadraticCurveTo(0, -H, W / 2, H);
      shape.lineTo(W / 2 - wall * 0.5, H);
      shape.quadraticCurveTo(0, -H + wall * 2, -W / 2 + wall * 0.5, H);
      shape.closePath();

      const raw = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.6, bevelThickness: 0.6 });
      raw.rotateY(Math.PI / 2);
      raw.translate(-L / 2, 0, 0);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createToolGaugeGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 180;
      const baseR = 30;
      const baseH = 10;
      const rodH = H - baseH;

      const gBase = new THREE.CylinderGeometry(baseR, baseR, baseH, 32);
      gBase.translate(0, baseH / 2, 0);

      const gRod = new THREE.BoxGeometry(8, rodH, 8);
      gRod.translate(0, baseH + rodH / 2, 0);

      const gArm = new THREE.BoxGeometry(60, 6, 4);
      gArm.translate(30, 120, 0);

      const positions = [];
      const normals = [];
      const uvs = [];

      [gBase, gRod, gArm].forEach(g => {
        const nonIdx = g.index ? g.toNonIndexed() : g;
        positions.push(...Array.from(nonIdx.attributes.position.array));
        normals.push(...Array.from(nonIdx.attributes.normal.array));
        if (nonIdx.attributes.uv) {
          uvs.push(...Array.from(nonIdx.attributes.uv.array));
        } else {
          uvs.push(...new Array((nonIdx.attributes.position.count) * 2).fill(0));
        }
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createToolChamferGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 45;
      const W = 60;
      const L = 80;

      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.lineTo(W / 2, 0);
      shape.lineTo(W / 2, H - 20);
      shape.lineTo(0, H);
      shape.lineTo(-W / 2, H);
      shape.closePath();

      const raw = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.6, bevelThickness: 0.6 });
      raw.rotateY(Math.PI / 2);
      raw.translate(-L / 2, 0, 0);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createToolCaliperGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 10;
      const span = 120;

      const shapeA = new THREE.Shape();
      shapeA.moveTo(-span / 2, -15);
      shapeA.quadraticCurveTo(-20, -25, 0, 0);
      shapeA.quadraticCurveTo(20, 25, span / 2, 15);
      shapeA.lineTo(span / 2 - 4, 18);
      shapeA.quadraticCurveTo(20, 20, 0, -4);
      shapeA.quadraticCurveTo(-20, -20, -span / 2 + 4, -18);
      shapeA.closePath();

      const shapeB = new THREE.Shape();
      shapeB.moveTo(-span / 2, 15);
      shapeB.quadraticCurveTo(-20, 25, 0, 0);
      shapeB.quadraticCurveTo(20, -25, span / 2, -15);
      shapeB.lineTo(span / 2 - 4, -18);
      shapeB.quadraticCurveTo(20, -20, 0, 4);
      shapeB.quadraticCurveTo(-20, 20, -span / 2 + 4, 18);
      shapeB.closePath();

      const extA = new THREE.ExtrudeGeometry(shapeA, { depth: H / 2, bevelEnabled: false });
      const extB = new THREE.ExtrudeGeometry(shapeB, { depth: H / 2, bevelEnabled: false });
      extA.rotateX(-Math.PI / 2);
      extB.rotateX(-Math.PI / 2);
      extB.translate(0, H / 2, 0);

      const positions = [];
      const normals = [];
      const uvs = [];

      [extA, extB].forEach(g => {
        const nonIdx = g.index ? g.toNonIndexed() : g;
        positions.push(...Array.from(nonIdx.attributes.position.array));
        normals.push(...Array.from(nonIdx.attributes.normal.array));
        if (nonIdx.attributes.uv) {
          uvs.push(...Array.from(nonIdx.attributes.uv.array));
        } else {
          uvs.push(...new Array((nonIdx.attributes.position.count) * 2).fill(0));
        }
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createToolRulerGeometry(options = {}) {
      const THREE = getTHREE();
      const L = 170;
      const W = 40;
      const T = 5;

      const raw = new THREE.BoxGeometry(L, T, W);
      raw.translate(0, T / 2, 0);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createBibCostelaGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 110;
      const W = 70;
      const T = 4;

      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.lineTo(W / 2, 0);
      shape.lineTo(W / 2, H * 0.4);
      shape.quadraticCurveTo(W * 0.45, H, 0, H);
      shape.quadraticCurveTo(-W / 2, H * 0.6, -W / 2, 0);
      shape.closePath();

      const raw = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.5, bevelThickness: 0.5 });
      raw.translate(0, 0, -T / 2);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createToolRibGarrityGeometry(options = {}) {
      const THREE = getTHREE();
      const H = options.height || 120;
      const W = 76;
      const T = 5.5;

      const shape = new THREE.Shape();
      shape.moveTo(-W / 2, 0);
      shape.lineTo(W / 2, 0);
      shape.quadraticCurveTo(W / 2, H * 0.4, W * 0.2, H);
      shape.lineTo(-W * 0.2, H);
      shape.quadraticCurveTo(-W / 2, H * 0.5, -W / 2, 0);
      shape.closePath();

      const raw = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 1.2, bevelThickness: 1.2 });
      raw.translate(0, 0, -T / 2);
      const geo = raw.index ? raw.toNonIndexed() : raw;
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    },

    createBibExtrusoraGeometry(options = {}) {
      const THREE = getTHREE();
      const R = 45;
      const T = 10;
      const rHole = 15;
      const rCore = 9;

      const shape = new THREE.Shape();
      shape.absarc(0, 0, R, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, rHole, 0, Math.PI * 2, true);
      shape.holes.push(hole);

      const rawPlate = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
      rawPlate.rotateX(-Math.PI / 2);

      const rawCore = new THREE.CylinderGeometry(rCore, rCore, T, 32);
      rawCore.translate(0, T / 2, 0);

      const spiderArms = [];
      for (let i = 0; i < 3; i++) {
        const ang = (i * 2 * Math.PI) / 3;
        const arm = new THREE.BoxGeometry(3.5, T * 0.8, R);
        arm.rotateY(ang);
        arm.translate(0, T / 2, 0);
        spiderArms.push(arm);
      }

      const positions = [];
      const normals = [];
      const uvs = [];

      [rawPlate, rawCore, ...spiderArms].forEach(g => {
        const nonIdx = g.index ? g.toNonIndexed() : g;
        positions.push(...Array.from(nonIdx.attributes.position.array));
        normals.push(...Array.from(nonIdx.attributes.normal.array));
        if (nonIdx.attributes.uv) {
          uvs.push(...Array.from(nonIdx.attributes.uv.array));
        } else {
          uvs.push(...new Array((nonIdx.attributes.position.count) * 2).fill(0));
        }
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      return geo;
    }
  };

  return { CeramicMeshFactory };
});
