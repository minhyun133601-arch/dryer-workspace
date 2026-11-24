import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
export const readProjectText = async name => (await readFile(new URL(name, projectRoot), 'utf8')).replace(/\r\n/g, '\n');

export function replaceRequired(source, before, after) {
  if (!source.includes(before)) throw new Error(`Expected source fragment was not found: ${before}`);
  return source.replace(before, () => after);
}

// Each source module keeps its own scope and explicit public bindings in the
// standalone viewer. Unexpected imports stop the build instead of leaking URLs.
export function namespaceModule(source, name, imports = []) {
  for (const statement of imports) source = replaceRequired(source, statement, '');
  const bindings = [];
  source = source.replace(/^export\s+(const|let|var|function|class)\s+(\w+)/gm, (_, kind, binding) => {
    bindings.push(binding);
    return `${kind} ${binding}`;
  });
  source = source.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (_, exports) => {
    bindings.push(...exports.split(',').map(entry => {
      const [local, alias = local] = entry.trim().split(/\s+as\s+/);
      return local === alias ? local : `${alias}: ${local}`;
    }).filter(Boolean));
    return '';
  });
  if (!bindings.length || /^\s*(?:import|export)\s/m.test(source) || /\bimport\s*\(/.test(source)) throw new Error(`Unsupported module structure: ${name}`);
  return `const ${name} = (() => {\n${source}\nreturn { ${bindings.join(', ')} };\n})();\n`;
}

export async function bundleBurnerMaintenance() {
  const [dataSource, viewerSource, { BURNER_MAINTENANCE_DOCUMENTS }] = await Promise.all([
    readProjectText('apps/site/burner-maintenance-data.js'),
    readProjectText('apps/site/burner-maintenance.js'),
    import('../apps/site/burner-maintenance-data.js'),
  ]);
  let source = dataSource;
  for (const reference of new Set(BURNER_MAINTENANCE_DOCUMENTS.flatMap(document => document.slides.map(slide => slide.image)))) {
    if (!/^\.\/assets\/documents\/dryer-burner\/[a-z0-9-]+\/slide-\d{3}\.jpg$/.test(reference)) throw new Error(`Invalid burner maintenance image: ${reference}`);
    if (!source.includes(reference)) throw new Error(`Missing maintenance image literal: ${reference}`);
    const bytes = await readFile(new URL(`apps/site/${reference.slice(2)}`, projectRoot));
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Invalid burner maintenance JPEG: ${reference}`);
    source = source.replaceAll(reference, `data:image/jpeg;base64,${bytes.toString('base64')}`);
  }
  return [
    namespaceModule(source, 'burnerMaintenanceDataModule'),
    'const { BURNER_MAINTENANCE_DOCUMENTS } = burnerMaintenanceDataModule;',
    namespaceModule(viewerSource, 'burnerMaintenanceModule'),
    'const { createBurnerMaintenance } = burnerMaintenanceModule;',
  ].join('\n');
}

export async function bundleBurnerService() {
  const [dataSource, viewerSource] = await Promise.all([
    readProjectText('apps/site/burner-service-data.js'),
    readProjectText('apps/site/burner-service.js'),
  ]);
  return [
    namespaceModule(dataSource, 'burnerServiceDataModule', ["import { DIMENSIONS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS } from './furnace-drawing-data.js';"]),
    'const { BURNER_SERVICE_EQUIPMENT, BURNER_SPECIFICATIONS, BURNER_SUPPLIER_CONTACT, BURNER_PART_SPECIFICATIONS, BURNER_UNCONFIRMED_SPECIFICATIONS, createBurnerServiceStore, getReplacementStatus, localDateString } = burnerServiceDataModule;',
    namespaceModule(viewerSource, 'burnerServiceModule', [
      "import { BURNER_SERVICE_EQUIPMENT, BURNER_SPECIFICATIONS, BURNER_SUPPLIER_CONTACT, BURNER_PART_SPECIFICATIONS, BURNER_UNCONFIRMED_SPECIFICATIONS, createBurnerServiceStore, getReplacementStatus, localDateString } from './burner-service-data.js';",
    ]),
    'const { createBurnerService } = burnerServiceModule;',
  ].join('\n');
}

export async function bundlePersonAvatar() {
  const reference = './assets/branding/company-logo.jpg';
  const [source, bytes] = await Promise.all([
    readProjectText('apps/site/person-avatar.js'),
    readFile(new URL(`apps/site/${reference.slice(2)}`, projectRoot)),
  ]);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid company logo JPEG.');
  return [
    namespaceModule(replaceRequired(source, reference, `data:image/jpeg;base64,${bytes.toString('base64')}`), 'personAvatarModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
    'const { buildPersonAvatar } = personAvatarModule;',
  ].join('\n');
}
