#!/usr/bin/env node
/**
 * CeramiCAD Studio Pro — Adversarial Deep-Dive Stress Harness
 * Stress-testing Spline-to-Slabs conversions, all 48 Cutter STL permutations, and canvas image SDF.
 */

const path = require('path');
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
    if (arg === '--port' && args[i + 1]) options.httpPort = parseInt(args[++i], 10);
    else if (arg === '--cdp-port' && args[i + 1]) options.cdpPort = parseInt(args[++i], 10);
    else if (arg === '--output-dir' && args[i + 1]) options.outputDir = path.resolve(args[++i]);
    else if (arg === '--keep-alive') options.keepAlive = true;
  }
  return options;
}

async function inspectMeshHealth(cdp) {
  return await cdp.evaluate(`
    (() => {
      if (!scene || !activeMeshGroup) return { exists: false, error: 'scene or activeMeshGroup missing' };
      let meshCount = 0;
      let totalVertices = 0;
      let hasNaN = false;
      let hasInfinity = false;

      activeMeshGroup.traverse(child => {
        if (child.isMesh && child.geometry) {
          meshCount++;
          const pos = child.geometry.attributes && child.geometry.attributes.position;
          if (pos && pos.array) {
            totalVertices += pos.count;
            const arr = pos.array;
            for (let i = 0; i < arr.length; i++) {
              if (Number.isNaN(arr[i])) hasNaN = true;
              if (!Number.isFinite(arr[i])) hasInfinity = true;
            }
          }
        }
      });

      const box = new THREE.Box3().setFromObject(activeMeshGroup);
      const isFiniteBox = Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) &&
                          Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z);

      return {
        exists: true,
        meshCount,
        totalVertices,
        hasNaN,
        hasInfinity,
        isFiniteBox,
        bounds: {
          size: [
            Math.round((box.max.x - box.min.x) * 100) / 100,
            Math.round((box.max.y - box.min.y) * 100) / 100,
            Math.round((box.max.z - box.min.z) * 100) / 100
          ]
        }
      };
    })()
  `);
}

async function main() {
  const options = parseArgs();
  console.log('================================================================================');
  console.log('   CERAMICAD STUDIO PRO — ADVERSARIAL DEEP-DIVE PROBE (STATIONS 1 & 2)   ');
  console.log('================================================================================\n');

  const cdp = new CDPHarness({
    httpPort: options.httpPort,
    cdpPort: options.cdpPort,
    workDir: path.resolve(__dirname, '..')
  });

  const reporter = new TestReporter();

  try {
    await cdp.init();

    // =========================================================================
    // PART A: Station 1 — Spline-to-Slabs Conversion with Attachments
    // =========================================================================
    console.log('--- TESTING SPLINE-TO-SLABS CONVERSION ACROSS UTILITY PROFILES ---');
    const utilityProfiles = [
      'xicara_cafe', 'cuia_chimarrao', 'chaleira_bule', 'bule_cafe_alto',
      'panela_barro', 'cacarola_cocotte', 'sopeira_bojo', 'jarra_leiteira',
      'chawan_kodai', 'acucareiro_mesa'
    ];

    for (const prof of utilityProfiles) {
      const t0 = Date.now();
      try {
        const res = await cdp.evaluate(`
          (() => {
            switchTool('vasos');
            switchVaseMode('spline');
            loadClassicProfilePreset('${prof}');
            convertSplineToSlabStages();
            const rings = computeFrustumRings();
            const patterns = prepareAllVasePatternItems(rings);
            let hasNaN = false;
            patterns.forEach(p => {
              if (Number.isNaN(p.outerArcMm) || Number.isNaN(p.slantMm)) hasNaN = true;
            });
            return {
              mode: vaseDesignMode,
              stagesCount: vaseStages.length,
              patternsCount: patterns.length,
              patternsHasNaN: hasNaN
            };
          })()
        `);
        await new Promise(r => setTimeout(r, 60));
        const health = await inspectMeshHealth(cdp);

        const pass = res.mode === 'estagios' && res.stagesCount >= 5 && res.patternsCount > 0 && !res.patternsHasNaN && health.meshCount > 0 && !health.hasNaN && health.isFiniteBox;
        reporter.record({
          id: `adv_s1_conv_${prof}`,
          station: 1,
          subsystem: 'Spline-to-Slabs Conversion & Planification',
          item: `Profile: ${prof}`,
          expected: 'Auto-converts spline + attachments to valid slab stages and 2D unrolling items without NaN',
          actual: `Stages: ${res.stagesCount}, Patterns: ${res.patternsCount}, Meshes: ${health.meshCount}, Verts: ${health.totalVertices.toLocaleString()}, NaN: ${health.hasNaN}`,
          status: pass ? 'PASS' : 'FAIL',
          durationMs: Date.now() - t0,
          details: { res, health }
        });
      } catch (err) {
        reporter.record({
          id: `adv_s1_conv_${prof}`,
          station: 1,
          subsystem: 'Spline-to-Slabs Conversion & Planification',
          item: `Profile: ${prof}`,
          expected: 'Valid conversion without exception',
          actual: `Exception: ${err.message}`,
          status: 'FAIL',
          durationMs: Date.now() - t0
        });
      }
    }

    // =========================================================================
    // PART B: Station 2 — Complete Matrix: 12 Presets x 4 Modes STL Exports
    // =========================================================================
    console.log('\n--- TESTING CUTTER STL EXPORT MATRIX (12 PRESETS x 4 MODES) ---');
    await cdp.evaluate(`switchTool('cortadores');`);
    const presets = [
      'morcego', 'gato', 'folha', 'marajoara', 'flor', 'sol_boho',
      'cogumelo', 'concha', 'coracao', 'borboleta', 'hamsa', 'andorinha'
    ];
    const modes = ['kit_3_pecas', 'cortador_estampa', 'cortador_simples', 'carimbo_placa'];

    for (const preset of presets) {
      for (const mode of modes) {
        const t0 = Date.now();
        try {
          const exportRes = await cdp.evaluate(`
            (() => {
              document.getElementById('c-native-mode').value = '${mode}';
              document.getElementById('c-preset-shape').value = '${preset}';
              rebuildNativeCutter3D();

              let downloaded = false;
              let filename = null;
              let byteLength = 0;

              const origDownloadBlob = window.downloadBlob;
              window.downloadBlob = (blob, name) => {
                downloaded = true;
                filename = name;
                byteLength = blob.size;
              };

              downloadCutterFullKitSTL();
              window.downloadBlob = origDownloadBlob;

              return { downloaded, filename, byteLength };
            })()
          `);

          const pass = exportRes.downloaded && exportRes.byteLength > 100;
          reporter.record({
            id: `adv_s2_export_${preset}_${mode}`,
            station: 2,
            subsystem: 'Cutter STL Full Kit Exports (48 Permutations)',
            item: `Preset: ${preset} | Mode: ${mode}`,
            expected: 'Generates valid binary STL > 100 bytes',
            actual: `Downloaded: ${exportRes.downloaded}, Bytes: ${exportRes.byteLength.toLocaleString()}, Name: ${exportRes.filename}`,
            status: pass ? 'PASS' : 'FAIL',
            durationMs: Date.now() - t0,
            details: exportRes
          });
        } catch (err) {
          reporter.record({
            id: `adv_s2_export_${preset}_${mode}`,
            station: 2,
            subsystem: 'Cutter STL Full Kit Exports (48 Permutations)',
            item: `Preset: ${preset} | Mode: ${mode}`,
            expected: 'Valid STL export without exception',
            actual: `Exception: ${err.message}`,
            status: 'FAIL',
            durationMs: Date.now() - t0
          });
        }
      }
    }

    // =========================================================================
    // PART C: Station 2 — Custom Uploaded B&W Canvas SDF Simulation
    // =========================================================================
    console.log('\n--- TESTING CUSTOM B&W CANVAS SDF RELIEF GENERATION ---');
    const sdfRes = await cdp.evaluate(`
      (() => {
        // Create synthetic test canvas
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(64, 64, 40, 0, Math.PI * 2);
        ctx.fill();

        cutterCanvasData = ctx.getImageData(0, 0, 128, 128).data;
        customCutterImageUploaded = true;

        document.getElementById('c-native-mode').value = 'carimbo_placa';
        document.getElementById('c-convex-dome').checked = true;
        document.getElementById('c-micro-ribs').checked = true;
        rebuildNativeCutter3D();

        const box = new THREE.Box3().setFromObject(activeMeshGroup);
        return {
          uploaded: customCutterImageUploaded,
          meshCount: activeMeshGroup.children.length,
          bounds: { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] }
        };
      })()
    `);
    await new Promise(r => setTimeout(r, 60));
    const sdfHealth = await inspectMeshHealth(cdp);

    const sdfPass = sdfRes.uploaded && sdfHealth.meshCount > 0 && !sdfHealth.hasNaN && sdfHealth.isFiniteBox;
    reporter.record({
      id: 'adv_s2_canvas_sdf_relief',
      station: 2,
      subsystem: 'Custom Canvas SDF Relief Generation',
      item: 'Malha com Interpolação Bilinear, Domo Descolador e Micro-Frisos',
      expected: 'Generates valid 3D relief mesh without NaN vertices',
      actual: `Meshes: ${sdfHealth.meshCount}, Verts: ${sdfHealth.totalVertices.toLocaleString()}, Bounds: [${sdfHealth.bounds.size.join(' x ')} mm], NaN: ${sdfHealth.hasNaN}`,
      status: sdfPass ? 'PASS' : 'FAIL',
      details: { sdfRes, sdfHealth }
    });

    // Reset synthetic custom image
    await cdp.evaluate(`
      customCutterImageUploaded = false;
      cutterCanvasData = null;
      rebuildNativeCutter3D();
    `);

    // =========================================================================
    // PART D: Station 2 — Huge STL ASCII Live Preview
    // =========================================================================
    console.log('\n--- TESTING HUGE ASCII STL LIVE PREVIEW ---');
    const hugeStlLines = ['solid huge_mesh'];
    for (let i = 0; i < 2000; i++) {
      hugeStlLines.push('facet normal 0 0 1');
      hugeStlLines.push('  outer loop');
      hugeStlLines.push(`    vertex ${i} 0 0`);
      hugeStlLines.push(`    vertex ${i + 1} 1 0`);
      hugeStlLines.push(`    vertex ${i} 1 0`);
      hugeStlLines.push('  endloop');
      hugeStlLines.push('endfacet');
    }
    hugeStlLines.push('endsolid huge_mesh');
    const hugeStlText = hugeStlLines.join('\n');

    const tHuge0 = Date.now();
    const hugePreviewRes = await cdp.evaluate(`
      (() => {
        let ok = false;
        let count = 0;
        let error = null;
        try {
          previewRawStlCode(${JSON.stringify(hugeStlText)});
          ok = true;
          count = activeMeshGroup.children.length;
        } catch (e) {
          error = e.message;
        }
        return { ok, count, error };
      })()
    `);
    await new Promise(r => setTimeout(r, 60));
    const hugeHealth = await inspectMeshHealth(cdp);

    const hugePass = hugePreviewRes.ok && hugeHealth.meshCount > 0 && !hugeHealth.hasNaN;
    reporter.record({
      id: 'adv_s2_huge_ascii_stl_preview',
      station: 2,
      subsystem: 'Live STL Preview Stress',
      item: 'Live Preview de STL ASCII com 2.000 Facetas (6.000 Vértices)',
      expected: 'Parses and displays 2000-facet mesh without crash or NaN',
      actual: `Executed: ${hugePreviewRes.ok}, Meshes: ${hugeHealth.meshCount}, Verts: ${hugeHealth.totalVertices.toLocaleString()}, NaN: ${hugeHealth.hasNaN}`,
      status: hugePass ? 'PASS' : 'FAIL',
      durationMs: Date.now() - tHuge0,
      details: { hugePreviewRes, hugeHealth }
    });

    // Summary
    reporter.recordConsoleLogs(cdp.consoleLogs, cdp.consoleErrors);
    const summary = reporter.getSummary();
    console.log('\n================================================================================');
    console.log(`DEEP DIVE SUITE COMPLETED in ${summary.durationSeconds}s`);
    console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Pass Rate: ${summary.passRate}`);
    console.log(`Console Errors/Exceptions Logged: ${summary.consoleErrorsCount}`);
    console.log('================================================================================\n');

  } catch (err) {
    console.error('[FATAL]', err);
  } finally {
    if (!options.keepAlive) {
      await cdp.close();
    }
  }
}

main().catch(err => {
  console.error('[Unhandled]', err);
  process.exit(1);
});
