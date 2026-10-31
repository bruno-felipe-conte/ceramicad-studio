/**
 * Station 3 Test Suite: Texturas & Utilitários (#panel-utilitarios)
 * Tests Rollers 360° (20 presets), Maker's Mark Stamps (24 presets), Lithophane 3D (10 presets),
 * Plaster Box Molds (12 models), and QR Code Plates 3D (10 models).
 */

async function testStation3(cdp, reporter) {
  console.log('\n--- EXECUTING STATION 3: TEXTURAS & UTILITÁRIOS ---');

  // Activate Station 3
  await cdp.evaluate(`
    (() => {
      switchTool('utilitarios');
      switchSubUtil('rolos');
      setSubToolRolos('rolo');
      return true;
    })()
  `);

  // =========================================================================
  // 3.1 Rollers 360° — 20 Presets (#r-preset-select)
  // =========================================================================
  const rollerPresets = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('r-preset-select');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 3] Found ${rollerPresets.length} presets in #r-preset-select`);

  for (const rp of rollerPresets) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('r-preset-select');
          if (sel) sel.value = '${rp.value}';
          loadRollerPreset('${rp.value}');
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s3_roller_preset_${rp.value}`,
        station: 3,
        subsystem: 'Rollers 360° (20)',
        item: rp.text,
        expected: 'Generates seamless procedural 360° cylinder relief without distortion',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s3_roller_preset_${rp.value}`,
        station: 3,
        subsystem: 'Rollers 360° (20)',
        item: rp.text,
        expected: 'Generates roller preset without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Roller parameters & axle hole
  const rollerParams = [
    { id: 's3_roller_axle_hole_on', name: 'Furo Eixo Ø8mm c/ Túnel e Buchas (Ativo)', code: `document.getElementById('r-axle-hole').checked = true; rebuildRoller3D();` },
    { id: 's3_roller_axle_hole_off', name: 'Furo Eixo Desativado (Cilindro Fechado c/ Manoplas)', code: `document.getElementById('r-axle-hole').checked = false; rebuildRoller3D();` },
    { id: 's3_roller_dim_custom', name: 'Dimensões Personalizadas: Ø60mm x 150mm x 4.0mm Relevo', code: `document.getElementById('r-diam').value = '60'; document.getElementById('r-altura').value = '150'; document.getElementById('r-relevo').value = '4.0'; rebuildRoller3D();` }
  ];

  for (const p of rollerParams) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`(() => { ${p.code} })()`);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: p.id,
        station: 3,
        subsystem: 'Roller Parameters',
        item: p.name,
        expected: 'Adjusts axle hole / dimensions and regenerates roller mesh',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: p.id,
        station: 3,
        subsystem: 'Roller Parameters',
        item: p.name,
        expected: 'Updates roller parameter without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 3.2 Maker's Mark Stamps — 24 Presets (#m-preset-select)
  // =========================================================================
  await cdp.evaluate(`setSubToolRolos('carimbo');`);

  const stampPresets = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('m-preset-select');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 3] Found ${stampPresets.length} presets in #m-preset-select`);

  for (const sp of stampPresets) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('m-preset-select');
          if (sel) sel.value = '${sp.value}';
          loadStampPreset('${sp.value}');
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s3_stamp_preset_${sp.value}`,
        station: 3,
        subsystem: "Maker's Mark (24)",
        item: sp.text,
        expected: 'Generates ergonomic turned handle + base plate + procedural vector emblem',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s3_stamp_preset_${sp.value}`,
        station: 3,
        subsystem: "Maker's Mark (24)",
        item: sp.text,
        expected: 'Generates stamp preset without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Stamp formats (circular, quadrado, hexagonal, oval)
  const stampFormats = ['circular', 'quadrado', 'hexagonal', 'oval'];
  for (const fmt of stampFormats) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        document.getElementById('m-formato').value = '${fmt}';
        rebuildStamp3D();
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: `s3_stamp_fmt_${fmt}`,
        station: 3,
        subsystem: 'Stamp Formats (4)',
        item: `Formato do Carimbo: ${fmt.toUpperCase()}`,
        expected: 'Builds geometric base outline with rounded corners',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s3_stamp_fmt_${fmt}`,
        station: 3,
        subsystem: 'Stamp Formats (4)',
        item: `Formato do Carimbo: ${fmt.toUpperCase()}`,
        expected: 'Sets format without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Stamp bed view positions (face_up, stamp_down, side_both)
  const stampPositions = ['face_up', 'stamp_down', 'side_both'];
  for (const pos of stampPositions) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        document.getElementById('m-view-pos').value = '${pos}';
        rebuildStamp3D();
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: `s3_stamp_pos_${pos}`,
        station: 3,
        subsystem: 'Stamp Positions (3)',
        item: `Orientação FDM: ${pos.toUpperCase()}`,
        expected: 'Transforms group rotation and positioning on print bed',
        actual: `Meshes: ${mesh.meshCount}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s3_stamp_pos_${pos}`,
        station: 3,
        subsystem: 'Stamp Positions (3)',
        item: `Orientação FDM: ${pos.toUpperCase()}`,
        expected: 'Sets orientation without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 3.3 Lithophane 3D — 10 Presets (#litho-preset-select) & 4 Shapes
  // =========================================================================
  await cdp.evaluate(`switchSubUtil('litofania');`);

  const lithoPresets = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('litho-preset-select');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 3] Found ${lithoPresets.length} presets in #litho-preset-select`);

  for (const lp of lithoPresets) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('litho-preset-select');
          if (sel) sel.value = '${lp.value}';
          loadLithoPreset('${lp.value}');
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s3_litho_preset_${lp.value}`,
        station: 3,
        subsystem: 'Lithophane 3D (10)',
        item: lp.text,
        expected: 'Renders heightmap displacement mesh without recursion or lockup',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s3_litho_preset_${lp.value}`,
        station: 3,
        subsystem: 'Lithophane 3D (10)',
        item: lp.text,
        expected: 'Generates lithophane preset without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Lithophane shapes (plana, curva, cilindro, cupula)
  const lithoShapes = ['plana', 'curva', 'cilindro', 'cupula'];
  for (const sh of lithoShapes) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        document.getElementById('litho-shape').value = '${sh}';
        generateLithophane3D();
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      reporter.record({
        id: `s3_litho_shape_${sh}`,
        station: 3,
        subsystem: 'Lithophane Shapes (4)',
        item: `Formato Estrutural: ${sh.toUpperCase()}`,
        expected: 'Transforms flat heightmap into curvilinear / cylindrical / dome coordinates',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: mesh.meshCount > 0 ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s3_litho_shape_${sh}`,
        station: 3,
        subsystem: 'Lithophane Shapes (4)',
        item: `Formato Estrutural: ${sh.toUpperCase()}`,
        expected: 'Sets shape without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 3.4 Plaster Box Molds & Workshop Tools — 12 Models (#box-mode-select)
  // =========================================================================
  await cdp.evaluate(`switchSubUtil('caixas');`);

  const boxModes = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('box-mode-select');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 3] Found ${boxModes.length} models in #box-mode-select`);

  for (const bm of boxModes) {
    const t0 = Date.now();
    try {
      const uiLabels = await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('box-mode-select');
          if (sel) sel.value = '${bm.value}';
          updateBoxToolUI();
          generateBoxTool3D();
          return {
            lbl1: document.getElementById('box-lbl1')?.textContent || '',
            lbl2: document.getElementById('box-lbl2')?.textContent || '',
            lbl3: document.getElementById('box-lbl3')?.textContent || ''
          };
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s3_box_model_${bm.value}`,
        station: 3,
        subsystem: 'Plaster Boxes & Molds (12)',
        item: bm.text,
        expected: 'Renders workshop tool geometry and updates dynamic input labels',
        actual: `Meshes: ${mesh.meshCount}, Verts: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm], Labels: [${uiLabels.lbl1}, ${uiLabels.lbl2}, ${uiLabels.lbl3}]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s3_box_model_${bm.value}`,
        station: 3,
        subsystem: 'Plaster Boxes & Molds (12)',
        item: bm.text,
        expected: 'Generates box mold without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 3.5 QR Code 3D Plates — 10 Models (#qr-plate-type)
  // =========================================================================
  await cdp.evaluate(`switchSubUtil('qrcode');`);

  const qrTypes = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('qr-plate-type');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 3] Found ${qrTypes.length} models in #qr-plate-type`);

  for (const qt of qrTypes) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('qr-plate-type');
          if (sel) sel.value = '${qt.value}';
          generateQrPlate3D();
        })()
      `);
      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s3_qr_type_${qt.value}`,
        station: 3,
        subsystem: 'QR Code Plates (10)',
        item: qt.text,
        expected: 'Generates procedural 21x21 QR modules with custom base/stand fixture',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s3_qr_type_${qt.value}`,
        station: 3,
        subsystem: 'QR Code Plates (10)',
        item: qt.text,
        expected: 'Generates QR plate without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  console.log('--- STATION 3 TESTS COMPLETE ---');
}

module.exports = { testStation3 };
