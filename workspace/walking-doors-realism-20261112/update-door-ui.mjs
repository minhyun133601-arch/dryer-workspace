import {readFile,writeFile} from 'node:fs/promises';
const addition='<div class="person-door-settings"><label class="person-auto-door"><input id="auto-doors-toggle" type="checkbox"> 자동 문열기</label><button id="person-door-action" type="button" disabled>문 열기 · F</button><span id="person-door-hint" role="status" aria-live="polite">문 앞에서 F</span><label class="person-view-scale" for="person-view-scale">시야 배율 <output id="person-view-scale-output">100%</output><input id="person-view-scale" type="range" min="75" max="125" value="100" step="5" aria-label="사람 시점 시야 배율"></label></div>';
for(const file of ['apps/site/index.html','apps/site/share/index.html']){
  let source=await readFile(file,'utf8');
  if(!source.includes('id="auto-doors-toggle"'))source=source.replace('<button id="person-reset"',addition+'<button id="person-reset"');
  source=source.replace('Shift 빠르게 · <span data-person-rule>벽 통과 · 계단 오르내리기</span>','Shift 빠르게 · F 문 열기/닫기<br><span data-person-rule>계단 오르내리기 · 눈높이 1.65m</span>');
  await writeFile(file,source);
}
const helpers=`
const PERSON_NAV_KEY = 'dryer-person-navigation-v1';
let personDoorInteraction = null;
function personNavigationPreferences() {
  try { const value=JSON.parse(localStorage.getItem(PERSON_NAV_KEY)||'{}'); return {automatic:value.automatic===true,scale:Number.isFinite(value.scale)?Math.max(.75,Math.min(1.25,value.scale)):1}; } catch {return {automatic:false,scale:1};}
}
function savePersonNavigationPreferences() {
  try {localStorage.setItem(PERSON_NAV_KEY,JSON.stringify({automatic:$('auto-doors-toggle').checked,scale:Number($('person-view-scale').value)/100}));}catch{}
}
function updatePersonDoorInteraction(interaction) {
  personDoorInteraction=interaction;
  const automatic=$('auto-doors-toggle').checked,button=$('person-door-action');
  button.hidden=automatic;button.disabled=!interaction;
  button.textContent=interaction?.action==='close'?'문 닫기 · F':'문 열기 · F';
  $('person-door-hint').textContent=interaction ? (automatic?interaction.label+' · 자동':interaction.label+' · F '+(interaction.action==='close'?'닫기':'열기')) : automatic?'진입 가능한 문만 자동으로 열립니다':'가까운 출입문 앞에서 F';
}
function bindDoorNavigation() {
  const preferences=personNavigationPreferences();
  $('auto-doors-toggle').checked=preferences.automatic;
  $('person-view-scale').value=String(Math.round(preferences.scale*100));
  $('person-view-scale-output').textContent=Math.round(preferences.scale*100)+'%';
  $('auto-doors-toggle').addEventListener('change',()=>{scene?.setAutomaticDoors($('auto-doors-toggle').checked);savePersonNavigationPreferences();updatePersonDoorInteraction(personDoorInteraction);$('site-canvas').focus({preventScroll:true});});
  $('person-door-action').addEventListener('click',()=>{scene?.interactDoor();$('site-canvas').focus({preventScroll:true});});
  $('person-view-scale').addEventListener('input',()=>{const scale=Number($('person-view-scale').value)/100;scene?.setPersonViewScale(scale);$('person-view-scale-output').textContent=Math.round(scale*100)+'%';savePersonNavigationPreferences();});
  updatePersonDoorInteraction(null);
}
`;
for(const file of ['apps/site/app.js','apps/site/share/app.js']){
  let source=await readFile(file,'utf8');
  source=source.replace("label.textContent = '벽 통과 · 계단 오르내리기';","label.textContent = '계단 오르내리기 · 눈높이 1.65m';");
  if(!source.includes('const PERSON_NAV_KEY'))source=source.replace('function bindPersonNavigation() {',helpers+'\nfunction bindPersonNavigation() {');
  source=source.replace('bindPersonNavigation();','bindPersonNavigation();\nbindDoorNavigation();');
  source=source.replace('onViewChange: setViewIndicator,','onViewChange: setViewIndicator,\n    onDoorInteraction: updatePersonDoorInteraction,');
  const anchor="  scene.setLabels($('labels-toggle').checked);";
  source=source.replace(anchor,"  scene.setAutomaticDoors($('auto-doors-toggle').checked);\n  scene.setPersonViewScale(Number($('person-view-scale').value)/100);\n"+anchor);
  await writeFile(file,source);
}
const css='\n.person-door-settings{display:grid;grid-template-columns:1fr auto;gap:5px 7px;align-items:center;margin:5px 0 7px}.person-auto-door{display:flex;gap:5px;align-items:center;font-weight:600;cursor:pointer}.person-auto-door input{margin:0;width:15px;height:15px;accent-color:#315e49}.person-door-settings [role=status]{grid-column:1/-1;font-size:10px;min-height:15px;color:#456b5b}.person-view-scale{display:grid;grid-column:1/-1;grid-template-columns:1fr auto;gap:2px 8px}.person-view-scale input{grid-column:1/-1;width:100%;margin:2px 0;accent-color:#315e49}.person-view-scale output{font-variant-numeric:tabular-nums}.scene-viewport:has(canvas[data-view=person]) .selected-name-dock{display:none!important}@media(max-width:700px){.person-help{max-width:195px}.person-door-settings{gap:3px 5px}.person-door-settings [role=status]{font-size:9px}.person-door-settings button{padding:3px 5px}}\n';
for(const file of ['apps/site/styles.css','apps/site/share/styles.css']){
  let source=await readFile(file,'utf8');if(!source.includes('.person-door-settings{'))source+=css;await writeFile(file,source);
}
for(const file of ['apps/site/campus-models.js','apps/site/entrance-production-models.js']){
  let source=await readFile(file,'utf8');source=source.replaceAll("userData.proximityDoor = { kind:","userData.proximityDoor = { enterable: false, kind:").replaceAll("userData.proximityDoor={kind:","userData.proximityDoor={enterable:false,kind:");await writeFile(file,source);
}
