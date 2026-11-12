/* Reuses the local drawing engine and renderer, with a native Canvas adapter. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

async function main() {
  const [source, output, resultPath] = process.argv.slice(2);
  if (!source || !output || !resultPath) throw new Error('Expected source, PNG output, result JSON');
  const font = 'C:/Windows/Fonts/malgun.ttf';
  if (fs.existsSync(font)) GlobalFonts.registerFromPath(font, 'Malgun Gothic');
  global.window = { HeechangTool: { core: {} } };
  global.document = { createElement: (name) => {
    if (name !== 'canvas') throw new Error('Unsupported element');
    return createCanvas(1, 1);
  } };
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'));
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'cad-renderer.js'), 'utf8'));
  const Tool = window.HeechangTool;
  const engine = Tool.core.cadVendor;
  const decoded = await new Promise((resolve, reject) => {
    global.self = {
      location: { href: pathToFileURL(path.join(__dirname, 'worker.cjs')).href },
      postMessage: (data) => {
        if (data.error) reject(new Error(data.error));
        if (data.database) resolve(data);
      },
      close: () => {},
    };
    vm.runInThisContext(engine.workerSource, { importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });
    self.onmessage({ data: { bytes: fs.readFileSync(source), wasm: Buffer.from(engine.wasmBase64, 'base64') } });
  });
  const rendered = Tool.core.cadRender.render(decoded.database, { maxSide: 4800, monochrome: true });
  fs.writeFileSync(output, rendered.canvas.toBuffer('image/png'));
  let overview;
  if (rendered.autoFocusUsed) {
    overview = Tool.core.cadRender.render(decoded.database, { maxSide: 2400, monochrome: true, focus: false });
    fs.writeFileSync(output.replace(/\.png$/i, '-overview.png'), overview.canvas.toBuffer('image/png'));
  }
  const warnings = [...new Set([...(decoded.warnings || []), ...rendered.warnings])];
  fs.writeFileSync(resultPath, JSON.stringify({ width: rendered.canvas.width, height: rendered.canvas.height,
    entityCount: rendered.entityCount, bounds: rendered.bounds, autoFocusUsed: rendered.autoFocusUsed,
    overview: overview ? { width: overview.canvas.width, height: overview.canvas.height } : null,
    warnings }, null, 2), 'utf8');
  process.stdout.write(JSON.stringify({ ok: true, width: rendered.canvas.width, height: rendered.canvas.height,
    entityCount: rendered.entityCount }) + '\n');
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
