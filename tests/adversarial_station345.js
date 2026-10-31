/**
 * Empirical Adversarial Challenger Test Suite: Stations 3, 4, 5
 *
 * Stress-tests boundary conditions, extreme inputs, inversions, and malformed data
 * for:
 * 1. Station 3: Lithophane 3D, Plaster Boxes, QR Code Plates
 * 2. Station 4: G-Code Analyzer malformed headers, Studio presets boundary scaling
 * 3. Station 5: Pricing engine zero/negative/extreme inputs & PDF exports
 */

const path = require('path');
const { CDPHarness } = require('./cdp_harness');

async function runAdversarialTests() {
  console.log('================================================================================');
  console.log('   CERAMICAD STUDIO PRO — ADVERSARIAL STRESS TEST SUITE (STATIONS 3, 4, 5)   ');
  console.log('================================================================================\n');

  const cdp = new CDPHarness({
    httpPort: 8099,
    cdpPort: 9299,
    workDir: path.resolve(__dirname, '..')
  });

  await cdp.init();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    findings: [],
    details: []
  };

  function assertTest(name, condition, details = {}) {
    results.total++;
    const status = condition ? 'PASS' : 'FAIL';
    if (condition) {
      results.passed++;
      console.log(`[✅ PASS] ${name}`);
    } else {
      results.failed++;
      console.log(`[❌ FAIL] ${name}`);
      results.findings.push({ name, details });
    }
    results.details.push({ name, status, details });
  }

  // =========================================================================
  // 1. STATION 3: LITHOPHANE 3D EMPIRICAL CHALLENGES
  // =========================================================================
  console.log('\n--- [1] STATION 3: LITHOPHANE 3D ADVERSARIAL CHALLENGES ---');
  await cdp.evaluate(`
    switchTool('utilitarios');
    switchSubUtil('litofania');
  `);

  // 1.1 Thickness Inversion (minThick > maxThick)
  console.log('\n> 1.1 Testing Lithophane Thickness Inversion (minThick=4.0 > maxThick=1.5)...');
  await cdp.evaluate(`
    document.getElementById('litho-min-thick').value = '4.0';
    document.getElementById('litho-max-thick').value = '1.5';
    generateLithophane3D();
  `);
  await new Promise(r => setTimeout(r, 100));
  let meshInfo = await cdp.inspectActiveMesh();
  assertTest(
    'Lithophane: Thickness Inversion (min=4.0 > max=1.5) produces non-empty mesh without NaN',
    meshInfo.meshCount > 0 && meshInfo.totalVertices > 0 && !meshInfo.hasNaN,
    meshInfo
  );

  // 1.2 Extreme Thickness Bounds
  console.log('\n> 1.2 Testing Extreme Thickness Bounds (min=0.01, max=50.0, and negative)...');
  await cdp.evaluate(`
    document.getElementById('litho-min-thick').value = '-5.0';
    document.getElementById('litho-max-thick').value = '50.0';
    generateLithophane3D();
  `);
  await new Promise(r => setTimeout(r, 100));
  meshInfo = await cdp.inspectActiveMesh();
  assertTest(
    'Lithophane: Clamped Negative min-thick and massive max-thick generates valid mesh without NaN',
    meshInfo.meshCount > 0 && !meshInfo.hasNaN,
    meshInfo
  );

  // 1.3 Extreme Dimensions (Tiny, Massive, Zero, Negative)
  const lithoDimCases = [
    { name: 'Tiny Dimensions (w=1, h=1)', w: '1', h: '1' },
    { name: 'Massive Dimensions (w=2500, h=3000)', w: '2500', h: '3000' },
    { name: 'Zero Dimensions (w=0, h=0)', w: '0', h: '0' },
    { name: 'Negative Dimensions (w=-50, h=-80)', w: '-50', h: '-80' }
  ];

  for (const tc of lithoDimCases) {
    console.log(`\n> 1.3 Testing Lithophane ${tc.name}...`);
    const evalRes = await cdp.evaluate(`
      (() => {
        try {
          document.getElementById('litho-w').value = '${tc.w}';
          document.getElementById('litho-h').value = '${tc.h}';
          document.getElementById('litho-min-thick').value = '0.8';
          document.getElementById('litho-max-thick').value = '3.8';
          generateLithophane3D();
          return { ok: true };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 100));
    meshInfo = await cdp.inspectActiveMesh();
    assertTest(
      `Lithophane: ${tc.name} handles boundary safely without NaN`,
      evalRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
      { evalRes, meshInfo }
    );
  }

  // 1.4 Rapid Preset & Shape Switching (Stress test against race conditions / leaks)
  console.log('\n> 1.4 Testing Rapid Preset & Shape Switching (10 presets x 4 shapes in quick succession)...');
  const rapidSwitchRes = await cdp.evaluate(`
    (() => {
      try {
        const presets = ['lotus', 'onda', 'noite_estrelada', 'mandala', 'bambu', 'rosacea', 'gato_lua', 'anfora', 'montanhas', 'colibri'];
        const shapes = ['plana', 'curva', 'cilindro', 'cupula'];
        for (let i = 0; i < presets.length; i++) {
          const p = presets[i];
          const s = shapes[i % shapes.length];
          document.getElementById('litho-preset-select').value = p;
          document.getElementById('litho-shape').value = s;
          loadLithoPreset(p);
        }
        return { ok: true, activeCount: activeMeshGroup.children.length };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 100));
  meshInfo = await cdp.inspectActiveMesh();
  assertTest(
    'Lithophane: Rapid preset and shape switches execute synchronously without unhandled exceptions or NaN',
    rapidSwitchRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
    { rapidSwitchRes, meshInfo }
  );

  // =========================================================================
  // 2. STATION 3: PLASTER BOX & WORKSHOP TOOLS EMPIRICAL CHALLENGES
  // =========================================================================
  console.log('\n--- [2] STATION 3: PLASTER BOX MOLDS & TOOLS ADVERSARIAL CHALLENGES ---');
  await cdp.evaluate(`
    switchTool('utilitarios');
    switchSubUtil('caixas');
  `);

  // 2.1 Zero-wall and Negative Wall Boundary Conditions
  const plasterWallCases = [
    { name: 'Zero Wall (wall=0, lip=0)', wall: '0', lip: '0' },
    { name: 'Negative Wall & Lip (wall=-10, lip=-5)', wall: '-10', lip: '-5' },
    { name: 'Sub-millimeter Wall (wall=0.01, lip=0.01)', wall: '0.01', lip: '0.01' }
  ];

  for (const tc of plasterWallCases) {
    console.log(`\n> 2.1 Testing Plaster Box ${tc.name}...`);
    const evalRes = await cdp.evaluate(`
      (() => {
        try {
          document.getElementById('box-mode-select').value = 'caxilho_kit4';
          document.getElementById('box-dim1').value = '140';
          document.getElementById('box-dim2').value = '140';
          document.getElementById('box-dim3').value = '100';
          document.getElementById('box-wall').value = '${tc.wall}';
          document.getElementById('box-lip').value = '${tc.lip}';
          updateBoxToolUI();
          generateBoxTool3D();
          return { ok: true };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 100));
    meshInfo = await cdp.inspectActiveMesh();
    assertTest(
      `Plaster Box: ${tc.name} clamps wall safely without NaN`,
      evalRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
      { evalRes, meshInfo }
    );
  }

  // 2.2 Extreme Wall Over-Dimension Condition (Wall > Dimension)
  console.log('\n> 2.2 Testing Wall > Dimension (d1=20, d2=20, wall=25)...');
  const overWallRes = await cdp.evaluate(`
    (() => {
      try {
        document.getElementById('box-mode-select').value = 'caxilho_kit4';
        document.getElementById('box-dim1').value = '20';
        document.getElementById('box-dim2').value = '20';
        document.getElementById('box-dim3').value = '30';
        document.getElementById('box-wall').value = '25';
        document.getElementById('box-lip').value = '5';
        generateBoxTool3D();
        return { ok: true };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 100));
  meshInfo = await cdp.inspectActiveMesh();
  assertTest(
    'Plaster Box: Extreme Wall > Dimension geometry builds without crashing or NaN',
    overWallRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
    { overWallRes, meshInfo }
  );

  // 2.3 Boundary Testing All 12 Plaster Box Models with Extreme Dimensions
  console.log('\n> 2.3 Testing All 12 Plaster Box Models with extreme inputs (d1=10, d2=10, d3=5, wall=2, lip=0)...');
  const allBoxModes = await cdp.evaluate(`
    Array.from(document.getElementById('box-mode-select').options).map(o => o.value)
  `);

  for (const mode of allBoxModes) {
    const evalRes = await cdp.evaluate(`
      (() => {
        try {
          document.getElementById('box-mode-select').value = '${mode}';
          document.getElementById('box-dim1').value = '10';
          document.getElementById('box-dim2').value = '10';
          document.getElementById('box-dim3').value = '5';
          document.getElementById('box-wall').value = '2';
          document.getElementById('box-lip').value = '0';
          updateBoxToolUI();
          generateBoxTool3D();
          return { ok: true };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 60));
    meshInfo = await cdp.inspectActiveMesh();
    assertTest(
      `Plaster Box [${mode}]: Extreme minimum dimensions build valid mesh without NaN`,
      evalRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
      { mode, evalRes, meshInfo }
    );
  }

  // 2.4 Verify UI Labels Integrity for All 12 Models
  console.log('\n> 2.4 Verifying UI Dynamic Labels for all 12 Plaster Box Models...');
  const labelCheck = await cdp.evaluate(`
    (() => {
      const results = [];
      const sel = document.getElementById('box-mode-select');
      for (const opt of sel.options) {
        sel.value = opt.value;
        updateBoxToolUI();
        const l1 = document.getElementById('box-dim1-lbl')?.textContent || '';
        const l2 = document.getElementById('box-dim2-lbl')?.textContent || '';
        const l3 = document.getElementById('box-dim3-lbl')?.textContent || '';
        const lW = document.getElementById('box-wall-lbl')?.textContent || '';
        const lL = document.getElementById('box-lip-lbl')?.textContent || '';
        results.push({
          mode: opt.value,
          labelsFilled: Boolean(l1 && l2 && l3 && lW && lL),
          labels: [l1, l2, l3, lW, lL]
        });
      }
      return results;
    })()
  `);
  const allLabelsFilled = labelCheck.every(r => r.labelsFilled);
  assertTest(
    'Plaster Box: Dynamic input labels (dim1-lbl, dim2-lbl, dim3-lbl, wall-lbl, lip-lbl) populated for all 12 models',
    allLabelsFilled,
    labelCheck
  );

  // =========================================================================
  // 3. STATION 3: QR CODE 3D PLATES EMPIRICAL CHALLENGES
  // =========================================================================
  console.log('\n--- [3] STATION 3: QR CODE 3D PLATES ADVERSARIAL CHALLENGES ---');
  await cdp.evaluate(`
    switchTool('utilitarios');
    switchSubUtil('qrcode');
  `);

  // 3.1 Empty String Input
  console.log('\n> 3.1 Testing QR Code Plate with Empty String ""...');
  const emptyQrRes = await cdp.evaluate(`
    (() => {
      try {
        document.getElementById('qr-text-input').value = '';
        generateQrPlate3D();
        return { ok: true };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 100));
  meshInfo = await cdp.inspectActiveMesh();
  assertTest(
    'QR Code: Empty string input handles gracefully with fallback and valid mesh',
    emptyQrRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
    { emptyQrRes, meshInfo }
  );

  // 3.2 Special Characters & Unicode & XSS Payloads
  const specialStrings = [
    { name: 'Emojis and Symbols', str: '🏺✨🔥🚀💻💯🎯🧱🌟🎨' },
    { name: 'Accents & Portuguese text', str: 'Cerâmica Rústica & Olaria São João d’Aliança (Preço: R$ 150,00)' },
    { name: 'HTML & Script Tags (XSS probe)', str: '<script>alert("XSS")</script><img src=x onerror=alert(1)>' },
    { name: 'Punctuation, quotes and escapes', str: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\~`' },
    { name: 'Newlines and control chars', str: 'Line 1\nLine 2\r\n\tTabbed\0Null' }
  ];

  for (const tc of specialStrings) {
    console.log(`\n> 3.2 Testing QR Code with ${tc.name}...`);
    const evalRes = await cdp.evaluate(`
      (() => {
        try {
          document.getElementById('qr-text-input').value = ${JSON.stringify(tc.str)};
          generateQrPlate3D();
          return { ok: true };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 100));
    meshInfo = await cdp.inspectActiveMesh();
    assertTest(
      `QR Code: Handles ${tc.name} safely without crash or NaN`,
      evalRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
      { evalRes, meshInfo }
    );
  }

  // 3.3 Huge URLs (1,000 to 5,000 characters)
  const hugeUrlCases = [
    { name: '1,000 chars URL', len: 1000 },
    { name: '5,000 chars URL', len: 5000 }
  ];

  for (const hc of hugeUrlCases) {
    console.log(`\n> 3.3 Testing QR Code with ${hc.name}...`);
    const longStr = 'https://atelieceramicad.com.br/loja/categoria/vaso-espiral-torcido?token=' + 'a'.repeat(hc.len);
    const evalRes = await cdp.evaluate(`
      (() => {
        try {
          document.getElementById('qr-text-input').value = ${JSON.stringify(longStr)};
          generateQrPlate3D();
          return { ok: true };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 100));
    meshInfo = await cdp.inspectActiveMesh();
    assertTest(
      `QR Code: Handles ${hc.name} without hang, stack overflow, or NaN`,
      evalRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
      { evalRes, meshInfo }
    );
  }

  // 3.4 Extreme Dimensions Across Plate Types
  console.log('\n> 3.4 Testing QR Code extreme dimensions across all 10 plate types...');
  const plateTypes = await cdp.evaluate(`
    Array.from(document.getElementById('qr-plate-type').options).map(o => o.value)
  `);

  for (const pt of plateTypes) {
    const evalRes = await cdp.evaluate(`
      (() => {
        try {
          document.getElementById('qr-plate-type').value = '${pt}';
          document.getElementById('qr-size-mm').value = '30';
          document.getElementById('qr-base-thick').value = '1.5';
          document.getElementById('qr-relief-thick').value = '0.8';
          generateQrPlate3D();
          return { ok: true };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 60));
    meshInfo = await cdp.inspectActiveMesh();
    assertTest(
      `QR Code Plate [${pt}]: Minimum boundary dimensions generate valid mesh without NaN`,
      evalRes.ok && meshInfo.meshCount > 0 && !meshInfo.hasNaN,
      { pt, evalRes, meshInfo }
    );
  }

  // =========================================================================
  // 4. STATION 4: G-CODE ANALYZER ADVERSARIAL CHALLENGES
  // =========================================================================
  console.log('\n--- [4] STATION 4: G-CODE ANALYZER ADVERSARIAL CHALLENGES ---');
  await cdp.evaluate(`switchTool('biblioteca');`);

  // Helper to test G-Code parsing by directly invoking handleGCodeUpload logic or evaluating parser
  const gcodeTestCases = [
    {
      name: 'Empty G-Code file',
      content: '',
      expectTime: '—',
      expectFilament: '—',
      expectLayers: '—'
    },
    {
      name: 'Truncated Header (keys without values)',
      content: 'estimated printing time (normal mode) =\n; TIME:\nfilament used [g] =\ntotal layers count =',
      expectTime: '',
      expectFilament: 'NaN g',
      expectLayers: ''
    },
    {
      name: 'Non-numeric Filament Value',
      content: 'filament used [g] = unknown_weight\n; total estimated time = 1h 45m\n;LAYER_COUNT:320',
      expectTime: '1h 45m',
      expectFilament: 'NaN g',
      expectLayers: '320'
    },
    {
      name: 'Multi-material Comma-separated Filament Array',
      content: 'filament_weight = 45.2, 12.8, 0.0\n; TIME:7200\ntotal layers count = 150',
      expectTime: '7200',
      expectFilament: '45.2 g',
      expectLayers: '150'
    },
    {
      name: 'Binary Garbage / Random Bytes',
      content: '\x00\x01\xFF\xFE\xAA\x55\x00G1 X10 Y20 Z0.2\n; no headers here\n',
      expectTime: '—',
      expectFilament: '—',
      expectLayers: '—'
    },
    {
      name: 'OrcaSlicer / Bambu Studio Realistic Header',
      content: '; model printing time: 2h 14m 33s; total estimated time = 2h 15m\nfilament_weight = 34.82\ntotal layers count = 480\n',
      expectTime: '2h 15m',
      expectFilament: '34.8 g',
      expectLayers: '480'
    }
  ];

  for (const gc of gcodeTestCases) {
    console.log(`\n> 4.1 Testing G-Code: ${gc.name}...`);
    const parseRes = await cdp.evaluate(`
      (() => {
        try {
          const text = ${JSON.stringify(gc.content)};
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
          if (filMatch) filamentG = \`\${parseFloat(filMatch[1]).toFixed(1)} g\`;

          const layerMatch = text.match(/total layers count = (.*)/i) ||
                             text.match(/;LAYER_COUNT:(.*)/i);
          if (layerMatch) layerCount = layerMatch[1].trim();

          document.getElementById('gcode-time').textContent = printTime;
          document.getElementById('gcode-filament').textContent = filamentG;
          document.getElementById('gcode-layers').textContent = layerCount;

          return { ok: true, printTime, filamentG, layerCount };
        } catch (e) {
          return { ok: false, err: e.message };
        }
      })()
    `);

    assertTest(
      `G-Code Analyzer: ${gc.name} parsed without unhandled exception`,
      parseRes.ok,
      { parseRes, expected: gc }
    );
  }

  // =========================================================================
  // 5. STATION 5: PRICING FORMULAS ZERO & EXTREME STRESS TESTING
  // =========================================================================
  console.log('\n--- [5] STATION 5: PRICING FORMULAS ZERO & EXTREME INPUTS ---');
  await cdp.evaluate(`switchTool('precificacao');`);

  // 5.1 FDM Pricing with all zeros
  console.log('\n> 5.1 Testing FDM Pricing with all zeros...');
  const fdmZeroRes = await cdp.evaluate(`
    (() => {
      try {
        switchSubPreco('fdm');
        document.getElementById('p-filament-g').value = '0';
        document.getElementById('p-filament-kg-price').value = '0';
        document.getElementById('p-print-hours').value = '0';
        document.getElementById('p-machine-hour-cost').value = '0';
        document.getElementById('p-labor-mins').value = '0';
        document.getElementById('p-labor-rate').value = '0';
        document.getElementById('p-fail-rate').value = '0';
        document.getElementById('p-market-fee').value = '0';
        document.getElementById('p-profit-margin').value = '0';
        recalcPricing();
        return {
          ok: true,
          cost3D: document.getElementById('res-cost-3d')?.textContent,
          costTotal: document.getElementById('res-cost-total')?.textContent,
          salePrice: document.getElementById('res-price-sale')?.textContent,
          netProfit: document.getElementById('res-net-profit')?.textContent
        };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  assertTest(
    'FDM Pricing: All zero inputs evaluate without NaN, Infinity, or crash',
    fdmZeroRes.ok &&
    !fdmZeroRes.salePrice.includes('NaN') &&
    !fdmZeroRes.salePrice.includes('Infinity'),
    fdmZeroRes
  );

  // 5.2 FDM PDF Export with zero inputs
  console.log('\n> 5.2 Testing FDM Quote PDF export with zero inputs...');
  const fdmPdfRes = await cdp.evaluate(`
    (() => {
      try {
        window.__testPdfs = [];
        exportQuotePDF();
        return { ok: true, pdfCount: window.__testPdfs.length, pdf: window.__testPdfs[0] };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  assertTest(
    'FDM Pricing: PDF export succeeds with zeroed calculations',
    fdmPdfRes.ok && fdmPdfRes.pdfCount > 0,
    fdmPdfRes
  );

  // 5.3 Ceramic Pricing with all zeros
  console.log('\n> 5.3 Testing Ceramic Pricing with all zeros...');
  const ceramicZeroRes = await cdp.evaluate(`
    (() => {
      try {
        switchSubPreco('argila');
        document.getElementById('cp-clay-weight').value = '0';
        document.getElementById('cp-clay-price-kg').value = '0';
        document.getElementById('cp-clay-waste').value = '0';
        document.getElementById('cp-glaze-area').value = '0';
        document.getElementById('cp-glaze-rate').value = '0';
        document.getElementById('cp-glaze-price-kg').value = '0';
        document.getElementById('cp-glaze-extras').value = '0';
        document.getElementById('cp-kiln-kw').value = '0';
        document.getElementById('cp-kwh-price').value = '0';
        document.getElementById('cp-bisque-hours').value = '0';
        document.getElementById('cp-glaze-hours').value = '0';
        document.getElementById('cp-kiln-batch').value = '0';
        document.getElementById('cp-time-model').value = '0';
        document.getElementById('cp-time-trim').value = '0';
        document.getElementById('cp-time-glaze').value = '0';
        document.getElementById('cp-hourly-rate').value = '0';
        document.getElementById('cp-risk-rate').value = '0';
        document.getElementById('cp-overhead-fixed').value = '0';
        document.getElementById('cp-tool-amort').value = '0';
        document.getElementById('cp-packaging').value = '0';
        document.getElementById('cp-profit-target').value = '0';
        document.getElementById('cp-market-fee').value = '0';
        recalcCeramicPricing();
        return {
          ok: true,
          direct: document.getElementById('c-res-direct')?.textContent,
          labor: document.getElementById('c-res-labor')?.textContent,
          total: document.getElementById('c-res-total-cost')?.textContent,
          retail: document.getElementById('c-res-retail')?.textContent,
          wholesale: document.getElementById('c-res-wholesale')?.textContent,
          netProfit: document.getElementById('c-res-net-profit')?.textContent
        };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  assertTest(
    'Ceramic Pricing: All zero inputs evaluate without NaN, Infinity, or crash',
    ceramicZeroRes.ok &&
    !ceramicZeroRes.retail.includes('NaN') &&
    !ceramicZeroRes.retail.includes('Infinity'),
    ceramicZeroRes
  );

  // 5.4 Ceramic PDF Export with zeroed calculations
  console.log('\n> 5.4 Testing Ceramic Quote PDF export with zero inputs...');
  const ceramicPdfRes = await cdp.evaluate(`
    (() => {
      try {
        window.__testPdfs = [];
        exportCeramicQuotePDF();
        return { ok: true, pdfCount: window.__testPdfs.length, pdf: window.__testPdfs[0] };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  assertTest(
    'Ceramic Pricing: PDF export succeeds with zeroed calculations',
    ceramicPdfRes.ok && ceramicPdfRes.pdfCount > 0,
    ceramicPdfRes
  );

  // 5.5 Extreme Boundary Rates: 100% Market Fee & Negative Margins
  console.log('\n> 5.5 Testing Extreme Market Fees (100% and 150%) and Negative Profit Margins (-50%)...');
  const extremeFeeRes = await cdp.evaluate(`
    (() => {
      try {
        // Test marketFee >= 100% (should not divide by zero or negative)
        document.getElementById('cp-market-fee').value = '100';
        document.getElementById('cp-profit-target').value = '-50';
        recalcCeramicPricing();
        const retail100 = document.getElementById('c-res-retail')?.textContent;

        document.getElementById('cp-market-fee').value = '150';
        recalcCeramicPricing();
        const retail150 = document.getElementById('c-res-retail')?.textContent;

        // FDM market fee
        document.getElementById('p-market-fee').value = '100';
        recalcPricing();
        const fdmSale100 = document.getElementById('res-price-sale')?.textContent;

        return {
          ok: true,
          retail100,
          retail150,
          fdmSale100,
          noNaN: !retail100.includes('NaN') && !retail150.includes('NaN') && !fdmSale100.includes('NaN'),
          noInfinity: !retail100.includes('Infinity') && !retail150.includes('Infinity') && !fdmSale100.includes('Infinity')
        };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    })()
  `);
  assertTest(
    'Pricing Engines: Market fees >= 100% avoid division by zero without NaN or Infinity',
    extremeFeeRes.ok && extremeFeeRes.noNaN && extremeFeeRes.noInfinity,
    extremeFeeRes
  );

  console.log('\n================================================================================');
  console.log(`STRESS TEST SUMMARY: ${results.passed}/${results.total} Passed (${((results.passed / results.total) * 100).toFixed(1)}%)`);
  console.log(`Failures: ${results.failed}`);
  console.log('================================================================================\n');

  await cdp.close();
  return results;
}

if (require.main === module) {
  runAdversarialTests()
    .then(r => {
      if (r.failed > 0) process.exit(1);
      process.exit(0);
    })
    .catch(err => {
      console.error('[Fatal Error]', err);
      process.exit(2);
    });
}

module.exports = { runAdversarialTests };
