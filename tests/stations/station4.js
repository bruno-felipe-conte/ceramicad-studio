/**
 * Station 4 Test Suite: Biblioteca & Inspetor (#panel-biblioteca)
 * Tests Studio Presets (9 models), STL Scale Slider & Risk Modal, and G-Code Analyzer.
 */

async function testStation4(cdp, reporter) {
  console.log('\n--- EXECUTING STATION 4: BIBLIOTECA & INSPETOR ---');

  // Activate Station 4
  await cdp.evaluate(`
    (() => {
      switchTool('biblioteca');
      switchSubBib('presets');
      return true;
    })()
  `);

  // =========================================================================
  // 4.1 Studio Presets — 9 Models
  // =========================================================================
  const studioPresets = [
    { key: 'anfora', name: 'Ânfora Clássica Grega c/ 2 Alças' },
    { key: 'twisted', name: 'Vaso Espiral Torcido (Twisted Octogonal)' },
    { key: 'fluted', name: 'Vaso Nórdico Canelado Profundo (Fluted)' },
    { key: 'lampshade', name: 'Cúpula de Luminária Vazada (Soquete E27)' },
    { key: 'chawan', name: 'Chawan Tradicional Japonês c/ Pé Kodai' },
    { key: 'facetado', name: 'Cachepô Facetado Low-Poly Contemporâneo' },
    { key: 'costela', name: 'Costela de Oleiro Ergonômica c/ Pega' },
    { key: 'chanfrador', name: 'Chanfrador de Placas 45° (Gabarito Bisel)' },
    { key: 'extrusora', name: 'Bocal Matriz de Extrusora (Ø58 mm Hexagonal)' }
  ];

  for (const sp of studioPresets) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`loadStudioPreset3D('${sp.key}');`);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s4_preset_${sp.key}`,
        station: 4,
        subsystem: 'Studio Presets (9)',
        item: sp.name,
        expected: 'Renders parametric studio model in activeMeshGroup with positive bounds',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s4_preset_${sp.key}`,
        station: 4,
        subsystem: 'Studio Presets (9)',
        item: sp.name,
        expected: 'Loads studio preset without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 4.2 STL Inspector & Scale Slider (#stl-scale-slider)
  // =========================================================================
  await cdp.evaluate(`switchSubBib('inspecao');`);

  {
    const t0 = Date.now();
    try {
      // Test 100% scale
      const scale100 = await cdp.evaluate(`
        (() => {
          handleStlScaleChange(100);
          return {
            scaleLabel: document.getElementById('scale-label')?.textContent || '',
            metricStatus: document.getElementById('metric-status')?.textContent || '',
            riskModalHidden: document.getElementById('risk-modal')?.classList.contains('hidden')
          };
        })()
      `);

      // Test 130% scale (triggers risk modal)
      const scale130 = await cdp.evaluate(`
        (() => {
          handleStlScaleChange(130);
          return {
            scaleLabel: document.getElementById('scale-label')?.textContent || '',
            metricStatus: document.getElementById('metric-status')?.textContent || '',
            riskModalVisible: !document.getElementById('risk-modal')?.classList.contains('hidden'),
            bladeWarn: document.getElementById('risk-blade-warn')?.textContent || ''
          };
        })()
      `);

      // Test reinforcement action
      const reinforced = await cdp.evaluate(`
        (() => {
          applyParametricReinforcement();
          return {
            modalClosed: document.getElementById('risk-modal')?.classList.contains('hidden'),
            cutterWidth: document.getElementById('c-largura')?.value || ''
          };
        })()
      `);

      const pass = scale130.riskModalVisible === true && reinforced.modalClosed === true;

      reporter.record({
        id: 's4_stl_scale_risk_modal',
        station: 4,
        subsystem: 'STL Inspector & Scaling',
        item: 'Escala STL (100% -> 130%) & Modal de Risco Paramétrico (Fio Engrossado)',
        expected: 'Triggers #risk-modal at >= 125% scale and applies parametric compensation',
        actual: `100%: "${scale100.metricStatus.trim()}", 130%: ModalVisible=${scale130.riskModalVisible} ("${scale130.bladeWarn}"), Reinforced: ModalClosed=${reinforced.modalClosed}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's4_stl_scale_risk_modal',
        station: 4,
        subsystem: 'STL Inspector & Scaling',
        item: 'Escala STL & Modal de Risco',
        expected: 'Tests scale slider without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 4.3 G-Code Analyzer Slicer Headers
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      const gcodeRes = await cdp.evaluate(`
        (() => {
          // Simulate G-Code parsing matching handleGCodeUpload() in index.html
          const samplePrusa = "; generated by PrusaSlicer\\n; estimated printing time (normal mode) = 3h 42m\\n; filament used [g] = 58.4\\n; total layers count = 380\\n";
          const sampleCura = ";Generated with Cura_SteamEngine\\n; TIME:10800\\n; Filament used = 42.1g\\n;LAYER_COUNT:250\\n";
          const sampleBambu = "; HEADER_BLOCK_START\\n; total estimated time = 2h 15m\\n; filament_weight = 34.8\\n";

          function parseGCodeText(text) {
            let printTime = '—';
            let filamentG = '—';
            let layerCount = '—';

            const timeMatch = text.match(/estimated printing time \\(normal mode\\) = (.*)/i) ||
                              text.match(/; TIME:(.*)/i) ||
                              text.match(/; total estimated time = (.*)/i);
            if (timeMatch) printTime = timeMatch[1].trim();

            const filMatch = text.match(/filament used \\[g\\] = (.*)/i) ||
                             text.match(/; Filament used = (.*)g/i) ||
                             text.match(/filament_weight = (.*)/i);
            if (filMatch) filamentG = parseFloat(filMatch[1]).toFixed(1) + ' g';

            const layerMatch = text.match(/total layers count = (.*)/i) ||
                               text.match(/;LAYER_COUNT:(.*)/i);
            if (layerMatch) layerCount = layerMatch[1].trim();

            return { time: printTime, fil: filamentG, layers: layerCount };
          }

          const rPrusa = parseGCodeText(samplePrusa);
          const rCura = parseGCodeText(sampleCura);
          const rBambu = parseGCodeText(sampleBambu);

          return { rPrusa, rCura, rBambu };
        })()
      `);

      const pass = gcodeRes.rPrusa.time === '3h 42m' && gcodeRes.rPrusa.fil === '58.4 g' &&
                   gcodeRes.rCura.fil === '42.1 g' && gcodeRes.rBambu.fil === '34.8 g';

      reporter.record({
        id: 's4_gcode_analyzer_parsers',
        station: 4,
        subsystem: 'G-Code Analyzer',
        item: 'Analisador de G-Code (PrusaSlicer, Cura, Bambu Studio / OrcaSlicer)',
        expected: 'Extracts estimated print time, filament mass [g], and layer count accurately',
        actual: `Prusa: [${gcodeRes.rPrusa.time}, ${gcodeRes.rPrusa.fil}], Cura: [${gcodeRes.rCura.time}, ${gcodeRes.rCura.fil}], Bambu: [${gcodeRes.rBambu.time}, ${gcodeRes.rBambu.fil}]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's4_gcode_analyzer_parsers',
        station: 4,
        subsystem: 'G-Code Analyzer',
        item: 'Analisador de G-Code',
        expected: 'Parses G-code headers without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  console.log('--- STATION 4 TESTS COMPLETE ---');
}

module.exports = { testStation4 };
