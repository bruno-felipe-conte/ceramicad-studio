const { CDPHarness } = require('./cdp_harness');

async function verifyLote8() {
  const harness = new CDPHarness();
  console.log('🚀 Iniciando verificação do Lote 8 (#71 ao #80) via CDP...');
  
  try {
    await harness.init('http://127.0.0.1:8080/index.html');

    const rawResult = await harness.evaluate(`
      (() => {
        const results = [];
        const fn = window.loadCatalogPiece || loadCatalogPiece;
        const catalog = window.STUDIO_100_CATALOG || STUDIO_100_CATALOG;

        for (let id = 71; id <= 80; id++) {
          try {
            fn(id);
            
            const piece = catalog.find(p => p.id === id);
            const group = window.activeMeshGroup || activeMeshGroup;
            
            if (!group || group.children.length === 0) {
              results.push({ id, ok: false, error: 'Nenhum mesh no activeMeshGroup' });
              continue;
            }

            const box = new THREE.Box3().setFromObject(group);
            const size = new THREE.Vector3();
            box.getSize(size);

            let totalVerts = 0;
            let totalFaces = 0;
            let hasNaN = false;

            group.traverse((child) => {
              if (child.isMesh && child.geometry) {
                const geo = child.geometry;
                const pos = geo.attributes.position;
                if (pos) {
                  totalVerts += pos.count;
                  totalFaces += geo.index ? geo.index.count / 3 : pos.count / 3;
                  for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const y = pos.getY(i);
                    const z = pos.getZ(i);
                    if (isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
                      hasNaN = true;
                    }
                  }
                }
              }
            });

            results.push({
              id,
              key: piece ? piece.key : 'unknown',
              title: piece ? piece.title : 'unknown',
              meshCount: group.children.length,
              totalVerts,
              totalFaces,
              hasNaN,
              bounds: {
                x: Math.round(size.x * 10) / 10,
                y: Math.round(size.y * 10) / 10,
                z: Math.round(size.z * 10) / 10,
                diametroMax: Math.round(Math.max(size.x, size.z) * 10) / 10,
                alturaH: Math.round(size.y * 10) / 10
              },
              expectedH: piece ? piece.totalH : 0,
              expectedMaxR: piece ? piece.maxR : 0,
              ok: !hasNaN && totalVerts > 0
            });
          } catch (e) {
            results.push({ id, ok: false, error: e.message });
          }
        }
        return results;
      })()
    `);

    const lote8Results = rawResult.result ? rawResult.result.value : rawResult;

    console.log('\n📊 RESULTADOS DA VERIFICAÇÃO 3D DO LOTE 8 (#71-#80):\n');
    console.table(lote8Results.map(r => ({
      ID: r.id,
      Chave: r.key,
      Título: r.title ? r.title.substring(0, 32) : (r.error || ''),
      Status: r.ok ? '✅ OK' : '❌ FALHA',
      'Bounds [X × Y × Z mm]': r.bounds ? `${r.bounds.x} × ${r.bounds.y} × ${r.bounds.z}` : '-',
      'H Real/Esp': r.bounds ? `${r.bounds.alturaH} / ${r.expectedH}` : '-',
      'Ø Real/Esp': r.bounds ? `${r.bounds.diametroMax} / ${r.expectedMaxR * 2}` : '-',
      Vértices: r.totalVerts || 0,
      Meshes: r.meshCount || 0,
      NaN: r.hasNaN ? 'SIM' : 'NÃO'
    })));

    const allOk = Array.isArray(lote8Results) && lote8Results.every(r => r.ok);
    console.log(`\n${allOk ? '🎉 TODOS OS 10 MODELOS DO LOTE 8 VALIDADOS COM SUCESSO!' : '⚠️ ALGUNS MODELOS APRESENTARAM FALHAS!'}\n`);

    await harness.close();
    process.exit(allOk ? 0 : 1);
  } catch (err) {
    console.error('❌ Erro na execução:', err);
    await harness.close();
    process.exit(1);
  }
}

verifyLote8();
