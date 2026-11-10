import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const js=await readFile(new URL('../dist/assets/main.js',import.meta.url),'utf8');
function source(prefix) {
  const start=js.indexOf(prefix);assert(start>=0,`Missing ${prefix}`);
  let depth=0,quote=null,escaped=false;
  for(let i=js.indexOf('{',start);i<js.length;i++) {
    const char=js[i];
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
    if(char==='"'||char==="'"||char==='`'){quote=char;continue;}
    if(char==='{')depth++;
    if(char==='}'&&--depth===0)return js.slice(start,i+1);
  }
  throw Error('Unclosed '+prefix);
}
const config={
  robot:{scale:.7,length:.42},intake:{reach:.3,halfWidth:.2},
  matchLoad:{perAlliance:{cups:12,pins:12},skillsInventory:{redYellowPins:3,blueYellowPins:4,cups:7},
    triggerHalfWidth:.15,triggerHalfDepth:.16,rearmMargin:.16,respawnClearRadius:.13,loaderLiftHeight:.254,
    orientation:{match:{cupFlipped:false,pinFlipped:false},skills:{cupFlipped:false,pinFlipped:false}}}
};
class Vector {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(other){return this.set(other.x,other.y,other.z);}
}
const helpers=['_Y','mS','HS','TS','bY','OY','xS','mY','labRefreshLoaderVisits','labRobotCanLoad'];
const {Loader,Transfer,Intake}=vm.runInNewContext(
  helpers.filter(name=>js.includes('function '+name+'(')).map(name=>source('function '+name+'(')).join('\n')+
  ['vY','QL','zq'].map(name=>source('class '+name+'{')).join('\n')+';({Loader:vY,Transfer:QL,Intake:zq})',{M:config,p:Vector});
function station(id,z,alliance='red') {
  const x=alliance==='red'?-1.7342:1.7342;
  return {id,alliance,colorA:alliance,colorB:'yellow',rotY:Math.PI/2,
    spawn:new Vector(x+.08,.2,z),trigger:new Vector(x+.2,0,z),inward:new Vector(1,0,0),
    model:{userData:{},position:{y:0}},ghost:{rotation:{y:0}}};
}
function manager(mode) {
  const result=Object.create(Loader.prototype);
  result.loaders=[station('red-near',-1.4926),station('red-far',1.4926),station('blue-near',-1.4926,'blue'),station('blue-far',1.4926,'blue')];
  result.om={
    spawnPiece(options){return {type:options.type,state:'loose',options,root:{position:options}};},
    spawnNestedStack(options){return {type:'cup',state:'loose',options,root:{position:options}};}
  };
  result.reset(mode);return result;
}
function robot(id,loader,need='cup') {
  return {id,alliance:'red',root:{position:{x:loader.trigger.x,z:loader.trigger.z},rotation:{y:Math.PI/2}},
    loadOrientation:{cupFlipped:false,pinFlipped:id===2},transfer:{need,received:[],
      matchLoadNeed(){return this.need;},matchLoadCapture(piece){this.received.push(piece);this.need=null;piece.state='captured';return true;}}};
}
const at=(bot,loader)=>Object.assign(bot.root.position,{x:loader.trigger.x,z:loader.trigger.z});
for(const mode of ['match','skills']) {
  const loads=manager(mode),[near,far]=loads.loaders;
  const one=robot(1,near),two=robot(2,far);
  loads.update([one,two]);
  assert.equal(one.transfer.received[0].matchLoadId,'red-near');
  assert.equal(two.transfer.received[0].matchLoadId,'red-far');
  assert.equal(mode==='skills'?loads.skillsInventory.cups:loads.matchPool.red.cups,mode==='skills'?5:10,'Both red loaders must share the normal supply');
  one.root.position.x=two.root.position.x=0;loads.update([one,two]);
  at(one,far);at(two,near);one.transfer.need=two.transfer.need='pin';loads.update([one,two]);
  assert.equal(one.transfer.received.at(-1).matchLoadId,'red-far','Robot 1 must also use the far loader');
  assert.equal(two.transfer.received.at(-1).matchLoadId,'red-near','Robot 2 must also use the near loader');
  assert.equal(two.transfer.received.at(-1).options.flip,true,'Loader orientation must follow the robot using it');
}

// A full robot in the trigger must not monopolize a loader. Each robot rearms
// after its own visit; the other robot may remain in the outer trigger area.
for(const mode of ['match','skills']) {
  const loads=manager(mode),near=loads.loaders[0];
  const one=robot(1,near,null),two=robot(2,near,'pin');
  loads.update([one,two]);
  assert.equal(two.transfer.received.length,1,'A full Robot 1 must not block Robot 2 from loading');
  one.transfer.need='pin';loads.update([one,two]);
  assert.equal(one.transfer.received.length,1,'The other robot must be able to take its turn without clearing the whole station');
  one.transfer.need='cup';loads.update([one,two]);
  assert.equal(one.transfer.received.length,1,'A stationary robot must not repeatedly drain a loader');
  one.root.position.x=0;loads.update([one,two]);at(one,near);loads.update([one,two]);
  assert.equal(one.transfer.received.length,2,'A robot must rearm by leaving and returning, even if the other robot stays nearby');
}

// Real intake geometry and transfer eligibility must accept every pin color.
function emptyTransfer(index,filter='all') {
  const yaw=index===0?Math.PI:Math.PI/2,position={x:index===0?0:-1,z:index===0?1:0};
  const root={worldToLocal(point){
    const dx=(point.x-position.x)/.7,dz=(point.z-position.z)/.7;
    return point.set(dx*Math.cos(yaw)-dz*Math.sin(yaw),point.y/.7,dx*Math.sin(yaw)+dz*Math.cos(yaw));
  }};
  const intake=Object.assign(Object.create(Intake.prototype),{root,frontZ:.21,_local:new Vector()});
  const transfer=Object.assign(Object.create(Transfer.prototype),{
    intake,_cooldown:0,_add:null,state:'EMPTY',captured:{cup:null,pin:null},stack:null,_order:[],_inAuton:true,intakeFilter:filter,
    _capture(piece){piece.state='captured';}
  });
  const pin=(colorA,colorB)=>({type:'pin',state:'loose',colorA,colorB,radius:.02,pos:new Vector(position.x+Math.sin(yaw)*.23,.025,position.z+Math.cos(yaw)*.23)});
  return {transfer,pin};
}
for(let index=0;index<2;index++)for(const colors of [['red','yellow'],['blue','yellow'],['red','blue']])for(const filter of ['all','pin']) {
  const field=emptyTransfer(index,filter),pin=field.pin(...colors);
  field.transfer._tryCapture([pin]);assert.equal(field.transfer.captured.pin,pin,`Robot ${index+1} must pick up ${colors.join('/')} field pins`);
  const loaded=emptyTransfer(index,filter),loadPin=loaded.pin(...colors);
  assert(loaded.transfer.matchLoadCapture(loadPin),`Robot ${index+1} must accept ${colors.join('/')} match-loaded pins`);
  assert.equal(loaded.transfer.captured.pin,loadPin);
  assert.equal(loaded.transfer.matchLoadCapture(loaded.pin('blue','yellow')),false,'A robot must still release its existing pin before taking another');
}
const cupOnly=emptyTransfer(0,'cup'),blocked=cupOnly.pin('blue','yellow');cupOnly.transfer._tryCapture([blocked]);
assert.equal(cupOnly.transfer.captured.pin,null,'An explicit cup-only intake filter must still be respected');
console.log('Passed: both robots at both red loaders in Match/Skills, independent loader visits, shared supplies, per-robot orientation, and red/yellow, blue/yellow, and red/blue pin pickup.');
