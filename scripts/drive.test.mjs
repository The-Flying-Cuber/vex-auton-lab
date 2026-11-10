import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const js=await readFile(new URL('../dist/assets/main.js',import.meta.url),'utf8');
function classSource(name) {
  const start=js.indexOf('class '+name+'{');assert(start>=0);
  let depth=0,quote=null,escaped=false;
  for(let i=js.indexOf('{',start);i<js.length;i++) {
    const char=js[i];
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
    if(char==='"'||char==="'"||char==='`'){quote=char;continue;}
    if(char==='{')depth++;
    if(char==='}'&&--depth===0)return js.slice(start,i+1);
  }
  throw Error('Unclosed class '+name);
}
const wrap=value=>Math.atan2(Math.sin(value),Math.cos(value));
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const config={
  robot:{scale:.7,width:.4,length:.42,reverseScale:.7,linearDamping:10},
  field:{half:1.83,wallThickness:.05},drive:{wheelDiamIn:3.25,rpm:360},
  aligner:{radius:.55,centerBand:.35,lerp:6},placeScore:{proxAngle:Math.PI/3},transfer:{stageGrabLiftMax:.05},
  auton:{stepTimeout:6,driveTimeout:4,scoreTimeout:6,turnRate:4,driveTol:.1,driveAlign:.35,driveBreak:1,turnTol:.05,liftTol:.03}
};
class Vector {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
const context=vm.createContext({
  M:config,p:Vector,us:clamp,rg:clamp,Wt:wrap,
  qc:()=>({red1:{x:0,z:0,yaw:0}}),
  cG:()=>config.drive.rpm/60*Math.PI*config.drive.wheelDiamIn*.0254,
  Pq:(from,to,_rate,dt)=>from+wrap(to-from)*(1-Math.exp(-6*dt))
});
const {Runner,Dummy,Drivetrain,Aligner,Robot}=vm.runInContext(
  ['PL','Xn','Hd','gL','Vn'].map(classSource).join('\n')+
  ';({Runner:PL,Dummy:Xn,Drivetrain:Hd,Aligner:gL,Robot:Vn})',context);

function instance({reverse=false,goals=[],start={x:0,z:.8},target={x:0,z:-.6},yaw=reverse?0:Math.PI,carrying=true}={}) {
  const robot={
    root:{position:new Vector(start.x,0,start.z),rotation:{y:yaw}},goals,objectManager:{all:[]},
    lift:{h:.2,target:.2,update(){}},
    transfer:{grabbed:carrying,state:'HELD',update(){}},
    claw:{update(){},toggle(){}},intake:{update(){}},
    physics:{updateRobot(){}},canUseGoal:goal=>!!goal,_collideReach(){}
  };
  robot.drivetrain=new Drivetrain(robot.root);
  robot.aligner=new Aligner(robot.root);
  const dummy=new Dummy({yaw});
  const runner=robot._autonRunner=new Runner(robot,dummy,[{t:'driveTo',...target,rev:reverse}]);
  // Auton Lab waypoints use absolute field coordinates.
  runner._s0x=runner._s1x;runner._s0z=runner._s1z;runner._c=1;runner._s=0;runner._dyaw=0;
  return {robot,dummy,runner,tick(dt=1/60){
    runner.update(dt);Robot.prototype.update.call(robot,dt,dummy.input,dummy.view,true);
  }};
}
const nearbyGoal={worldPos:new Vector(.35,0,.15),collisionRadius:.05};
const forward=instance({goals:[nearbyGoal]});
const reverse=instance({reverse:true,goals:[nearbyGoal]});
let maxForwardDeviation=0,maxReverseDeviation=0,reverseSteered=false;
for(let tick=0;tick<240;tick++) {
  if(!forward.runner.done)forward.tick();
  if(!reverse.runner.done)reverse.tick();
  maxForwardDeviation=Math.max(maxForwardDeviation,Math.abs(forward.robot.root.position.x));
  maxReverseDeviation=Math.max(maxReverseDeviation,Math.abs(reverse.robot.root.position.x));
  reverseSteered ||= reverse.robot.aligner.steering;
}
assert(forward.runner.done&&reverse.runner.done);
assert(Math.abs(reverse.robot.root.position.z+.6)<config.auton.driveTol,'REV must reach its waypoint');
assert(maxForwardDeviation<1e-6,'The straight FWD route must remain straight');
assert.equal(reverseSteered,false,`A REV waypoint must not let goal assistance override its heading (lateral deviation ${maxReverseDeviation.toFixed(3)} m)`);
assert(maxReverseDeviation<1e-6,`REV must follow the same straight route as FWD (deviation ${maxReverseDeviation})`);

// SCORE explicitly needs the rear goal aligner, and manual reverse keeps its
// original assistance even when a previous auton runner remains attached.
for(const inAuton of [true,false]) {
  // Manual assistance requires rear contact; SCORE also aligns nearby goals.
  const goal=inAuton?nearbyGoal:{worldPos:new Vector(0,0,.15),collisionRadius:.05};
  const scoring=instance({reverse:true,goals:[goal],start:{x:0,z:inAuton?.4:.37}});
  scoring.runner.steps[0]={t:inAuton?'score':'driveTo'};
  scoring.dummy.setKey('KeyS',true);
  Robot.prototype.update.call(scoring.robot,1/60,scoring.dummy.input,scoring.dummy.view,inAuton);
  assert(scoring.robot.aligner.engaged&&scoring.robot.aligner.steering,'SCORE and manual reverse must retain goal alignment');
}
console.log('Passed: straight FWD/REV routes beside goals, REV arrival, SCORE alignment, and manual reverse alignment.');
