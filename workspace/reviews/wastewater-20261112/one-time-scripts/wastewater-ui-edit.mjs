import { readFile, writeFile } from 'node:fs/promises';
const projectRoot = new URL('../../../../', import.meta.url);
for (const file of ['apps/site/index.html','apps/site/share/index.html']) {
  const target = new URL(file, projectRoot);
  let source=await readFile(target,'utf8');
  const anchor='<button id="valve-room-open"';
  if (!source.includes(anchor)) throw new Error(file);
  source=source.replace(anchor,'<button id="wastewater-open" class="furnace-open" type="button" hidden>폐수처리장 내부 <span aria-hidden="true">↗</span></button>'+anchor);
  await writeFile(target,source);
}
