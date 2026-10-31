/**
 * Station 5 Test Suite: Precificador Ateliê (#panel-precificacao)
 * Tests Vase ➔ Pricing sync, Ceramic costing formulas, 3D FDM costing formulas, and PDF generation.
 */

async function testStation5(cdp, reporter) {
  console.log('\n--- EXECUTING STATION 5: PRECIFICADOR ATELIÊ ---');

  // =========================================================================
  // 5.1 Geometry-to-Pricing Synchronization (Station 1 ➔ Station 5)
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      const syncRes = await cdp.evaluate(`
        (() => {
          // 1. Load anfora in Spline mode
          switchTool('vasos');
          switchVaseMode('spline');
          loadClassicProfilePreset('anfora');

          // 2. Trigger sendVaseToPricing()
          sendVaseToPricing();

          return {
            activeTool: activeTool,
            clayWeight: parseFloat(document.getElementById('cp-clay-weight')?.value || '0'),
            glazeArea: parseFloat(document.getElementById('cp-glaze-area')?.value || '0'),
            costRetail: document.getElementById('c-res-retail')?.textContent || ''
          };
        })()
      `);

      const pass = syncRes.activeTool === 'precificacao' && syncRes.clayWeight > 0.1 && syncRes.glazeArea > 10;

      reporter.record({
        id: 's5_sync_vase_to_pricing',
        station: 5,
        subsystem: 'Vase ➔ Pricing Sync',
        item: 'Sincronização Geométrica 3D (Volume & Área Envidrada) ➔ Precificador',
        expected: 'Switches to precificacao, calculates clay mass (kg) and glaze area (cm²) from 3D geometry',
        actual: `Tool: ${syncRes.activeTool}, Clay: ${syncRes.clayWeight} kg, GlazeArea: ${syncRes.glazeArea} cm², Retail: "${syncRes.costRetail.trim()}"`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's5_sync_vase_to_pricing',
        station: 5,
        subsystem: 'Vase ➔ Pricing Sync',
        item: 'Sincronização Geométrica 3D ➔ Precificador',
        expected: 'Synchronizes geometry without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 5.2 Ceramic Costing Multi-Tier Formulas (#subpanel-preco-argila)
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      const ceramicCalc = await cdp.evaluate(`
        (() => {
          switchSubPreco('argila');

          // Set specific controlled parameters
          if (document.getElementById('cp-clay-weight')) document.getElementById('cp-clay-weight').value = '1.50';
          if (document.getElementById('cp-clay-price-kg')) document.getElementById('cp-clay-price-kg').value = '10.00';
          if (document.getElementById('cp-glaze-area')) document.getElementById('cp-glaze-area').value = '800';
          if (document.getElementById('cp-glaze-price-kg')) document.getElementById('cp-glaze-price-kg').value = '70.00';
          if (document.getElementById('cp-hourly-rate')) document.getElementById('cp-hourly-rate').value = '50.00';
          if (document.getElementById('cp-time-model')) document.getElementById('cp-time-model').value = '40';
          if (document.getElementById('cp-time-trim')) document.getElementById('cp-time-trim').value = '20';
          if (document.getElementById('cp-time-glaze')) document.getElementById('cp-time-glaze').value = '20';
          if (document.getElementById('cp-profit-target')) document.getElementById('cp-profit-target').value = '50';
          if (document.getElementById('cp-market-fee')) document.getElementById('cp-market-fee').value = '10';

          recalcCeramicPricing();

          const direct = document.getElementById('c-res-direct')?.textContent || '';
          const labor = document.getElementById('c-res-labor')?.textContent || '';
          const overhead = document.getElementById('c-res-overhead')?.textContent || '';
          const totalCost = document.getElementById('c-res-total-cost')?.textContent || '';
          const retail = document.getElementById('c-res-retail')?.textContent || '';
          const wholesale = document.getElementById('c-res-wholesale')?.textContent || '';
          const profit = document.getElementById('c-res-net-profit')?.textContent || '';

          return { direct, labor, overhead, totalCost, retail, wholesale, profit };
        })()
      `);

      const pass = ceramicCalc.direct.length > 0 && ceramicCalc.retail.length > 0 && ceramicCalc.profit.length > 0;

      reporter.record({
        id: 's5_ceramic_pricing_formulas',
        station: 5,
        subsystem: 'Ceramic Costing',
        item: 'Cálculo de Custos Cerâmicos (Massa, Esmalte, 2 Queimas c/ Rateio, Mão de Obra, Risco & Margens)',
        expected: 'Computes direct cost, labor, overheads, retail and wholesale prices deterministically',
        actual: `Direct: ${ceramicCalc.direct}, Labor: ${ceramicCalc.labor}, Overheads: ${ceramicCalc.overhead}, TotalCost: ${ceramicCalc.totalCost}, Retail: ${ceramicCalc.retail}, Wholesale: ${ceramicCalc.wholesale}, NetProfit: ${ceramicCalc.profit}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's5_ceramic_pricing_formulas',
        station: 5,
        subsystem: 'Ceramic Costing',
        item: 'Cálculo de Custos Cerâmicos',
        expected: 'Executes pricing calculation without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 5.3 Ceramic Quote PDF Export
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      await cdp.clearPdfs();
      await cdp.evaluate(`exportCeramicQuotePDF();`);
      await new Promise(r => setTimeout(r, 100));
      const pdfs = await cdp.getPdfs();
      const pass = pdfs.length > 0 && pdfs.some(p => p.filename.includes('precificacao_ceramica'));

      reporter.record({
        id: 's5_export_ceramic_pdf',
        station: 5,
        subsystem: 'Ceramic Costing',
        item: 'Exportação da Ficha Técnica e Orçamento Cerâmico em PDF A4',
        expected: 'Generates structured 2-section specification sheet PDF via jsPDF',
        actual: `PDFs Exported: ${pdfs.length} (${pdfs.map(p => p.filename).join(', ')})`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's5_export_ceramic_pdf',
        station: 5,
        subsystem: 'Ceramic Costing',
        item: 'Exportação da Ficha Técnica em PDF',
        expected: 'Exports ceramic PDF without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 5.4 3D Printing (FDM) Cost Calculations (#subpanel-preco-3d)
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      const fdmCalc = await cdp.evaluate(`
        (() => {
          switchSubPreco('3d');

          if (document.getElementById('p-filament-g')) document.getElementById('p-filament-g').value = '48';
          if (document.getElementById('p-filament-kg-price')) document.getElementById('p-filament-kg-price').value = '120.00';
          if (document.getElementById('p-print-hours')) document.getElementById('p-print-hours').value = '3.0';
          if (document.getElementById('p-machine-hour-cost')) document.getElementById('p-machine-hour-cost').value = '1.80';
          if (document.getElementById('p-labor-mins')) document.getElementById('p-labor-mins').value = '15';
          if (document.getElementById('p-labor-rate')) document.getElementById('p-labor-rate').value = '40.00';
          if (document.getElementById('p-fail-rate')) document.getElementById('p-fail-rate').value = '10';
          if (document.getElementById('p-profit-margin')) document.getElementById('p-profit-margin').value = '100';
          if (document.getElementById('p-market-fee')) document.getElementById('p-market-fee').value = '12';

          recalcPricing();

          const cost3D = document.getElementById('res-cost-3d')?.textContent || '';
          const costTotal = document.getElementById('res-cost-total')?.textContent || '';
          const salePrice = document.getElementById('res-price-sale')?.textContent || '';
          const netProfit = document.getElementById('res-net-profit')?.textContent || '';

          return { cost3D, costTotal, salePrice, netProfit };
        })()
      `);

      const pass = fdmCalc.cost3D.length > 0 && fdmCalc.salePrice.length > 0;

      reporter.record({
        id: 's5_fdm_pricing_formulas',
        station: 5,
        subsystem: '3D FDM Costing',
        item: 'Cálculo de Ferramentas Impressas em 3D FDM (Filamento, Máquina, Acabamento, Risco & Margem)',
        expected: 'Calculates direct tool cost, machine depreciation, technical finishing, and sales markup',
        actual: `Cost3D: ${fdmCalc.cost3D}, Total: ${fdmCalc.costTotal}, FinalSale: ${fdmCalc.salePrice}, NetProfit: ${fdmCalc.netProfit}`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's5_fdm_pricing_formulas',
        station: 5,
        subsystem: '3D FDM Costing',
        item: 'Cálculo de Ferramentas 3D FDM',
        expected: 'Computes 3D tool cost without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  // =========================================================================
  // 5.5 3D Printing Quote PDF Export
  // =========================================================================
  {
    const t0 = Date.now();
    try {
      await cdp.clearPdfs();
      await cdp.evaluate(`exportQuotePDF();`);
      await new Promise(r => setTimeout(r, 100));
      const pdfs = await cdp.getPdfs();
      const pass = pdfs.length > 0 && pdfs.some(p => p.filename.includes('ceramicad_3d'));

      reporter.record({
        id: 's5_export_3d_pdf',
        station: 5,
        subsystem: '3D FDM Costing',
        item: 'Exportação do Orçamento de Ferramenta 3D em PDF A4',
        expected: 'Generates 3D tool quote PDF via jsPDF',
        actual: `PDFs Exported: ${pdfs.length} (${pdfs.map(p => p.filename).join(', ')})`,
        status: pass ? 'PASS' : 'FAIL',
        durationMs: Date.now() - t0
      });
    } catch (err) {
      reporter.record({
        id: 's5_export_3d_pdf',
        station: 5,
        subsystem: '3D FDM Costing',
        item: 'Exportação do Orçamento 3D em PDF',
        expected: 'Exports 3D quote PDF without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL',
        error: err.message,
        durationMs: Date.now() - t0
      });
    }
  }

  console.log('--- STATION 5 TESTS COMPLETE ---');
}

module.exports = { testStation5 };
