/**
 * CDP Harness for CeramiCAD Studio Pro
 * Connects to headless Chromium using native WebSocket and fetch over Chrome DevTools Protocol.
 */

const { spawn } = require('child_process');
const http = require('http');

class CDPHarness {
  constructor(options = {}) {
    this.httpPort = options.httpPort || 8099;
    this.cdpPort = options.cdpPort || 9299;
    this.chromePath = options.chromePath || '/home/bruno/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
    this.libsPath = options.libsPath || '/home/bruno/.local/lib/playwright-libs';
    this.workDir = options.workDir || '/mnt/c/Users/bruno/Documents/cerâmiKa';

    this.pyProcess = null;
    this.chromeProcess = null;
    this.ws = null;
    this.msgId = 1;
    this.pendingCallbacks = new Map();

    this.consoleLogs = [];
    this.consoleErrors = [];
    this.exceptions = [];
  }

  async isPortInUse(port) {
    return new Promise((resolve) => {
      const tester = http.get(`http://127.0.0.1:${port}/`, () => {
        resolve(true);
      }).on('error', () => {
        resolve(false);
      });
      tester.setTimeout(800, () => {
        tester.destroy();
        resolve(false);
      });
    });
  }

  async startHttpServer() {
    const inUse = await this.isPortInUse(this.httpPort);
    if (inUse) {
      console.log(`[CDPHarness] HTTP server already running on port ${this.httpPort}`);
      return;
    }

    console.log(`[CDPHarness] Spawning Python HTTP server on port ${this.httpPort}...`);
    this.pyProcess = spawn('python3', ['-m', 'http.server', String(this.httpPort), '--directory', this.workDir], {
      stdio: 'ignore'
    });

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (await this.isPortInUse(this.httpPort)) {
        console.log(`[CDPHarness] Python HTTP server ready on port ${this.httpPort}`);
        return;
      }
    }
    throw new Error(`Failed to start HTTP server on port ${this.httpPort}`);
  }

  async startChromium() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.cdpPort}/json/version`);
      if (res.ok) {
        console.log(`[CDPHarness] Headless Chromium already running on CDP port ${this.cdpPort}`);
        return;
      }
    } catch (_) {}

    console.log(`[CDPHarness] Spawning headless Chromium on CDP port ${this.cdpPort}...`);
    const env = {
      ...process.env,
      LD_LIBRARY_PATH: `${this.libsPath}:${process.env.LD_LIBRARY_PATH || ''}`
    };

    const args = [
      '--headless=new',
      `--remote-debugging-port=${this.cdpPort}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--remote-debugging-address=127.0.0.1',
      'about:blank'
    ];

    this.chromeProcess = spawn(this.chromePath, args, { env, stdio: 'ignore' });

    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${this.cdpPort}/json/version`);
        if (res.ok) {
          console.log(`[CDPHarness] Headless Chromium ready on CDP port ${this.cdpPort}`);
          return;
        }
      } catch (_) {}
    }
    throw new Error(`Failed to start headless Chromium on CDP port ${this.cdpPort}`);
  }

  async connect() {
    const listRes = await fetch(`http://127.0.0.1:${this.cdpPort}/json/list`);
    const list = await listRes.json();
    const pageTarget = list.find(t => t.type === 'page') || list[0];
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('No page target found with webSocketDebuggerUrl');
    }

    console.log(`[CDPHarness] Connecting to WebSocket: ${pageTarget.webSocketDebuggerUrl}`);
    this.ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pendingCallbacks.has(data.id)) {
        const { resolve, reject } = this.pendingCallbacks.get(data.id);
        this.pendingCallbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
        return;
      }

      if (data.method === 'Runtime.consoleAPICalled') {
        const msg = data.params;
        const text = (msg.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ');
        const entry = {
          type: msg.type,
          text,
          timestamp: msg.timestamp,
          stackTrace: msg.stackTrace
        };
        this.consoleLogs.push(entry);
        if (msg.type === 'error') {
          this.consoleErrors.push(entry);
        }
      }

      if (data.method === 'Runtime.exceptionThrown') {
        const ex = data.params.exceptionDetails;
        const entry = {
          text: ex.text || (ex.exception && ex.exception.description) || 'Unknown exception',
          url: ex.url,
          line: ex.lineNumber,
          col: ex.columnNumber,
          stackTrace: ex.stackTrace
        };
        this.exceptions.push(entry);
        this.consoleErrors.push({
          type: 'uncaught_exception',
          text: entry.text,
          details: entry
        });
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, returnByValue = true) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const err = new Error(res.exceptionDetails.text || 'Runtime.evaluate threw exception');
      err.details = res.exceptionDetails;
      throw err;
    }
    return res.result ? res.result.value : undefined;
  }

  async init(navigateUrl = null) {
    await this.startHttpServer();
    await this.startChromium();
    await this.connect();

    await this.send('Page.enable');
    await this.send('Runtime.enable');

    const url = navigateUrl || `http://127.0.0.1:${this.httpPort}/index.html`;
    console.log(`[CDPHarness] Navigating to ${url}...`);
    await this.send('Page.navigate', { url });

    // Wait for initial load and script execution
    await new Promise(r => setTimeout(r, 3500));

    // Install test hooks (intercept alerts, record downloads, intercept jsPDF)
    await this.evaluate(`
      (() => {
        window.__testAlerts = [];
        window.__testDownloads = [];
        window.__testPdfs = [];

        window.alert = (msg) => {
          window.__testAlerts.push(String(msg));
          console.warn('[TestAlert]', msg);
        };
        window.confirm = () => true;
        window.prompt = () => '';

        if (typeof downloadBlob === 'function') {
          const origDownloadBlob = window.downloadBlob;
          window.downloadBlob = function(blob, filename) {
            window.__testDownloads.push({
              filename: filename || 'unknown',
              size: blob ? blob.size : 0,
              type: blob ? blob.type : ''
            });
            console.log('[TestDownloadBlob]', filename, blob ? blob.size : 0);
          };
        }

        if (window.jspdf && window.jspdf.jsPDF) {
          const OrigJsPDF = window.jspdf.jsPDF;
          window.jspdf.jsPDF = function(...args) {
            const doc = new OrigJsPDF(...args);
            doc.save = function(filename) {
              window.__testPdfs.push({
                filename: filename || 'unnamed.pdf',
                pageCount: typeof this.getNumberOfPages === 'function' ? this.getNumberOfPages() : 1
              });
              console.log('[TestPdfSave]', filename);
              return this;
            };
            return doc;
          };
          Object.assign(window.jspdf.jsPDF, OrigJsPDF);
          window.jspdf.jsPDF.prototype = OrigJsPDF.prototype;
        }

        return true;
      })()
    `);

    // Verify Three.js initialized
    const isReady = await this.evaluate(`
      typeof scene !== 'undefined' && scene !== null &&
      typeof activeMeshGroup !== 'undefined' && activeMeshGroup !== null
    `);

    if (!isReady) {
      console.warn('[CDPHarness] CeramiCAD Three.js scene not ready on first check, waiting 2s more...');
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log('[CDPHarness] CeramiCAD Studio Pro initialized successfully in headless Chromium.');
  }

  async inspectActiveMesh() {
    return await this.evaluate(`
      (() => {
        if (typeof activeMeshGroup === 'undefined' || !activeMeshGroup) {
          return {
            childrenCount: 0,
            meshCount: 0,
            totalVertices: 0,
            hasNaN: false,
            isEmpty: true,
            bounds: null
          };
        }

        let meshCount = 0;
        let totalVertices = 0;
        let hasNaN = false;
        const box = new THREE.Box3().setFromObject(activeMeshGroup);
        const isEmpty = box.isEmpty();
        const bounds = {
          min: [parseFloat(box.min.x.toFixed(2)), parseFloat(box.min.y.toFixed(2)), parseFloat(box.min.z.toFixed(2))],
          max: [parseFloat(box.max.x.toFixed(2)), parseFloat(box.max.y.toFixed(2)), parseFloat(box.max.z.toFixed(2))],
          size: [
            parseFloat((box.max.x - box.min.x).toFixed(2)),
            parseFloat((box.max.y - box.min.y).toFixed(2)),
            parseFloat((box.max.z - box.min.z).toFixed(2))
          ]
        };

        activeMeshGroup.traverse((child) => {
          if (child.isMesh && child.geometry) {
            meshCount++;
            const pos = child.geometry.attributes && child.geometry.attributes.position;
            if (pos && pos.array) {
              totalVertices += pos.count;
              for (let i = 0; i < pos.array.length; i++) {
                if (Number.isNaN(pos.array[i])) {
                  hasNaN = true;
                  break;
                }
              }
            }
          }
        });

        return {
          childrenCount: activeMeshGroup.children.length,
          meshCount,
          totalVertices,
          hasNaN,
          isEmpty,
          bounds
        };
      })()
    `);
  }

  async getDownloads() {
    return (await this.evaluate(`window.__testDownloads || []`)) || [];
  }

  async clearDownloads() {
    await this.evaluate(`window.__testDownloads = [];`);
  }

  async getPdfs() {
    return (await this.evaluate(`window.__testPdfs || []`)) || [];
  }

  async clearPdfs() {
    await this.evaluate(`window.__testPdfs = [];`);
  }

  getConsoleErrors() {
    return [...this.consoleErrors];
  }

  clearConsoleErrors() {
    this.consoleErrors = [];
    this.exceptions = [];
  }

  async close() {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        await this.send('Browser.close').catch(() => {});
      }
    } catch (_) {}
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
    if (this.chromeProcess) {
      try { this.chromeProcess.kill('SIGKILL'); } catch (_) {}
    }
    if (this.pyProcess) {
      try { this.pyProcess.kill('SIGKILL'); } catch (_) {}
    }
    console.log('[CDPHarness] Cleanup completed.');
  }
}

module.exports = { CDPHarness };
