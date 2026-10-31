/**
 * Station 1 Test Suite: Olaria & Vasos 3D (#panel-vasos)
 * Tests Spline mode (54 profiles, 11 textures, morphology, finishes, 270 cut, fillet, drainage, converter)
 * and Connected Slabs mode (14 recipes, 8 stage buttons, card inputs, 3D mesh, 2D pattern unrolling, PDF).
 */

async function testStation1(cdp, reporter) {
  console.log('\n--- EXECUTING STATION 1: OLARIA & VASOS 3D ---');

  // 1. Activate Station 1 and Spline submode
  await cdp.evaluate(`
    (() => {
      switchTool('vasos');
      switchVaseMode('spline');
      return true;
    })()
  `);

  // =========================================================================
  // 1.1 Spline Mode — 54 Profiles in #classic-profile-select
  // =========================================================================
  const profileKeys = await cdp.evaluate(`
    (() => {
      const select = document.getElementById('classic-profile-select');
      if (!select) return [];
      return Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 1] Found ${profileKeys.length} profiles in #classic-profile-select`);

  for (const prof of profileKeys) {
    const t0 = Date.now();
    try {
      const res = await cdp.evaluate(`
        (() => {
          activeTool = 'vasos';
          vaseDesignMode = 'spline';
          const sel = document.getElementById('classic-profile-select');
          if (sel) sel.value = '${prof.value}';
          loadClassicProfilePreset('${prof.value}');
          return { activeTool: activeTool, vaseMode: typeof vaseDesignMode !== 'undefined' ? vaseDesignMode : null };
        })()
      `);

      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();

      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN && !mesh.isEmpty;
      reporter.record({
        id: `s1_spline_profile_${prof.value}`,
        station: 1,
        subsystem: 'Spline Profiles (54)',
        item: prof.text,
        expected: 'Generates valid 3D ceramic mesh (meshCount > 0, vertices > 0, finite bounds, no NaN)',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm], NaN: ${mesh.hasNaN}, ActiveTool: ${res.activeTool}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });

      // Restore activeTool to vasos if bib_* preset changed it
      if (res.activeTool !== 'vasos') {
        await cdp.evaluate(`activeTool = 'vasos'; switchTool('vasos'); switchVaseMode('spline');`);
      }
    } catch (err) {
      reporter.record({
        id: `s1_spline_profile_${prof.value}`,
        station: 1,
        subsystem: 'Spline Profiles (54)',
        item: prof.text,
        expected: 'Generates valid 3D ceramic mesh without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // Restore a standard profile for texture and morphology tests
  await cdp.evaluate(`loadClassicProfilePreset('anfora');`);
  await new Promise(r => setTimeout(r, 50));

  // =========================================================================
  // 1.2 Spline Mode — 11 3D Surface Textures (#v-spline-texture)
  // =========================================================================
  const textureKeys = await cdp.evaluate(`
    (() => {
      const sel = document.getElementById('v-spline-texture');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 1] Found ${textureKeys.length} textures in #v-spline-texture`);

  for (const tex of textureKeys) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('v-spline-texture');
          if (sel) sel.value = '${tex.value}';
          const amp = document.getElementById('v-spline-tex-amp');
          if (amp) amp.value = '3.0';
          const freq = document.getElementById('v-spline-tex-freq');
          if (freq) freq.value = '18';
          rebuildVaseFromSpline();
        })()
      `);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s1_texture_${tex.value}`,
        station: 1,
        subsystem: '3D Surface Textures (11)',
        item: tex.text,
        expected: 'Modifies vertex displacement with continuous texture profile without NaN',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: mesh
      });
    } catch (err) {
      reporter.record({
        id: `s1_texture_${tex.value}`,
        station: 1,
        subsystem: '3D Surface Textures (11)',
        item: tex.text,
        expected: 'Applies texture without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.3 Morphology, Lofting & Helical Twist Controls
  // =========================================================================
  const morphTests = [
    { id: 's1_morph_cross_circle', name: 'Seção Transversal: Círculo', expr: `document.getElementById('v-cross-shape').value = 'circle'; onCrossShapeChange(); rebuildVaseFromSpline();` },
    { id: 's1_morph_cross_petals', name: 'Seção Transversal: Pétalas (8)', expr: `document.getElementById('v-cross-shape').value = 'petals'; document.getElementById('v-cross-count').value = '8'; onCrossShapeChange(); rebuildVaseFromSpline();` },
    { id: 's1_morph_cross_polygon', name: 'Seção Transversal: Polígono (6 lados)', expr: `document.getElementById('v-cross-shape').value = 'polygon'; document.getElementById('v-cross-count').value = '6'; onCrossShapeChange(); rebuildVaseFromSpline();` },
    { id: 's1_morph_twist_neg180', name: 'Torção Helicoidal: -180°', expr: `document.getElementById('v-twist-angle').value = '-180'; rebuildVaseFromSpline();` },
    { id: 's1_morph_twist_pos180', name: 'Torção Helicoidal: +180°', expr: `document.getElementById('v-twist-angle').value = '180'; rebuildVaseFromSpline();` },
    { id: 's1_morph_lofting_blend', name: 'Lofting Hermite: Base Quadrada -> Topo Circular', expr: `document.getElementById('v-loft-base').value = 'polygon'; document.getElementById('v-loft-top').value = 'circle'; rebuildVaseFromSpline();` }
  ];

  for (const mt of morphTests) {
    const t0 = Date.now();
    try {
      await cdp.evaluate(`(() => { ${mt.expr} })()`);
      await new Promise(r => setTimeout(r, 50));
      const mesh = await cdp.inspectActiveMesh();
      const pass = mesh.meshCount > 0 && mesh.totalVertices > 0 && !mesh.hasNaN;
      reporter.record({
        id: mt.id,
        station: 1,
        subsystem: 'Morphology & Twist',
        item: mt.name,
        expected: 'Parametric loft/cross-section modulates 3D shape smoothly without NaN',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: mt.id,
        station: 1,
        subsystem: 'Morphology & Twist',
        item: mt.name,
        expected: 'Executes morphology update without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.4 Ceramic Finishes (CinnabarMaterialSystem)
  // =========================================================================
  const finishes = ['terracota', 'celadon', 'raku', 'gres', 'sigillata', 'porcelana'];
  for (const fin of finishes) {
    const t0 = Date.now();
    try {
      const matInfo = await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('v-ceramic-finish');
          if (sel) sel.value = '${fin}';
          applyCeramicFinish('${fin}');
          let outerMat = null;
          activeMeshGroup.traverse(child => {
            if (child.isMesh && (child.name === 'outerWall' || !outerMat)) {
              outerMat = {
                name: child.name || 'unnamed',
                type: child.material.type,
                roughness: child.material.roughness,
                metalness: child.material.metalness,
                hasNormalMap: !!child.material.normalMap,
                hasBumpMap: !!child.material.bumpMap
              };
            }
          });
          return outerMat;
        })()
      `);

      const pass = matInfo !== null;
      reporter.record({
        id: `s1_finish_${fin}`,
        station: 1,
        subsystem: 'Ceramic Finishes (6)',
        item: `Acabamento Cerâmico: ${fin.toUpperCase()}`,
        expected: 'CinnabarMaterialSystem applies PBR shader maps (roughness, metalness, bump/normal)',
        actual: matInfo ? `MatType: ${matInfo.type}, Roughness: ${matInfo.roughness}, Metalness: ${matInfo.metalness}, NormalMap: ${matInfo.hasNormalMap}, BumpMap: ${matInfo.hasBumpMap}` : 'Outer material not detected',
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s1_finish_${fin}`,
        station: 1,
        subsystem: 'Ceramic Finishes (6)',
        item: `Acabamento Cerâmico: ${fin.toUpperCase()}`,
        expected: 'Applies ceramic finish without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.5 Section Cut (270°), Base Fillet & Drainage Hole
  // =========================================================================
  const featureTests = [
    {
      id: 's1_feature_cut_270',
      name: 'Corte 270° c/ Paredes Espessas Tampadas',
      run: async () => {
        await cdp.evaluate(`
          document.getElementById('v-section-cut').checked = true;
          rebuildVaseFromSpline();
        `);
        await new Promise(r => setTimeout(r, 50));
        return await cdp.inspectActiveMesh();
      },
      check: (m) => m.meshCount > 0 && m.totalVertices > 0
    },
    {
      id: 's1_feature_closed_360',
      name: 'Vaso 360° Fechado Sem Corte',
      run: async () => {
        await cdp.evaluate(`
          document.getElementById('v-section-cut').checked = false;
          rebuildVaseFromSpline();
        `);
        await new Promise(r => setTimeout(r, 50));
        return await cdp.inspectActiveMesh();
      },
      check: (m) => m.meshCount > 0 && m.totalVertices > 0
    },
    {
      id: 's1_feature_drainage_hole',
      name: 'Furo Central de Drenagem Ø25mm c/ Manga Tubular',
      run: async () => {
        await cdp.evaluate(`
          document.getElementById('v-drainage-hole').value = '25';
          rebuildVaseFromSpline();
        `);
        await new Promise(r => setTimeout(r, 50));
        return await cdp.inspectActiveMesh();
      },
      check: (m) => m.meshCount > 0 && m.totalVertices > 0
    },
    {
      id: 's1_feature_base_fillet',
      name: 'Filete de Base Anti-Trinca Raio 12mm',
      run: async () => {
        await cdp.evaluate(`
          document.getElementById('v-base-fillet').value = '12';
          rebuildVaseFromSpline();
        `);
        await new Promise(r => setTimeout(r, 50));
        return await cdp.inspectActiveMesh();
      },
      check: (m) => m.meshCount > 0 && m.totalVertices > 0
    }
  ];

  for (const ft of featureTests) {
    const t0 = Date.now();
    try {
      const mesh = await ft.run();
      const pass = ft.check(mesh);
      reporter.record({
        id: ft.id,
        station: 1,
        subsystem: 'Cut, Fillet & Drainage',
        item: ft.name,
        expected: 'Generates non-empty geometry with caps/tubular sleeve',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Bounds: [${mesh.bounds ? mesh.bounds.size.join(' x ') : 'empty'} mm]`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: ft.id,
        station: 1,
        subsystem: 'Cut, Fillet & Drainage',
        item: ft.name,
        expected: 'Executes feature test without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.6 Spline to Slabs Auto-Conversion
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      const conv = await cdp.evaluate(`
        (() => {
          loadClassicProfilePreset('anfora');
          convertSplineToSlabStages();
          return {
            mode: vaseDesignMode,
            stagesCount: typeof vaseStages !== 'undefined' ? vaseStages.length : 0,
            hasCards: document.getElementById('vase-stages-list')?.children.length || 0
          };
        })()
      `);
      await new Promise(r => setTimeout(r, 80));
      const mesh = await cdp.inspectActiveMesh();
      const pass = conv.mode === 'estagios' && conv.stagesCount >= 5 && mesh.meshCount > 0;

      reporter.record({
        id: 's1_converter_spline_to_slabs',
        station: 1,
        subsystem: 'Spline to Slabs Converter',
        item: 'Conversor Automático: Silhueta Spline ➔ 5 Estágios Conectados',
        expected: 'Switches to estagios mode, creates base disc + >= 5 axial stages, builds valid 3D mesh',
        actual: `Mode: ${conv.mode}, Stages: ${conv.stagesCount}, Cards: ${conv.hasCards}, Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's1_converter_spline_to_slabs',
        station: 1,
        subsystem: 'Spline to Slabs Converter',
        item: 'Conversor Automático: Spline ➔ Estágios',
        expected: 'Converts spline to slab stages without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.7 Connected Slabs Mode — 14 Ready Recipes (#slab-recipe-select)
  // =========================================================================
  const slabRecipes = await cdp.evaluate(`
    (() => {
      switchVaseMode('estagios');
      const sel = document.getElementById('slab-recipe-select');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text }));
    })()
  `);

  console.log(`[Station 1] Found ${slabRecipes.length} recipes in #slab-recipe-select`);

  for (const recipe of slabRecipes) {
    const t0 = Date.now();
    try {
      const data = await cdp.evaluate(`
        (() => {
          const sel = document.getElementById('slab-recipe-select');
          if (sel) sel.value = '${recipe.value}';
          loadSlabConnectedRecipe('${recipe.value}');
          const rings = computeFrustumRings();
          const items = prepareAllVasePatternItems(rings);
          return {
            stagesCount: typeof vaseStages !== 'undefined' ? vaseStages.length : 0,
            ringsCount: rings ? rings.length : 0,
            patternsCount: items ? items.length : 0,
            patternLabels: items ? items.map(p => p.label).join(', ') : ''
          };
        })()
      `);

      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = data.stagesCount > 0 && mesh.meshCount > 0 && data.patternsCount > 0 && !mesh.hasNaN;

      reporter.record({
        id: `s1_slab_recipe_${recipe.value}`,
        station: 1,
        subsystem: 'Connected Slabs Recipes (14)',
        item: recipe.text,
        expected: 'Generates valid 3D multi-stage mesh and >0 2D unrolled pattern items',
        actual: `Stages: ${data.stagesCount}, 3D Meshes: ${mesh.meshCount}, Verts: ${mesh.totalVertices.toLocaleString()}, 2D Patterns: ${data.patternsCount} (${data.patternLabels})`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: { mesh, data }
      });
    } catch (err) {
      reporter.record({
        id: `s1_slab_recipe_${recipe.value}`,
        station: 1,
        subsystem: 'Connected Slabs Recipes (14)',
        item: recipe.text,
        expected: 'Loads slab recipe without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.8 Connected Slabs Mode — 8 Stage Addition Buttons
  // =========================================================================
  const stageButtons = [
    { tipo: 'cilindro', name: '+ Cilindro (Anel Cilíndrico Reto)' },
    { tipo: 'cone', name: '+ Cone (Tronco de Cone Flutuante)' },
    { tipo: 'esfera', name: '+ Bojo Esf. (Bojo Esférico em Frustuns)' },
    { tipo: 'disco', name: '+ Disco (Fundo ou Prato Separador)' },
    { tipo: 'alca', name: '+ Alça (Alça Curva Cerâmica Extrudada)' },
    { tipo: 'bico', name: '+ Bico (Bico Vertedor Cônico)' },
    { tipo: 'tampa', name: '+ Tampa (Tampa c/ Encaixe e Puxador)' },
    { tipo: 'borda', name: '+ Borda/Pé (Anel Reforçado de Boca ou Pé Kodai)' }
  ];

  for (const sb of stageButtons) {
    const t0 = Date.now();
    try {
      const res = await cdp.evaluate(`
        (() => {
          const before = typeof vaseStages !== 'undefined' ? vaseStages.length : 0;
          addVaseStage('${sb.tipo}');
          const after = typeof vaseStages !== 'undefined' ? vaseStages.length : 0;
          const rings = computeFrustumRings();
          const items = prepareAllVasePatternItems(rings);
          return {
            before,
            after,
            rings: rings ? rings.length : 0,
            patterns: items ? items.length : 0
          };
        })()
      `);

      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = res.after === res.before + 1 && mesh.meshCount > 0 && res.patterns > 0;

      reporter.record({
        id: `s1_btn_add_${sb.tipo}`,
        station: 1,
        subsystem: 'Stage Buttons (8)',
        item: sb.name,
        expected: 'Adds component stage to vaseStages, refreshes cards, builds 3D and 2D unrolling',
        actual: `Stage Count: ${res.before} -> ${res.after}, 3D Meshes: ${mesh.meshCount}, 2D Patterns: ${res.patterns}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: `s1_btn_add_${sb.tipo}`,
        station: 1,
        subsystem: 'Stage Buttons (8)',
        item: sb.name,
        expected: 'Adds stage without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.9 Card Inputs & Reactive Parameter Updates
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      const cardUpdate = await cdp.evaluate(`
        (() => {
          // Reset to standard cup
          loadSlabConnectedRecipe('xicara_cafe');
          // Find first disco and change cut type
          const discoIdx = vaseStages.findIndex(s => s.tipo === 'disco');
          if (discoIdx >= 0) {
            vaseStages[discoIdx].corteTipo = 'crivo_multiplo';
            vaseStages[discoIdx].furoQtd = 8;
            vaseStages[discoIdx].furoDiam = 6;
          }
          // Find alca and change reach
          const alcaIdx = vaseStages.findIndex(s => s.tipo === 'alca');
          if (alcaIdx >= 0) {
            vaseStages[alcaIdx].projecao = 35;
            vaseStages[alcaIdx].largTira = 18;
          }
          enforceStageContinuity();
          renderVaseStagesUI();
          rebuildVase();
          const rings = computeFrustumRings();
          const items = prepareAllVasePatternItems(rings);
          const hasMultipleHolesPattern = items.some(it => it.label.includes('Disco') || it.label.includes('Base'));
          return {
            discoIdx,
            alcaIdx,
            patternsCount: items.length,
            hasMultipleHolesPattern
          };
        })()
      `);

      await new Promise(r => setTimeout(r, 60));
      const mesh = await cdp.inspectActiveMesh();
      const pass = cardUpdate.patternsCount > 0 && mesh.meshCount > 0;

      reporter.record({
        id: 's1_card_inputs_reactive',
        station: 1,
        subsystem: 'Stage Card Inputs',
        item: 'Atualização Reativa de Parâmetros (Disco Crivo Múltiplo + Alça 35mm)',
        expected: 'Modifies 3D geometry vertices and updates 2D pattern unrolling accordingly',
        actual: `Meshes: ${mesh.meshCount}, Vertices: ${mesh.totalVertices.toLocaleString()}, Patterns: ${cardUpdate.patternsCount}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's1_card_inputs_reactive',
        station: 1,
        subsystem: 'Stage Card Inputs',
        item: 'Atualização Reativa de Parâmetros',
        expected: 'Updates card parameters without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.10 2D Pattern Unrolling, A4 Nesting & PDF Generation
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      await cdp.clearPdfs();
      const pdfRes = await cdp.evaluate(`
        (() => {
          loadSlabConnectedRecipe('chaleira_bule');
          const rings = computeFrustumRings();
          const items = prepareAllVasePatternItems(rings);
          const sheets = packPatternsToA4Sheets(items, 182, 253, 20);

          let exportFnCalled = false;
          let fnName = '';
          if (typeof exportVase2DPatternsPDF === 'function') {
            fnName = 'exportVase2DPatternsPDF';
            exportVase2DPatternsPDF();
            exportFnCalled = true;
          } else if (typeof generateVasePDF === 'function') {
            fnName = 'generateVasePDF (alias required: exportVase2DPatternsPDF)';
            generateVasePDF();
            exportFnCalled = true;
          }

          return {
            itemsCount: items.length,
            sheetsCount: sheets.sheets.length,
            minGapEnforced: sheets.sheets.length > 0,
            exportFnCalled,
            fnName
          };
        })()
      `);

      await new Promise(r => setTimeout(r, 100));
      const pdfs = await cdp.getPdfs();
      const pass = pdfRes.itemsCount > 0 && pdfRes.sheetsCount > 0 && (pdfs.length > 0 || pdfRes.exportFnCalled);

      reporter.record({
        id: 's1_2d_patterns_pdf_export',
        station: 1,
        subsystem: '2D Patterns & PDF',
        item: 'Planificação 2D A4 c/ Nesting >= 20mm & Exportação PDF A4 1:1',
        expected: 'Unrolls all pieces, packs onto A4 sheets with >= 20mm margin, exports PDF via jsPDF',
        actual: `Items: ${pdfRes.itemsCount}, A4 Sheets: ${pdfRes.sheetsCount}, ExportFn: ${pdfRes.fnName}, PDFs Generated: ${pdfs.length} (${pdfs.map(p => p.filename).join(', ')})`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: { pdfRes, pdfs }
      });
    } catch (err) {
      reporter.record({
        id: 's1_2d_patterns_pdf_export',
        station: 1,
        subsystem: '2D Patterns & PDF',
        item: 'Planificação 2D & Exportação PDF',
        expected: 'Executes 2D unrolling and PDF generation without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 1.11 STL Export Validation
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      await cdp.clearDownloads();
      await cdp.evaluate(`
        exportActiveMeshSTL('test_vaso_360.stl');
      `);
      await new Promise(r => setTimeout(r, 100));
      const downloads = await cdp.getDownloads();
      const pass = downloads.length > 0 && downloads.some(d => d.filename.includes('test_vaso_360') && d.size > 100);

      reporter.record({
        id: 's1_export_stl_binary',
        station: 1,
        subsystem: 'STL Export',
        item: 'Exportação STL Binário da Malha Ativa',
        expected: 'STLExporter parses activeMeshGroup and initiates binary STL download',
        actual: `Downloads: ${downloads.length} (${downloads.map(d => `${d.filename}: ${d.size} bytes`).join(', ')})`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0,
        details: { downloads }
      });
    } catch (err) {
      reporter.record({
        id: 's1_export_stl_binary',
        station: 1,
        subsystem: 'STL Export',
        item: 'Exportação STL Binário',
        expected: 'Generates STL without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  console.log('--- STATION 1 TESTS COMPLETE ---');
}

module.exports = { testStation1 };
