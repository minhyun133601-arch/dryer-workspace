const fs = require('fs');
const vm = require('vm');
global.window = { HeechangTool: { core: {} } };
vm.runInThisContext(fs.readFileSync('C:/Users/user/Desktop/업무용/src/features/document-extractor/vendor/libredwg/engine.js', 'utf8'));
const v = window.HeechangTool.core.cadVendor;
process.stdout.write(v.workerSource.slice(-3200));
