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
    }
  };

  return { CeramicMeshFactory };
});
