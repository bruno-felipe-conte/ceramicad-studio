const { CDPHarness } = require('./cdp_harness.js');

async function profileApp() {
  const cdp = new CDPHarness({ httpPort: 8080, cdpPort: 9299 });
  await cdp.init();

  console.log('[Profile] Evaluating app state...');

  // 1. Verificar console errors iniciais
  console.log('[Profile] Console errors:', cdp.consoleErrors);
  console.log('[Profile] Exceptions:', cdp.exceptions);

  // 2. Medir tempo de rebuildVase()
  const perfData = await cdp.evaluate(`
    (() => {
      const times = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        rebuildVase();
        times.push(performance.now() - t0);
      }
      return {
        avgRebuildMs: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
        times
      };
    })()
  `);
  console.log('[Profile] rebuildVase performance:', perfData);

  // 3. Medir tempo de packPatternsToA4Sheets()
  const packPerf = await cdp.evaluate(`
    (() => {
      const rings = computeFrustumRings();
      const items = prepareAllVasePatternItems(rings);
      const t0 = performance.now();
      const packed = packPatternsToA4Sheets(items, 182, 253, 20);
      const duration = performance.now() - t0;
      return {
        itemCount: items.length,
        durationMs: duration.toFixed(1),
        sheetsCount: packed.sheets.length,
        oversizedCount: packed.oversized.length,
        oversizedLabels: packed.oversized.map(o => o.label)
      };
    })()
  `);
  console.log('[Profile] packPatternsToA4Sheets performance:', packPerf);

  // 4. Testar diferentes peças do catálogo e ver quantas páginas de PDF geram
  const piecesToTest = ['#9', 'bule', 'panela_barro', 'cantaro_kantharos', 'vaso_anfora'];
  for (const pieceKey of piecesToTest) {
    const res = await cdp.evaluate(`
      (() => {
        loadCatalogPiece('${pieceKey}');
        const items = getActivePatternItemsForA4();
        const packed = packPatternsToA4Sheets(items, 182, 253, 20);
        return {
          pieceKey: '${pieceKey}',
          itemCount: items.length,
          sheetsCount: packed.sheets.length,
          oversizedCount: packed.oversized.length,
          oversizedLabels: packed.oversized.map(o => o.label),
          itemLabels: items.map(it => it.label)
        };
      })()
    `);
    console.log(`[Profile] Piece ${pieceKey}:`, res);
  }

  await cdp.close();
}

profileApp().catch(err => {
  console.error('[Profile] Fatal Error:', err);
  process.exit(1);
});
