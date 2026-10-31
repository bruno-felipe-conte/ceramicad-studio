#!/usr/bin/env node
/**
 * CeramiCAD Studio Pro — Adversarial Verification & Empirical Stress Testing
 * Targets: Station 1 (Vasos 3D) and Station 2 (Cortadores 3D)
 */

const path = require('path');
const fs = require('fs');
const { CDPHarness } = require('./cdp_harness');
const { TestReporter } = require('./reporter');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    httpPort: 8199,
    cdpPort: 9399,
    outputDir: path.join(__dirname, 'results_challenger'),
    keepAlive: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      options.httpPort = parseInt(args[++i], 10);
    } else if (arg === '--cdp-port' && args[i + 1]) {
      options.cdpPort = parseInt(args[++i], 10);
    } else if (arg === '--output-dir' && args[i + 1]) {
      options.outputDir = path.resolve(args[++i]);
    } else if (arg === '--keep-alive') {
      options.keepAlive = true;
    }
  }

  return options;
}

// Deep inspect activeMeshGroup in browser context
async function inspectMeshHealth(cdp) {
  return await cdp.evaluate(`
    (() => {
      if (!scene || !activeMeshGroup) return { exists: false, error: 'scene or activeMeshGroup missing' };
      
      let meshCount = 0;
      let totalVertices = 0;
      let hasNaN = false;
      let hasInfinity = false;
      let nanPositions = [];

      activeMeshGroup.traverse(child => {
        if (child.isMesh && child.geometry) {
          meshCount++;
          const pos = child.geometry.attributes && child.geometry.attributes.position;
          if (pos && pos.array) {
            totalVertices += pos.count;
            const arr = pos.array;
            for (let i = 0; i < arr.length; i++) {
              if (Number.isNaN(arr[i])) {
                hasNaN = true;
                if (nanPositions.length < 5) nanPositions.push(i);
              }
              if (!Number.isFinite(arr[i])) {
                hasInfinity = true;
              }
            }
          }
        }
      });

      const box = new THREE.Box3().setFromObject(activeMeshGroup);
      const isEmpty = box.isEmpty();
      const isFiniteBox = Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) &&
                          Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);

      const size = [
        Math.round((box.max.x - box.min.x) * 100) / 100,
        Math.round((box.max.y - box.min.y) * 100) / 100,
        Math.round((box.max.z - box.min.z) * 100) / 100
      ];

      return {
        exists: true,
        meshCount,
        totalVertices,
        hasNaN,
        hasInfinity,
        nanPositions,
        isEmpty,
        isFiniteBox,
        bounds: {
          min: [box.min.x, box.min.y, box.min.z],
          max: [box.max.x, box.max.y, box.max.z],
          size
        }
      };
    })()
  `);
}

async function runAdversarialStation1(cdp, reporter) {
  console.log('\n================================================================================');
  console.log('   ADVERSARIAL STRESS TESTING: STATION 1 (VASOS 3D)   ');
  console.log('================================================================================\n');

  // Setup Station 1
  await cdp.evaluate(`
    switchTool('vasos');
    switchVaseMode('spline');
    loadClassicProfilePreset('anfora');
  `);
  await new Promise(r => setTimeout(r, 100));

  // -------------------------------------------------------------------------
  // 1. Extreme Spline Dimensions & Thickness Guards
  // -------------------------------------------------------------------------
  const splineExtremeTests = [
    { name: 'Altura Tiny (1 mm)', set: `document.getElementById('v-total-height').value = 1; rebuildVase();` },
    { name: 'Altura Huge (2500 mm)', set: `document.getElementById('v-total-height').value = 2500; rebuildVase();` },
    { name: 'Altura Zero (0 mm Guard)', set: `document.getElementById('v-total-height').value = 0; rebuildVase();` },
    { name: 'Altura Negativa (-50 mm Guard)', set: `document.getElementById('v-total-height').value = -50; rebuildVase();` },
    { name: 'Raio Tiny (1 mm)', set: `document.getElementById('v-max-radius').value = 1; rebuildVase();` },
    { name: 'Raio Huge (1500 mm)', set: `document.getElementById('v-max-radius').value = 1500; rebuildVase();` },
    { name: 'Raio Zero (0 mm Guard)', set: `document.getElementById('v-max-radius').value = 0; rebuildVase();` },
    { name: 'Espessura Zero Parede (0 mm Guard)', set: `document.getElementById('v-spline-wall').value = 0; rebuildVase();` },
    { name: 'Espessura Sub-milimétrica Parede (0.001 mm Guard)', set: `document.getElementById('v-spline-wall').value = 0.001; rebuildVase();` },
    { name: 'Espessura Negativa Parede (-5 mm Guard)', set: `document.getElementById('v-spline-wall').value = -5; rebuildVase();` },
    { name: 'Espessura Parede Gigante (80 mm)', set: `document.getElementById('v-spline-wall').value = 80; rebuildVase();` }
  ];

  for (const t of splineExtremeTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(t.set);
      await new Promise(r => setTimeout(r, 60));
      const health = await inspectMeshHealth(cdp);

      const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox;
      reporter.record({
        id: `adv_s1_spline_dim_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Spline Dimensions & Thickness Guards',
        item: t.name,
        expected: 'Valid 3D geometry without NaN or infinite bounds despite extreme input',
        actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], NaN: ${health.hasNaN}, Finite: ${health.isFiniteBox}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: health
      });
    } catch (err) {
      reporter.record({
        id: `adv_s1_spline_dim_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Spline Dimensions & Thickness Guards',
        item: t.name,
        expected: 'Valid 3D geometry without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore normal dimensions
  await cdp.evaluate(`
    document.getElementById('v-total-height').value = 165;
    document.getElementById('v-max-radius').value = 65;
    document.getElementById('v-spline-wall').value = 5.5;
    rebuildVase();
  `);

  // -------------------------------------------------------------------------
  // 2. Extreme Morphology, Twist & Cross-Section Lobes
  // -------------------------------------------------------------------------
  const morphStressTests = [
    { name: 'Torção Helicoidal Extrema (+720°)', set: `document.getElementById('v-twist-angle').value = 720; rebuildVase();` },
    { name: 'Torção Helicoidal Extrema (-720°)', set: `document.getElementById('v-twist-angle').value = -720; rebuildVase();` },
    { name: 'Torção Helicoidal Gigante (3600°)', set: `document.getElementById('v-twist-angle').value = 3600; rebuildVase();` },
    { name: 'Tensão de Spline Extrema (0%)', set: `document.getElementById('v-spline-tension').value = 0; rebuildVase();` },
    { name: 'Tensão de Spline Extrema (100%)', set: `document.getElementById('v-spline-tension').value = 100; rebuildVase();` },
    { name: 'Pétalas com Qtd 1 (Limite Inferior)', set: `document.getElementById('v-cross-shape').value = 'petals'; document.getElementById('v-cross-count').value = 1; rebuildVase();` },
    { name: 'Pétalas com Qtd 64 (Alta Frequência)', set: `document.getElementById('v-cross-shape').value = 'petals'; document.getElementById('v-cross-count').value = 64; rebuildVase();` },
    { name: 'Polígono com 3 lados (Triângulo)', set: `document.getElementById('v-cross-shape').value = 'polygon'; document.getElementById('v-cross-count').value = 3; rebuildVase();` },
    { name: 'Polígono com 64 lados', set: `document.getElementById('v-cross-shape').value = 'polygon'; document.getElementById('v-cross-count').value = 64; rebuildVase();` },
    { name: 'Profundidade Lobular Negativa (-10 mm)', set: `document.getElementById('v-cross-depth').value = -10; rebuildVase();` },
    { name: 'Profundidade Lobular Excessiva (40 mm)', set: `document.getElementById('v-cross-depth').value = 40; rebuildVase();` },
    { name: 'Lofting Hermite: Tri-Poligonal (polygon->polygon->polygon)', set: `document.getElementById('v-loft-base').value = 'polygon'; document.getElementById('v-loft-mid').value = 'polygon'; document.getElementById('v-loft-top').value = 'polygon'; rebuildVase();` },
    { name: 'Lofting Hermite: Pétalas para Polígono (petals->circle->polygon)', set: `document.getElementById('v-loft-base').value = 'petals'; document.getElementById('v-loft-mid').value = 'circle'; document.getElementById('v-loft-top').value = 'polygon'; rebuildVase();` }
  ];

  for (const t of morphStressTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(t.set);
      await new Promise(r => setTimeout(r, 60));
      const health = await inspectMeshHealth(cdp);

      const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox;
      reporter.record({
        id: `adv_s1_morph_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Morphology, Twist & Lofting Stress',
        item: t.name,
        expected: 'Valid deformed 3D mesh with zero NaN vertices',
        actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], NaN: ${health.hasNaN}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: health
      });
    } catch (err) {
      reporter.record({
        id: `adv_s1_morph_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Morphology, Twist & Lofting Stress',
        item: t.name,
        expected: 'Valid 3D geometry without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore normal morphology
  await cdp.evaluate(`
    document.getElementById('v-cross-shape').value = 'circle';
    document.getElementById('v-loft-base').value = 'circle';
    document.getElementById('v-loft-mid').value = 'circle';
    document.getElementById('v-loft-top').value = 'circle';
    document.getElementById('v-twist-angle').value = 0;
    document.getElementById('v-cross-depth').value = 3.5;
    rebuildVase();
  `);

  // -------------------------------------------------------------------------
  // 3. Drainage Hole & Base Fillet Overlap / Collision Stress
  // -------------------------------------------------------------------------
  const holeFilletTests = [
    { name: 'Furo Central Ø0 mm (Desativado)', set: `document.getElementById('v-drainage-hole').value = 0; rebuildVase();` },
    { name: 'Furo Central Ø50 mm (Padrão Largo)', set: `document.getElementById('v-drainage-hole').value = 50; rebuildVase();` },
    { name: 'Furo Central Ø180 mm (Maior que o Raio da Base)', set: `document.getElementById('v-drainage-hole').value = 180; rebuildVase();` },
    { name: 'Filete Base 0 mm', set: `document.getElementById('v-base-fillet').value = 0; rebuildVase();` },
    { name: 'Filete Base 15 mm', set: `document.getElementById('v-base-fillet').value = 15; rebuildVase();` },
    { name: 'Filete Base 120 mm (Maior que Altura)', set: `document.getElementById('v-base-fillet').value = 120; rebuildVase();` },
    { name: 'Corte 270° Ativo com Furo Ø40 e Filete 10mm', set: `document.getElementById('v-section-cut').checked = true; document.getElementById('v-drainage-hole').value = 40; document.getElementById('v-base-fillet').value = 10; rebuildVase();` },
    { name: 'Corte 270° Desativado (360° Sólido)', set: `document.getElementById('v-section-cut').checked = false; rebuildVase();` }
  ];

  for (const t of holeFilletTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(t.set);
      await new Promise(r => setTimeout(r, 60));
      const health = await inspectMeshHealth(cdp);

      const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox;
      reporter.record({
        id: `adv_s1_hole_fillet_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Drainage & Fillet Overlap Stress',
        item: t.name,
        expected: 'Valid bounded mesh without degeneracies or NaNs',
        actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], NaN: ${health.hasNaN}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: health
      });
    } catch (err) {
      reporter.record({
        id: `adv_s1_hole_fillet_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Drainage & Fillet Overlap Stress',
        item: t.name,
        expected: 'Valid 3D geometry without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore defaults
  await cdp.evaluate(`
    document.getElementById('v-drainage-hole').value = 0;
    document.getElementById('v-base-fillet').value = 0;
    document.getElementById('v-section-cut').checked = false;
    rebuildVase();
  `);

  // -------------------------------------------------------------------------
  // 4. Rapid Preset Switching & Mode Toggling Stress
  // -------------------------------------------------------------------------
  console.log('[Adversarial S1] Executing Rapid Preset & Mode Switching...');
  const tRapid0 = Date.now();
  const rapidResult = await cdp.evaluate(`
    (() => {
      const presets = ['xicara_cafe', 'cuia_chimarrao', 'chaleira_bule', 'panela_barro', 'anfora', 'krater', 'moonjar', 'albarello', 'bocal_extrusora', 'bib_morcego'];
      const errors = [];
      for (let i = 0; i < presets.length; i++) {
        try {
          loadClassicProfilePreset(presets[i]);
        } catch (e) {
          errors.push({ preset: presets[i], error: e.message });
        }
      }
      // Rapid toggle between spline and estagios
      for (let j = 0; j < 8; j++) {
        try {
          switchVaseMode(j % 2 === 0 ? 'estagios' : 'spline');
        } catch (e) {
          errors.push({ toggle: j, error: e.message });
        }
      }
      // Back to vasos spline
      switchTool('vasos');
      switchVaseMode('spline');
      loadClassicProfilePreset('anfora');
      return { errors, finalActiveTool: activeTool, finalMode: vaseDesignMode };
    })()
  `);
  await new Promise(r => setTimeout(r, 120));
  const rapidHealth = await inspectMeshHealth(cdp);

  const rapidPass = rapidResult.errors.length === 0 && rapidHealth.meshCount > 0 && !rapidHealth.hasNaN;
  reporter.record({
    id: 'adv_s1_rapid_switching',
    station: 1,
    subsystem: 'Rapid Preset & Mode Switching',
    item: '10 Presets Rápidos + 8 Alternâncias Spline/Estágios em <150ms',
    expected: '0 exceptions and valid activeMeshGroup remaining in vasos mode',
    actual: `Errors: ${rapidResult.errors.length}, FinalMode: ${rapidResult.finalMode}, Meshes: ${rapidHealth.meshCount}, Verts: ${rapidHealth.totalVertices.toLocaleString()}`,
    status: rapidPass ? 'PASS' : 'FAIL',
    durationMs: Date.now() - tRapid0,
    details: { rapidResult, rapidHealth }
  });

  // -------------------------------------------------------------------------
  // 5. Complex Connected Slabs Combinations & Planification
  // -------------------------------------------------------------------------
  await cdp.evaluate(`
    switchTool('vasos');
    switchVaseMode('estagios');
  `);
  await new Promise(r => setTimeout(r, 60));

  const slabAdversarialCases = [
    {
      name: 'Espessura Slabs Zero (0 mm Guard)',
      fn: `
        document.getElementById('v-espessura').value = 0;
        rebuildVase();
      `
    },
    {
      name: 'Espessura Slabs Negativa (-5 mm Guard)',
      fn: `
        document.getElementById('v-espessura').value = -5;
        rebuildVase();
      `
    },
    {
      name: 'Espessura Slabs Excessiva (80 mm)',
      fn: `
        document.getElementById('v-espessura').value = 80;
        rebuildVase();
      `
    },
    {
      name: 'Estágio Único: Somente 1 Tronco de Cone',
      fn: `
        document.getElementById('v-espessura').value = 6.0;
        vaseStages = [{ tipo: 'cone', rBase: 40, rTopo: 80, altura: 90 }];
        enforceStageContinuity();
        renderVaseStagesUI();
        rebuildVase();
      `
    },
    {
      name: 'Estágio com Altura Zero (h=0 Guard)',
      fn: `
        vaseStages = [
          { tipo: 'cilindro', rBase: 50, rTopo: 50, altura: 0 },
          { tipo: 'cone', rBase: 50, rTopo: 70, altura: 80 }
        ];
        enforceStageContinuity();
        renderVaseStagesUI();
        rebuildVase();
      `
    },
    {
      name: 'Estágio com Raio Base Zero (rBase=0)',
      fn: `
        vaseStages = [
          { tipo: 'cone', rBase: 0, rTopo: 60, altura: 70 },
          { tipo: 'cilindro', rBase: 60, rTopo: 60, altura: 50 }
        ];
        enforceStageContinuity();
        renderVaseStagesUI();
        rebuildVase();
      `
    },
    {
      name: '20 Estágios Consecutivos Alternados',
      fn: `
        vaseStages = [];
        let curR = 30;
        for (let i = 0; i < 20; i++) {
          const nextR = 30 + (i % 5) * 12;
          vaseStages.push({ tipo: i % 2 === 0 ? 'cilindro' : 'cone', rBase: curR, rTopo: nextR, altura: 15 });
          curR = nextR;
        }
        enforceStageContinuity();
        renderVaseStagesUI();
        rebuildVase();
      `
    },
    {
      name: 'Multi-Acessórios: 2 Alças + 2 Bicos + Tampa + Borda/Pé + Disco Crivo',
      fn: `
        loadSlabConnectedRecipe('chaleira_completa');
        addVaseStage('alca');
        addVaseStage('bico');
        addVaseStage('tampa');
        addVaseStage('borda');
        if (!vaseStages.some(st => st.tipo === 'disco')) addVaseStage('disco');
        const d = vaseStages.find(st => st.tipo === 'disco');
        if (d) {
          d.corteTipo = 'crivo_multiplo';
          d.furoQtd = 16;
          d.furoDiam = 10;
        }
        renderVaseStagesUI();
        rebuildVase();
      `
    },
    {
      name: 'Disco de Fundo com Setor Vazado Extremo (180°)',
      fn: `
        if (!vaseStages.some(st => st.tipo === 'disco')) addVaseStage('disco');
        const d = vaseStages.find(st => st.tipo === 'disco');
        if (d) {
          d.corteTipo = 'setor_vazado';
          d.setorAng = 180;
        }
        renderVaseStagesUI();
        rebuildVase();
      `
    },
    {
      name: 'Disco de Fundo com Entalhes de Borda (12 Entalhes)',
      fn: `
        if (!vaseStages.some(st => st.tipo === 'disco')) addVaseStage('disco');
        const d = vaseStages.find(st => st.tipo === 'disco');
        if (d) {
          d.corteTipo = 'entalhes_borda';
          d.furoQtd = 12;
          d.furoDiam = 14;
        }
        renderVaseStagesUI();
        rebuildVase();
      `
    }
  ];

  for (const t of slabAdversarialCases) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`(() => { ${t.fn} })()`);
      await new Promise(r => setTimeout(r, 70));
      const health = await inspectMeshHealth(cdp);

      // Also verify 2D pattern items computation
      const patternItems = await cdp.evaluate(`
        (() => {
          const rings = computeFrustumRings();
          const items = prepareAllVasePatternItems(rings);
          let hasNaN = false;
          items.forEach(it => {
            if (Number.isNaN(it.outerArcMm) || Number.isNaN(it.slantMm) || Number.isNaN(it.angleDeg)) hasNaN = true;
            if (it.rawPoints) {
              it.rawPoints.forEach(p => {
                if (Number.isNaN(p.x) || Number.isNaN(p.y)) hasNaN = true;
              });
            }
          });
          return { count: items.length, hasNaN };
        })()
      `);

      const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox && patternItems.count > 0 && !patternItems.hasNaN;
      reporter.record({
        id: `adv_s1_slab_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Complex Connected Slabs Combinations',
        item: t.name,
        expected: 'Valid 3D mesh, finite bounds, zero vertex NaN, and valid 2D pattern unrolling',
        actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], 2D Items: ${patternItems.count}, 2D NaN: ${patternItems.hasNaN}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: { health, patternItems }
      });
    } catch (err) {
      reporter.record({
        id: `adv_s1_slab_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 1,
        subsystem: 'Complex Connected Slabs Combinations',
        item: t.name,
        expected: 'Valid 3D geometry and 2D patterns without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // -------------------------------------------------------------------------
  // 6. PDF A4 Nesting & 360° STL Export Under Stress
  // -------------------------------------------------------------------------
  const exportStress = await cdp.evaluate(`
    (() => {
      let pdfOk = false;
      let stlBytes = 0;
      let error = null;

      try {
        // PDF Export
        if (typeof exportVase2DPatternsPDF === 'function') {
          exportVase2DPatternsPDF();
          pdfOk = true;
        }

        // STL 360 Export with Section Cut active
        document.getElementById('v-section-cut').checked = true;
        rebuildVase();

        const exporter = new THREE.STLExporter();
        const stl = exporter.parse(activeMeshGroup, { binary: true });
        stlBytes = stl.byteLength || (stl.buffer ? stl.buffer.byteLength : 0);
      } catch (e) {
        error = e.message;
      }

      return { pdfOk, stlBytes, error };
    })()
  `);

  reporter.record({
    id: 'adv_s1_stress_exports',
    station: 1,
    subsystem: 'Stress Exports (PDF A4 & STL 360°)',
    item: 'Geração de PDF A4 Complexo e Exportação STL Binário com Corte 270° Ativo',
    expected: 'PDF generation succeeds and binary STL byteLength > 50,000 bytes',
    actual: `PDF: ${exportStress.pdfOk}, STL Bytes: ${exportStress.stlBytes.toLocaleString()}, Error: ${exportStress.error || 'none'}`,
    status: exportStress.pdfOk && exportStress.stlBytes > 50000 ? 'PASS' : 'FAIL',
    details: exportStress
  });
}

async function runAdversarialStation2(cdp, reporter) {
  console.log('\n================================================================================');
  console.log('   ADVERSARIAL STRESS TESTING: STATION 2 (CORTADORES & EJETORES 3D)   ');
  console.log('================================================================================\n');

  // Setup Station 2
  await cdp.evaluate(`
    switchTool('cortadores');
  `);
  await new Promise(r => setTimeout(r, 80));

  // -------------------------------------------------------------------------
  // 1. Edge Case Settings Across All 4 Construction Modes
  // -------------------------------------------------------------------------
  const modes = ['kit_3_pecas', 'cortador_estampa', 'cortador_simples', 'carimbo_placa'];
  const presetsToTest = ['morcego', 'gato', 'marajoara', 'borboleta'];

  for (const mode of modes) {
    for (const preset of presetsToTest) {
      const t0 = Date.now();
      try {
        await cdp.evaluate(`
          document.getElementById('c-native-mode').value = '${mode}';
          document.getElementById('c-preset-shape').value = '${preset}';
          rebuildNativeCutter3D();
        `);
        await new Promise(r => setTimeout(r, 60));
        const health = await inspectMeshHealth(cdp);

        const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox;
        reporter.record({
          id: `adv_s2_mode_${mode}_preset_${preset}`,
          station: 2,
          subsystem: `Construction Mode: ${mode}`,
          item: `Preset: ${preset}`,
          expected: 'Generates valid 3D cutter mesh without NaN or empty bounds',
          actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], NaN: ${health.hasNaN}`,
          status: pass ? 'PASS' : 'FAIL',
          durationMs: Date.now() - t0,
          details: health
        });
      } catch (err) {
        reporter.record({
          id: `adv_s2_mode_${mode}_preset_${preset}`,
          station: 2,
          subsystem: `Construction Mode: ${mode}`,
          item: `Preset: ${preset}`,
          expected: 'Valid 3D geometry without exception',
          actual: `Exception: ${err.message}`,
          status: 'FAIL',
          durationMs: Date.now() - t0
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Extreme Dimensions, Tiny Relief & Huge Retraction
  // -------------------------------------------------------------------------
  const dimensionStressTests = [
    { name: 'Largura Tiny (1 mm)', set: `document.getElementById('c-largura').value = 1; rebuildNativeCutter3D();` },
    { name: 'Largura Huge (500 mm)', set: `document.getElementById('c-largura').value = 500; rebuildNativeCutter3D();` },
    { name: 'Largura Zero (0 mm Guard)', set: `document.getElementById('c-largura').value = 0; rebuildNativeCutter3D();` },
    { name: 'Largura Negativa (-50 mm Guard)', set: `document.getElementById('c-largura').value = -50; rebuildNativeCutter3D();` },
    { name: 'Retração Argila Mínima (0.1)', set: `document.getElementById('c-retracao').value = 0.1; rebuildNativeCutter3D();` },
    { name: 'Retração Argila Enorme (2.5)', set: `document.getElementById('c-retracao').value = 2.5; rebuildNativeCutter3D();` },
    { name: 'Relevo Sub-milimétrico (0.01 mm)', set: `document.getElementById('c-relevo-h').value = 0.01; rebuildNativeCutter3D();` },
    { name: 'Relevo Zero (0 mm Guard)', set: `document.getElementById('c-relevo-h').value = 0; rebuildNativeCutter3D();` },
    { name: 'Relevo Alto (15 mm)', set: `document.getElementById('c-relevo-h').value = 15; rebuildNativeCutter3D();` },
    { name: 'Relevo Negativo (-2 mm)', set: `document.getElementById('c-relevo-h').value = -2; rebuildNativeCutter3D();` }
  ];

  for (const t of dimensionStressTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(t.set);
      await new Promise(r => setTimeout(r, 60));
      const health = await inspectMeshHealth(cdp);

      const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox;
      reporter.record({
        id: `adv_s2_dim_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 2,
        subsystem: 'Dimensions, Relief & Retraction Stress',
        item: t.name,
        expected: 'Valid 3D geometry without NaN or infinite bounds',
        actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], NaN: ${health.hasNaN}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: health
      });
    } catch (err) {
      reporter.record({
        id: `adv_s2_dim_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 2,
        subsystem: 'Dimensions, Relief & Retraction Stress',
        item: t.name,
        expected: 'Valid 3D geometry without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore cutter standard dimensions
  await cdp.evaluate(`
    document.getElementById('c-largura').value = 95;
    document.getElementById('c-retracao').value = 1.12;
    document.getElementById('c-relevo-h').value = 2.2;
    rebuildNativeCutter3D();
  `);

  // -------------------------------------------------------------------------
  // 3. Draft Angle Boundaries & Spring Types Stress
  // -------------------------------------------------------------------------
  const angleSpringTests = [
    { name: 'Ângulo Desmolde: 0.0° (Reto / Sem Conicidade)', set: `document.getElementById('c-draft-angle').value = '0.0'; rebuildNativeCutter3D();` },
    { name: 'Ângulo Desmolde: 5.0° (Conicidade Acentuada)', set: `document.getElementById('c-draft-angle').value = '5.0'; rebuildNativeCutter3D();` },
    { name: 'Ângulo Desmolde: 15.0° (Extremo)', set: `document.getElementById('c-draft-angle').value = '15.0'; rebuildNativeCutter3D();` },
    { name: 'Ângulo Desmolde Negativo: -2.0° (Contra-Saída)', set: `document.getElementById('c-draft-angle').value = '-2.0'; rebuildNativeCutter3D();` },
    { name: 'Mola: flex_pla (Molde Espiral PLA)', set: `document.getElementById('c-spring-type').value = 'flex_pla'; rebuildNativeCutter3D();` },
    { name: 'Mola: mola_inox (Mola Metálica Cilíndrica)', set: `document.getElementById('c-spring-type').value = 'mola_inox'; rebuildNativeCutter3D();` },
    { name: 'Mola: gravidade (Sem Mola)', set: `document.getElementById('c-spring-type').value = 'gravidade'; rebuildNativeCutter3D();` },
    { name: 'Mola: tipo desconhecido / fallback', set: `document.getElementById('c-spring-type').value = 'desconhecido'; rebuildNativeCutter3D();` }
  ];

  for (const t of angleSpringTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(t.set);
      await new Promise(r => setTimeout(r, 60));
      const health = await inspectMeshHealth(cdp);

      const pass = health.meshCount > 0 && health.totalVertices > 0 && !health.hasNaN && !health.hasInfinity && health.isFiniteBox;
      reporter.record({
        id: `adv_s2_spring_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 2,
        subsystem: 'Draft Angle & Spring Type Boundaries',
        item: t.name,
        expected: 'Valid 3D geometry with correct spring geometry or graceful fallback',
        actual: `Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, Bounds: [${health.bounds.size.join(' x ')} mm], NaN: ${health.hasNaN}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: health
      });
    } catch (err) {
      reporter.record({
        id: `adv_s2_spring_${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 2,
        subsystem: 'Draft Angle & Spring Type Boundaries',
        item: t.name,
        expected: 'Valid 3D geometry without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Individual Part Downloads Across All 4 Construction Modes
  // -------------------------------------------------------------------------
  const downloadTests = [
    { mode: 'kit_3_pecas', part: 'matriz' },
    { mode: 'kit_3_pecas', part: 'embolo' },
    { mode: 'kit_3_pecas', part: 'botao' },
    { mode: 'cortador_simples', part: 'matriz' },
    { mode: 'cortador_simples', part: 'embolo' }, // Fallback test
    { mode: 'carimbo_placa', part: 'carimbo' },
    { mode: 'cortador_estampa', part: 'cortador_estampa' }
  ];

  for (const dt of downloadTests) {
    const t0 = Date.now();
    try {
      const res = await cdp.evaluate(`
        (() => {
          document.getElementById('c-native-mode').value = '${dt.mode}';
          document.getElementById('c-preset-shape').value = 'folha';
          rebuildNativeCutter3D();
          let downloaded = false;
          let filename = null;
          const origDownloadBlob = window.downloadBlob;
          window.downloadBlob = (blob, name) => {
            downloaded = true;
            filename = name;
          };
          downloadCutterPartSTL('${dt.part}');
          window.downloadBlob = origDownloadBlob;
          return { downloaded, filename };
        })()
      `);

      reporter.record({
        id: `adv_s2_dl_${dt.mode}_${dt.part}`,
        station: 2,
        subsystem: 'Part STL Export Robustness',
        item: `Mode: ${dt.mode} | Part: ${dt.part}`,
        expected: 'Triggers STL blob generation and download without exception',
        actual: `Downloaded: ${res.downloaded}, Filename: ${res.filename}`,
        status: res.downloaded ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `adv_s2_dl_${dt.mode}_${dt.part}`,
        station: 2,
        subsystem: 'Part STL Export Robustness',
        item: `Mode: ${dt.mode} | Part: ${dt.part}`,
        expected: 'STL download without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. Live STL ASCII Preview Stress
  // -------------------------------------------------------------------------
  const previewTests = [
    {
      name: 'STL ASCII Vazio',
      input: '',
      expectedPass: false // Should handle gracefully
    },
    {
      name: 'STL ASCII Válido (Triângulo)',
      input: 'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid triangle',
      expectedPass: true
    },
    {
      name: 'STL ASCII Malformado / Truncado',
      input: 'solid broken\nfacet normal 0 0 1\nouter loop\nvertex 0 0\nendloop\n',
      expectedPass: false
    },
    {
      name: 'Texto Aleatório / Lixo Binário',
      input: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. \x00\x01\x02',
      expectedPass: false
    }
  ];

  for (const pt of previewTests) {
    const t0 = Date.now();
    try {
      const res = await cdp.evaluate(`
        (() => {
          let ok = false;
          let error = null;
          try {
            previewRawStlCode(${JSON.stringify(pt.input)});
            ok = true;
          } catch (e) {
            error = e.message;
          }
          return { ok, error };
        })()
      `);

      reporter.record({
        id: `adv_s2_preview_${pt.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 2,
        subsystem: 'Live STL Preview Robustness',
        item: pt.name,
        expected: 'Handles input without uncaught unhandled crash',
        actual: `Executed: ${res.ok}, Catch: ${res.error || 'none'}`,
        status: res.ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `adv_s2_preview_${pt.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        station: 2,
        subsystem: 'Live STL Preview Robustness',
        item: pt.name,
        expected: 'Graceful handling',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }
}

async function main() {
  const options = parseArgs();
  console.log('================================================================================');
  console.log('   CERAMICAD STUDIO PRO — EMPIRICAL ADVERSARIAL STRESS TEST HARNESS   ');
  console.log('================================================================================');
  console.log(`Config: HTTP Port ${options.httpPort} | CDP Port ${options.cdpPort}`);
  console.log(`Output Directory: ${options.outputDir}\n`);

  const cdp = new CDPHarness({
    httpPort: options.httpPort,
    cdpPort: options.cdpPort,
    workDir: path.resolve(__dirname, '..')
  });

  const reporter = new TestReporter();

  let cleanedUp = false;
  async function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!options.keepAlive) {
      console.log('\n[Main] Terminating background processes...');
      await cdp.close();
    }
  }

  process.on('SIGINT', async () => {
    console.log('\n[Main] Interrupted (SIGINT)');
    await cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', async () => {
    console.log('\n[Main] Terminated (SIGTERM)');
    await cleanup();
    process.exit(143);
  });

  try {
    await cdp.init();

    await runAdversarialStation1(cdp, reporter);
    await runAdversarialStation2(cdp, reporter);

    reporter.recordConsoleLogs(cdp.consoleLogs, cdp.consoleErrors);

    console.log('\n================================================================================');
    console.log('                    SAVING ADVERSARIAL TEST RESULTS                             ');
    console.log('================================================================================');
    const outputs = reporter.saveOutputs(options.outputDir);

    const summary = outputs.summary;
    console.log('\n================================================================================');
    console.log(`ADVERSARIAL STRESS SUITE COMPLETED in ${summary.durationSeconds}s`);
    console.log(`Total Stress Tests: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Pass Rate: ${summary.passRate}`);
    console.log(`Console Errors/Exceptions Logged: ${summary.consoleErrorsCount}`);
    console.log('================================================================================\n');

    for (const [st, stats] of Object.entries(summary.byStation)) {
      if (stats.total > 0) {
        console.log(`  - ${st}: ${stats.passed}/${stats.total} passed (${stats.failed} failures)`);
      }
    }
    console.log('================================================================================\n');

  } catch (err) {
    console.error('\n[FATAL ERROR in Adversarial Runner]:', err);
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('[Unhandled]', err);
  process.exit(1);
});
