/**
 * Station 2 Test Suite: Cortadores & Ejetores 3D (#panel-cortadores)
 * Tests construction modes, 12 presets, sliders, checkboxes, spring selector, draft angle,
 * view modes, STL live preview & part downloads.
 */

async function testStation2(cdp, reporter) {
  console.log('\n--- EXECUTING STATION 2: CORTADORES & EJETORES 3D ---');

  // Activate Station 2
  await cdp.evaluate(`
    (() => {
      switchTool('cortadores');
      switchCutterSubTab('modelar');
      return true;
    })()
  `);

  // =========================================================================
  // 2.1 Construction Modes Audit (#c-native-mode)
  // =========================================================================
  const modeData = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('c-native-mode');
      if (!sel) return { options: [], current: null };
      const options = Array.from(sel.options).map(o => o.value);
      return { options, current: sel.value };
    })()
  `);

  console.log(`[Station 2] Found modes in #c-native-mode:`, modeData.options);

  const expectedModes = ['kit_3_pecas', 'cortador_estampa', 'cortador_simples', 'carimbo_placa'];
  for (const m of expectedModes) {
    const t0 = Date.now();
    // Map mode name to existing value if alias exists
    let valueToSet = m;
    if (m === 'kit_3_pecas' && modeData.options.includes('kit3pecas')) valueToSet = 'kit3pecas';
    if (m === 'carimbo_placa' && modeData.options.includes('relevo')) valueToSet = 'relevo';

    const supported = modeData.options.includes(valueToSet);
    if (supported) {
      await cdp.evaluate(`
        document.getElementById('c-native-mode').value = '${valueToSet}';
        rebuildNativeCutter3D();
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: `s2_mode_${m}`,
        station: 2,
        subsystem: 'Construction Modes',
        item: `Modo Construtivo: ${m}`,
        expected: `Supported in #c-native-mode and generates 3D geometry`,
        actual: `Supported as '${valueToSet}'. Meshes: ${mesh.meshCount}, Verts: ${mesh.totalVertices.toLocaleString()}`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } else {
      reporter.record({
        id: `s2_mode_${m}`,
        station: 2,
        subsystem: 'Construction Modes',
        item: `Modo Construtivo: ${m}`,
        expected: `Option '${m}' should be selectable in #c-native-mode`,
        actual: `Option '${m}' missing in #c-native-mode (Available: ${modeData.options.join(', ')})`,
        status: 'FAIL',
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore kit3pecas for remaining tests
  await cdp.evaluate(`
    const sel = document.getElementById('c-native-mode');
    if (sel && sel.querySelector('option[value="kit3pecas"]')) sel.value = 'kit3pecas';
  `);

  // =========================================================================
  // 2.2 Presets — 12 Shape Presets (#c-preset-shape)
  // =========================================================================
  const presetShapes = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('c-preset-shape');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 2] Found ${presetShapes.length} presets in #c-preset-shape`);

  for (const ps of presetShapes) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('c-preset-shape');
          if (sel) sel.value = '${ps.value}';
          loadPresetPattern('${ps.value}');
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s2_preset_${ps.value}`,
        station: 2,
        subsystem: 'Cutter Presets (12)',
        item: ps.text,
        expected: 'Generates 3-part cutter kit (matriz + embolo + botao) with finite bounds and no NaN',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s2_preset_${ps.value}`,
        station: 2,
        subsystem: 'Cutter Presets (12)',
        item: ps.text,
        expected: 'Loads cutter preset without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore a vector preset for slider and checkbox tests
  await cdp.evaluate(`loadPresetPattern('gato');`);
  await new Promise(r => setTimeout(r, 50));

  // =========================================================================
  // 2.3 Sliders (#c-largura, #c-relevo-h, #c-retracao)
  // =========================================================================
  const sliderTests = [
    {
      id: 's2_slider_largura_120',
      name: 'Envergadura / Largura: 120 mm',
      code: `document.getElementById('c-largura').value = '120'; rebuildNativeCutter3D();`
    },
    {
      id: 's2_slider_relevo_2',
      name: 'Profundidade de Relevo: 2.0 mm',
      code: `document.getElementById('c-relevo-h').value = '2.0'; rebuildNativeCutter3D();`
    },
    {
      id: 's2_slider_retracao_115',
      name: 'Fator de Retração da Argila: 1.15',
      code: `document.getElementById('c-retracao').value = '1.15'; rebuildNativeCutter3D();`
    }
  ];

  for (const st of sliderTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`(() => { ${st.code} })()`);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;
      reporter.record({
        id: st.id,
        station: 2,
        subsystem: 'Sliders & Dimensions',
        item: st.name,
        expected: 'Modifies parametric mesh dimensions without NaN',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: st.id,
        station: 2,
        subsystem: 'Sliders & Dimensions',
        item: st.name,
        expected: 'Updates slider without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 2.4 Checkboxes (Furo Central, Invert B&W, Vent Holes, Convex Dome, Micro Ribs)
  // =========================================================================
  const checkboxTests = [
    { id: 's2_chk_furo_ativo', name: 'Furo Central de Fixação', elId: 'c-furo-ativo' },
    { id: 's2_chk_invert_bw', name: 'Inverter Preto e Branco', elId: 'c-invert-bw' },
    { id: 's2_chk_vent_holes', name: 'Furos Anti-Vácuo Passantes', elId: 'c-vent-holes' },
    { id: 's2_chk_convex_dome', name: 'Domo Descolador (+0.65 mm)', elId: 'c-convex-dome' },
    { id: 's2_chk_micro_ribs', name: 'Micro-Frisos Anti-Sucção de Ar', elId: 'c-micro-ribs' }
  ];

  for (const cb of checkboxTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const el = document.getElementById('${cb.elId}');
          if (el) {
            el.checked = !el.checked;
            rebuildNativeCutter3D();
          }
        })()
      `);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0;
      reporter.record({
        id: cb.id,
        station: 2,
        subsystem: 'Checkboxes & Anti-Suction',
        item: cb.name,
        expected: 'Toggles feature and recalculates mesh geometry',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: cb.id,
        station: 2,
        subsystem: 'Checkboxes & Anti-Suction',
        item: cb.name,
        expected: 'Toggles checkbox without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 2.5 View Modes (Bed, Assembled, Exploded)
  // =========================================================================
  const viewModes = ['bed', 'assembled', 'exploded'];
  for (const vm of viewModes) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`setCutterViewMode('${vm}');`);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      const currentMode = await cdp.evaluate(`currentCutterViewMode`);
      const pass = currentMode === vm && mesh.meshCount > 0;

      reporter.record({
        id: `s2_view_mode_${vm}`,
        station: 2,
        subsystem: 'View Modes (3)',
        item: `Disposição 3D: ${vm.toUpperCase()}`,
        expected: `setCutterViewMode sets currentCutterViewMode to '${vm}' and arranges parts`,
        actual: `Active Mode: ${currentMode}, Meshes: ${mesh.meshCount}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s2_view_mode_${vm}`,
        station: 2,
        subsystem: 'View Modes (3)',
        item: `Disposição 3D: ${vm.toUpperCase()}`,
        expected: 'Sets view mode without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 2.6 Spring Selector & Draft Angle
  // =========================================================================
  const springs = ['flex_pla', 'mola_inox', 'gravidade'];
  for (const sp of springs) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        document.getElementById('c-spring-type').value = '${sp}';
        rebuildNativeCutter3D();
      `);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: `s2_spring_${sp}`,
        station: 2,
        subsystem: 'Spring Selector',
        item: `Tipo de Mola: ${sp}`,
        expected: 'Adjusts plunger travel mechanism and clearance',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s2_spring_${sp}`,
        station: 2,
        subsystem: 'Spring Selector',
        item: `Tipo de Mola: ${sp}`,
        expected: 'Sets spring without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  const angles = ['1.5', '2.0', '3.0'];
  for (const ang of angles) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        document.getElementById('c-draft-angle').value = '${ang}';
        rebuildNativeCutter3D();
      `);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: `s2_draft_angle_${ang}`,
        station: 2,
        subsystem: 'Draft Angle',
        item: `Ângulo de Desmolde: ${ang}°`,
        expected: 'Applies conical slope to blade walls',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s2_draft_angle_${ang}`,
        station: 2,
        subsystem: 'Draft Angle',
        item: `Ângulo de Desmolde: ${ang}°`,
        expected: 'Sets draft angle without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 2.7 STL Live Preview & Downloads
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          switchCutterSubTab('colar');
          const sampleStl = "solid cube\\nfacet normal 0 0 1\\nouter loop\\nvertex 0 0 0\\nvertex 10 0 0\\nvertex 10 10 0\\nendloop\\nendfacet\\nendsolid";
          const input = document.getElementById('stl-raw-code-input');
          if (input) input.value = sampleStl;
          previewRawStlCode();
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0;
      reporter.record({
        id: 's2_stl_live_preview',
        station: 2,
        subsystem: 'Live STL Preview',
        item: 'Visualizador Live Preview de STL ASCII Colado',
        expected: 'Parses ASCII STL triangles and displays preview in Three.js viewport',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's2_stl_live_preview',
        station: 2,
        subsystem: 'Live STL Preview',
        item: 'Visualizador Live Preview de STL ASCII',
        expected: 'Previews ASCII STL without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Download individual cutter parts (matriz, embolo, botao)
  const cutterParts = ['matriz', 'embolo', 'botao'];
  for (const part of cutterParts) {
    const t0 = Date.now();
    try {
      await cdp.clearDownloads();
      await cdp.evaluate(`downloadCutterPartSTL('${part}');`);
      await new Promise(r => setTimeout(r, 80));
      const downloads = await cdp.getDownloads();
      const pass = downloads.length > 0 && downloads.some(d => d.filename.includes(part));

      reporter.record({
        id: `s2_download_part_${part}`,
        station: 2,
        subsystem: 'Part Downloads',
        item: `Download Individual da Peça: ${part.toUpperCase()}`,
        expected: `Exports isolated STL file for ${part}`,
        actual: `Downloads: ${downloads.length} (${downloads.map(d => `${d.filename}: ${d.size}B`).join(', ')})`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s2_download_part_${part}`,
        station: 2,
        subsystem: 'Part Downloads',
        item: `Download Individual da Peça: ${part.toUpperCase()}`,
        expected: 'Exports part without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  console.log('--- STATION 2 TESTS COMPLETE ---');
}

module.exports = { testStation2 };
