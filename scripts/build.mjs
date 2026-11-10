import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const project = new URL('../',import.meta.url);
const read = path => readFile(new URL(path,project),'utf8');
await mkdir(new URL('dist/assets/',project),{recursive:true});
await cp(new URL('vendor/site/',project),new URL('dist/',project),{recursive:true});
let js=await read('vendor/main-DU0EI9mN.js');
const upstreamHash=createHash('sha256').update(js).digest('hex');
function patch(needle,replacement){
  const count=js.split(needle).length-1;
  if(count!==1)throw new Error(`Expected one patch match, got ${count}: ${needle.slice(0,100)}`);
  js=js.replace(needle,replacement);
}
// Honor the existing environment flag instead of always loading the shed.
patch('M.graphics.quality!=="ultra"&&bs&&await g()', 'M.arena.warehouse.enabled&&M.graphics.quality!=="ultra"&&bs&&await g()');
patch('const g=i==="match"&&M.controls.matchAuton;', 'const g=(i==="match"||i==="skills")&&M.controls.matchAuton;');
patch('PH(GH[i],g?M.scoring.autonDuration:0)', 'PH(lab.testing?lab.duration:GH[i],g?(i==="skills"?60:lab.testing?lab.duration:M.scoring.autonDuration):0)');
patch('const NI=sA=>sA===wA&&UI.inAuton&&wA._autonRunner?(wA._autonRunner.update(B),{input:wA._autonDummy.input,view:wA._autonDummy.view}):sA===wA?{input:ig?t:zg.input,view:SI}:{input:sA._dummy.input,view:sA._dummy.view};', 'const NI=sA=>UI.inAuton&&sA._autonRunner?(sA._autonRunner.update(B),{input:sA._autonDummy.input,view:sA._autonDummy.view}):sA===wA?{input:ig?t:zg.input,view:SI}:{input:sA._dummy.input,view:sA._dummy.view};');
patch('const g=I.t==="driveTo"?M.auton.driveTimeout:I.t==="score"?M.auton.scoreTimeout:M.auton.stepTimeout;', 'const g=I.t==="wait"||I.t==="intake"?Math.max(M.auton.stepTimeout,(+I.ms||0)/1000+1):I.t==="driveTo"?M.auton.driveTimeout:I.t==="score"?M.auton.scoreTimeout:M.auton.stepTimeout;');
// The rear goal aligner otherwise fights REV waypoint steering while carrying.
// Keep goal assistance for SCORE blocks and for ordinary manual driving.
patch('carrying:r,reversing:c,inAuton:C}', 'carrying:r&&(!C||!this._autonRunner||this._autonRunner.steps[this._autonRunner.i]?.t==="score"),reversing:c,inAuton:C}');
patch('const t=tE("red");A.fillStyle=Ml()?', 'const t=lab.editorPose();A.fillStyle=Ml()?');
patch('let E=tE("red").x,t=tE("red").z;', 'const labStart=lab.editorPose();let E=labStart.x,t=labStart.z;');
patch('Y.pickGoalFor>=0&&Am(A,I,g,C,B)}function $L', 'Y.pickGoalFor>=0&&Am(A,I,g,C,B),lab.drawOtherRobot(A,I,g,C,B)}function $L');
patch('eI.update(wA);{const sA=!ig', 'eI.update(wA);lab.updateProgress();{const sA=!ig');
patch('E=Math.min(E+MA,B*2);let GI=0;for(;E>=B&&GI<2;)', 'E=Math.min(E+MA,B*(lab.testing?8:2));let GI=0;for(;E>=B&&GI<(lab.testing?8:2);)');
patch('GI===2&&E>=B&&(E=0,Rg.snapRenderState(Kg.all))', 'GI===(lab.testing?8:2)&&E>=B&&(E=0,Rg.snapRenderState(Kg.all))');
patch('UI.tick(MA),UI.tickSettle(MA)', 'UI.tick(lab.testing?GI*B:MA),UI.tickSettle(lab.testing?GI*B:MA)');
patch('eI.showToast(sA?`DRIVER · Auton bonus ${nI}`:"DRIVER CONTROL")', 'eI.showToast(lab.testing?"AUTON COMPLETE":sA?`DRIVER · Auton bonus ${nI}`:"DRIVER CONTROL")');
patch('ox();\n', (await read('src/routine-store.js')).replace(/^export /gm,'')+'\n'+await read('src/auton-lab.js'));
js=js.replaceAll('Click to add a waypoint · drag a point to move it · ⌘Z / ⌘⇧Z to undo', 'Drag the numbered start to move · drag its handle to turn · click to add waypoints · ⌘Z to undo steps');
// Resolve resources relative to the page so /<repository>/ works on Pages.
js=js.replaceAll('"/models/','"./models/').replaceAll('"/sounds/','"./sounds/').replaceAll('"/asset-manifest.json"','"./asset-manifest.json"');
let html=await read('vendor/index.html');
html=html.replace(/<script\b[^>]*src=["'][^"']*(?:cloudflareinsights|_vercel\/insights)[\s\S]*?<\/script>/gi,'');
html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,'');
html=html.replace(/<link rel="canonical"[^>]+>/,'');
html=html.replace(/<meta (?:property="og:|name="twitter:)[^>]+>/g,'');
html=html.replace('<title>Vsimulator</title>','<title>Vsimulator · Auton Lab</title>');
const buildVersion=createHash('sha256').update(js).digest('hex').slice(0,12);
html=html.replace('src="/assets/main-DU0EI9mN.js"',`src="./assets/main.js?v=${buildVersion}"`);
html=html.replaceAll('href="/assets/','href="./assets/').replaceAll('href="/images/','href="./images/').replaceAll('url(/images/','url(./images/').replaceAll('url("/images/','url("./images/').replaceAll("url('/images/","url('./images/");
html=html.replaceAll('href="/terms"','href="https://sim.robostem.org/terms"').replaceAll('href="/privacy"','href="https://sim.robostem.org/privacy"');
await writeFile(new URL('dist/assets/main.js',project),js);
await writeFile(new URL('dist/index.html',project),html);
await writeFile(new URL('dist/.nojekyll',project),'');
await writeFile(new URL('dist/build-info.json',project),JSON.stringify({upstream:'https://sim.robostem.org/assets/main-DU0EI9mN.js',sha256:upstreamHash,extension:'Auton Lab',features:['match-15s','skills-60s','robot-1','robot-2','two-robot-synchronized']},null,2));
console.log('Built '+fileURLToPath(new URL('dist/',project)));
