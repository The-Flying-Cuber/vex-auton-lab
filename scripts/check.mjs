import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const mainPath=fileURLToPath(new URL('dist/assets/main.js',root));
const js=await readFile(mainPath,'utf8');
const html=await readFile(new URL('dist/index.html',root),'utf8');
const parsed=spawnSync(process.execPath,['--check',mainPath],{encoding:'utf8'});
assert.equal(parsed.status,0,parsed.stderr);
assert(!html.includes('cloudflareinsights'));
assert(!html.includes('_vercel/insights'));
assert(!js.includes('"/models/'));
assert(!js.includes('"/asset-manifest.json"'));
assert(/src="\.\/assets\/main\.js\?v=[a-f0-9]+"/.test(html));
for(const asset of ['pin.glb','cup.glb','goal_tall.glb','goal_alliance.glb','goal_neutral.glb','matchloader.glb']) {
  assert((await stat(new URL('dist/models/'+asset,root))).size>1000);
}
const warehouse=JSON.parse(await readFile(new URL('dist/models/Large_Warehouse/Large_Warehouse.gltf',root),'utf8'));
for(const item of [...warehouse.buffers,...warehouse.images]) if(item.uri&&!item.uri.startsWith('data:')) {
  assert((await stat(new URL('dist/models/Large_Warehouse/'+item.uri,root))).size>0);
}
function classSource(name){
  const start=js.indexOf('class '+name+'{');assert(start>=0);
  let depth=0,quote=null,escaped=false,opened=false;
  for(let i=start;i<js.length;i++){
    const char=js[i];
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
    if(char==='"'||char==="'"||char==='`'){quote=char;continue;}
    if(char==='{'){depth++;opened=true;}
    if(char==='}'&&--depth===0&&opened)return js.slice(start,i+1);
  }
  throw Error('Unclosed class '+name);
}
const config={scoring:{matchDuration:120,settleDuration:5},auton:{stepTimeout:6,driveTimeout:4,scoreTimeout:6,turnRate:4,driveTol:.1,driveAlign:.35,driveBreak:1,turnTol:.05,liftTol:.03}};
const Timer=vm.runInNewContext(classSource('xL')+';xL',{M:config});
for(const duration of [15,60]){
  const timer=new Timer(duration,duration);timer.start();
  for(let tick=0;tick<duration*60-1;tick++)timer.tick(1/60);
  assert(timer.inAuton,'Auton must remain active until the full duration');
  for(let tick=0;tick<3;tick++)timer.tick(1/60);
  assert(timer.over);assert.equal(timer.timeLeft,0);
}
const Runner=vm.runInNewContext(classSource('PL')+';PL',{
  M:config,qc:()=>({red1:{x:0,z:1.622,yaw:Math.PI}}),
  us:(value,low,high)=>Math.max(low,Math.min(high,value)),
  Wt:value=>Math.atan2(Math.sin(value),Math.cos(value))
});
function instance(steps){
  const robot={root:{position:{x:0,z:1.622},rotation:{y:Math.PI}},lift:{h:0,target:0}};
  const dummy={setKey(){},setYaw(){},press(){}};
  return {robot,runner:new Runner(robot,dummy,steps)};
}
const first=instance([{t:'wait',ms:20000},{t:'lift',h:1}]);
const second=instance([{t:'wait',ms:500},{t:'lift',h:.5}]);
for(let tick=0;tick<19*60;tick++){first.runner.update(1/60);second.runner.update(1/60);}
assert.equal(first.runner.i,0,'A long wait must not be cut off by the original six-second step timeout');
assert.equal(second.robot.lift.target,.5,'The second routine must advance independently');
for(let tick=0;tick<2*60;tick++)first.runner.update(1/60);
assert.equal(first.robot.lift.target,1,'Skills commands after fifteen seconds must execute');
console.log('Passed: syntax, Pages resource paths, all field assets, 15/60-second timers, independent runners, and commands after 20 seconds.');
