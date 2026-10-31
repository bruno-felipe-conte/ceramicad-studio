#!/usr/bin/env node
/**
 * CeramiCAD Studio Pro — Automated Opaque-Box E2E Test Runner
 *
 * Drives headless Chromium via native WebSocket Chrome DevTools Protocol (CDP)
 * with ANGLE/SwiftShader software WebGL.
 *
 * Usage:
 *   node tests/run_tests.js [--station 1|2|3|4|5|all] [--port 8099] [--cdp-port 9299] [--output-dir ./tests/results]
 */

const path = require('path');
const { CDPHarness } = require('./cdp_harness');
const { TestReporter } = require('./reporter');

const { testStation1 } = require('./stations/station1');
const { testStation2 } = require('./stations/station2');
const { testStation3 } = require('./stations/station3');
const { testStation4 } = require('./stations/station4');
const { testStation5 } = require('./stations/station5');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    station: 'all',
    httpPort: 8099,
    cdpPort: 9299,
    outputDir: path.join(__dirname, 'results'),
    keepAlive: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--station' && args[i + 1]) {
      options.station = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      options.httpPort = parseInt(args[++i], 10);
    } else if (arg === '--cdp-port' && args[i + 1]) {
      options.cdpPort = parseInt(args[++i], 10);
    } else if (arg === '--output-dir' && args[i + 1]) {
      options.outputDir = path.resolve(args[++i]);
    } else if (arg === '--keep-alive') {
      options.keepAlive = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  console.log('================================================================================');
  console.log('   CERAMICAD STUDIO PRO — AUTOMATED TEST RUNNER (CDP + SWIFTSHADER WEBGL)   ');
  console.log('================================================================================');
  console.log(`Config: HTTP Port ${options.httpPort} | CDP Port ${options.cdpPort} | Target Station: ${options.station}`);
  console.log(`Output Directory: ${options.outputDir}\n`);

  const cdp = new CDPHarness({
    httpPort: options.httpPort,
    cdpPort: options.cdpPort,
    workDir: path.resolve(__dirname, '..')
  });

  const reporter = new TestReporter();

  // Clean shutdown handlers
  let cleanedUp = false;
  async function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!options.keepAlive) {
      console.log('\n[Main] Terminating background processes...');
      await cdp.close();
    }
  }

  process.on('SIGINT', async () => {
    console.log('\n[Main] Interrupted (SIGINT)');
    await cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', async () => {
    console.log('\n[Main] Terminated (SIGTERM)');
    await cleanup();
    process.exit(143);
  });

  try {
    // 1. Initialize Headless Browser and Page
    await cdp.init();

    const target = String(options.station).toLowerCase();

    // 2. Execute requested stations
    if (target === 'all' || target === '1') {
      await testStation1(cdp, reporter);
    }
    if (target === 'all' || target === '2') {
      await testStation2(cdp, reporter);
    }
    if (target === 'all' || target === '3') {
      await testStation3(cdp, reporter);
    }
    if (target === 'all' || target === '4') {
      await testStation4(cdp, reporter);
    }
    if (target === 'all' || target === '5') {
      await testStation5(cdp, reporter);
    }

    // 3. Record console warnings and errors
    reporter.recordConsoleLogs(cdp.consoleLogs, cdp.consoleErrors);

    // 4. Save structured results
    console.log('\n================================================================================');
    console.log('                           SAVING TEST RESULTS                                  ');
    console.log('================================================================================');
    const outputs = reporter.saveOutputs(options.outputDir);

    // 5. Print final terminal summary
    const summary = outputs.summary;
    console.log('\n================================================================================');
    console.log(`TEST SUITE COMPLETED in ${summary.durationSeconds}s`);
    console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Pass Rate: ${summary.passRate}`);
    console.log(`Console Errors/Exceptions Logged: ${summary.consoleErrorsCount}`);
    console.log('================================================================================');

    for (const [st, stats] of Object.entries(summary.byStation)) {
      console.log(`  - ${st}: ${stats.passed}/${stats.total} passed (${stats.failed} failures)`);
    }
    console.log('================================================================================\n');

  } catch (err) {
    console.error('\n[FATAL ERROR in Test Runner]:', err);
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('[Unhandled]', err);
  process.exit(1);
});
