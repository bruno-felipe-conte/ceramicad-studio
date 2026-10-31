/**
 * Test Reporter for CeramiCAD Studio Pro
 * Formats results in structured JSON and markdown/text tables matching AUDIT_REPORT.md requirements.
 */

const fs = require('fs');
const path = require('path');

class TestReporter {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.consoleWarnings = [];
    this.consoleErrors = [];
  }

  record(testCase) {
    const entry = {
      id: testCase.id || `test_${this.results.length + 1}`,
      station: testCase.station || 1,
      subsystem: testCase.subsystem || 'General',
      item: testCase.item || testCase.id,
      expected: testCase.expected || 'Success',
      actual: testCase.actual || '',
      status: testCase.status || 'PASS', // 'PASS' | 'FAIL'
      error: testCase.error || null,
      details: testCase.details || {},
      durationMs: testCase.durationMs || 0
    };
    this.results.push(entry);

    const icon = entry.status === 'PASS' ? '✅' : '❌';
    console.log(`[${icon} ${entry.status}] [St.${entry.station} - ${entry.subsystem}] ${entry.item}: ${entry.actual}`);
    return entry;
  }

  recordConsoleLogs(logs = [], errors = []) {
    this.consoleWarnings.push(...logs.filter(l => l.type === 'warning'));
    this.consoleErrors.push(...errors);
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const durationMs = Date.now() - this.startTime;

    const byStation = {};
    for (let s = 1; s <= 5; s++) {
      const stResults = this.results.filter(r => r.station === s);
      byStation[`Station ${s}`] = {
        total: stResults.length,
        passed: stResults.filter(r => r.status === 'PASS').length,
        failed: stResults.filter(r => r.status === 'FAIL').length
      };
    }

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '0%',
      durationSeconds: (durationMs / 1000).toFixed(2),
      byStation,
      consoleErrorsCount: this.consoleErrors.length
    };
  }

  generateMarkdownMatrix() {
    const summary = this.getSummary();
    let md = `# Relatório de Auditoria Automatizada — CeramiCAD Studio Pro\n\n`;
    md += `**Data**: ${new Date().toISOString()}\n`;
    md += `**Total de Testes**: ${summary.total} | **Aprovados**: ${summary.passed} | **Falhas**: ${summary.failed} | **Taxa de Sucesso**: ${summary.passRate}\n`;
    md += `**Tempo de Execução**: ${summary.durationSeconds}s | **Erros de Console**: ${summary.consoleErrorsCount}\n\n`;

    md += `## Resumo por Estação\n\n`;
    md += `| Estação | Total | Aprovados | Falhas | Taxa |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const [st, stats] of Object.entries(summary.byStation)) {
      const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) + '%' : '0%';
      md += `| **${st}** | ${stats.total} | ${stats.passed} | ${stats.failed} | ${rate} |\n`;
    }
    md += `\n---\n\n`;

    for (let s = 1; s <= 5; s++) {
      const stResults = this.results.filter(r => r.station === s);
      if (stResults.length === 0) continue;

      const stationNames = {
        1: 'Estação 1: Olaria & Vasos 3D (#panel-vasos)',
        2: 'Estação 2: Cortadores & Ejetores 3D (#panel-cortadores)',
        3: 'Estação 3: Texturas & Utilitários (#panel-utilitarios)',
        4: 'Estação 4: Biblioteca & Inspetor (#panel-biblioteca)',
        5: 'Estação 5: Precificador Ateliê (#panel-precificacao)'
      };

      md += `## ${stationNames[s]}\n\n`;
      md += `| Item / Controle (ID) | Subsistema | Comportamento Esperado | Comportamento Executado | Status |\n`;
      md += `|---|---|---|---|---|\n`;

      for (const r of stResults) {
        const cleanActual = String(r.actual).replace(/\|/g, '\\|');
        const cleanExpected = String(r.expected).replace(/\|/g, '\\|');
        const badge = r.status === 'PASS' ? '✅ Atingiu o Esperado' : '❌ Falha Detectada';
        md += `| \`${r.id}\`<br>**${r.item}** | ${r.subsystem} | ${cleanExpected} | ${cleanActual} | ${badge} |\n`;
      }
      md += `\n`;
    }

    if (this.consoleErrors.length > 0) {
      md += `## Erros e Exceções de Console Registrados\n\n`;
      for (const err of this.consoleErrors) {
        md += `- **[${err.type}]**: ${err.text || JSON.stringify(err)}\n`;
      }
      md += `\n`;
    }

    return md;
  }

  saveOutputs(resultsDir = null) {
    const targetDir = resultsDir || path.join(__dirname, 'results');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const summary = this.getSummary();
    const fullJson = {
      timestamp: new Date().toISOString(),
      summary,
      results: this.results,
      consoleErrors: this.consoleErrors
    };

    const jsonPath = path.join(targetDir, 'test_results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(fullJson, null, 2), 'utf-8');

    const mdPath = path.join(targetDir, 'test_results.md');
    fs.writeFileSync(mdPath, this.generateMarkdownMatrix(), 'utf-8');

    const txtPath = path.join(targetDir, 'test_results.txt');
    let txt = `================================================================================\n`;
    txt += `CERAMICAD STUDIO PRO — AUTOMATED TEST SUITE REPORT\n`;
    txt += `Timestamp: ${new Date().toISOString()}\n`;
    txt += `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Pass Rate: ${summary.passRate}\n`;
    txt += `================================================================================\n\n`;
    for (const r of this.results) {
      txt += `[${r.status}] [St.${r.station} - ${r.subsystem}] ${r.item} (${r.id})\n`;
      txt += `  Expected: ${r.expected}\n`;
      txt += `  Actual:   ${r.actual}\n`;
      if (r.error) txt += `  Error:    ${r.error}\n`;
      txt += `\n`;
    }
    fs.writeFileSync(txtPath, txt, 'utf-8');

    console.log(`[TestReporter] Results saved:`);
    console.log(` - JSON: ${jsonPath}`);
    console.log(` - Markdown: ${mdPath}`);
    console.log(` - Text: ${txtPath}`);

    return { jsonPath, mdPath, txtPath, summary };
  }
}

module.exports = { TestReporter };
