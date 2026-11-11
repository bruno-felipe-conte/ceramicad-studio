const { CDPHarness } = require('./cdp_harness');

async function verifyCopoTakeaway() {
  const harness = new CDPHarness();
  console.log('🚀 Iniciando verificação do Copo Take Away EVES Pottery (#15) via CDP...');
  
  try {
    await harness.init('http://127.0.0.1:8080/index.html');

    const result = await harness.evaluate(`
      (() => {
        try {
          const fn = window.loadCatalogPiece || loadCatalogPiece;
          const catalog = window.STUDIO_100_CATALOG || STUDIO_100_CATALOG;
          
          fn(15);
          
          const piece = catalog.find(p => p.id === 15);
          const group = window.activeMeshGroup || activeMeshGroup;
          
          if (!group || group.children.length === 0) {
            return { ok: false, error: 'Nenhum mesh no activeMeshGroup' };
          }

          const box = new THREE.Box3().setFromObject(group);
          const size = new THREE.Vector3();
          box.getSize(size);

          let totalVerts = 0;
          let totalFaces = 0;
          let hasNaN = false;
          const meshesInfo = [];

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
              meshesInfo.push({
                name: child.userData.partLabel || child.name || 'unnamed',
                verts: pos ? pos.count : 0
              });
            }
          });

          return {
            id: 15,
            key: piece ? piece.key : 'unknown',
            title: piece ? piece.title : 'unknown',
            meshCount: group.children.length,
            meshes: meshesInfo,
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
          };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      })()
    `);

    const r = result.result ? result.result.value : result;
    console.log('\n📊 RESULTADOS DA VERIFICAÇÃO 3D DO COPO TAKE AWAY:\n');
    console.log(JSON.stringify(r, null, 2));

    await harness.close();
    process.exit(r.ok ? 0 : 1);
  } catch (err) {
    console.error('❌ Erro na execução:', err);
    await harness.close();
    process.exit(1);
  }
}

verifyCopoTakeaway();
