const { CDPHarness } = require('./cdp_harness');

async function verifyLote10() {
  const harness = new CDPHarness();
  console.log('🚀 Iniciando verificação do Lote 10 (#91 ao #100) via CDP...');
  
  try {
    await harness.init('http://127.0.0.1:8080/index.html');

    const rawResult = await harness.evaluate(`
      (() => {
        const results = [];
        const fn = window.loadCatalogPiece || loadCatalogPiece;
        const catalog = window.STUDIO_100_CATALOG || STUDIO_100_CATALOG;
        const slabDefs = window.SLAB_PIECES_DEFINITIONS || SLAB_PIECES_DEFINITIONS;

        for (let id = 91; id <= 100; id++) {
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

            const patterns = typeof getActivePatternItemsForA4 === 'function' ? getActivePatternItemsForA4() : [];

            results.push({
              id,
              key: piece ? piece.key : 'unknown',
              title: piece ? piece.title : 'unknown',
              method: piece ? piece.method : 'unknown',
              isSlabModel: Boolean(piece && (piece.isSlabModel || slabDefs[piece.key])),
              dimensions: [
                parseFloat(size.x.toFixed(1)),
                parseFloat(size.y.toFixed(1)),
                parseFloat(size.z.toFixed(1))
              ],
              expectedH: piece ? piece.totalH : null,
              expectedMaxR: piece ? piece.maxR : null,
              totalVerts,
              totalFaces: Math.round(totalFaces),
              patternCount: patterns.length,
              hasNaN,
              meshCount: group.children.length,
              ok: totalVerts > 0 && !hasNaN
            });
          } catch (err) {
            results.push({ id, ok: false, error: err.message });
          }
        }

        return JSON.stringify(results);
      })()
    `);

    const results = JSON.parse(rawResult);
    console.log('\n📊 RESULTADOS DETALHADOS DO LOTE 10:');
    let passed = 0;

    results.forEach(r => {
      if (r.ok) {
        passed++;
        console.log(`✅ [OK] #${r.id} ${r.key} (${r.method})`);
        console.log(`       Dimensões 3D: [${r.dimensions[0]} x ${r.dimensions[1]} x ${r.dimensions[2]} mm] (H esperada: ${r.expectedH} mm)`);
        console.log(`       Geometria: ${r.totalVerts} vértices, ${r.totalFaces} faces, ${r.meshCount} meshes | Moldes 2D: ${r.patternCount}`);
      } else {
        console.error(`❌ [FALHA] #${r.id} ${r.key || ''}: ${r.error || 'Erro na geometria (NaN ou vértices vazios)'}`);
      }
    });

    console.log(`\n🏁 Total Aprovados: ${passed}/${results.length}`);
    if (passed !== results.length) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Erro na execução do teste:', err);
    process.exit(1);
  } finally {
    await harness.close();
  }
}

verifyLote10();
