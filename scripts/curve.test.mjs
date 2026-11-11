import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as geometry from '../src/bezier-path.js';

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
const begin=js.indexOf('// AUTON_LAB_CURVE_RUNNER_BEGIN'),end=js.indexOf('// AUTON_LAB_CURVE_RUNNER_END');
assert(begin>0&&end>begin,'The built app must include the curve follower');
const clamp=geometry.labCurveClamp,wrap=value=>Math.atan2(Math.sin(value),Math.cos(value));
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
  ...geometry,M:config,p:Vector,us:clamp,rg:clamp,Wt:wrap,
  qc:()=>({red1:{x:0,z:0,yaw:0}}),
  cG:()=>config.drive.rpm/60*Math.PI*config.drive.wheelDiamIn*.0254,
  Pq:(from,to,_rate,dt)=>from+wrap(to-from)*(1-Math.exp(-6*dt))
});
const {Runner,Dummy,Drivetrain,Aligner,Robot}=vm.runInContext(
  ['PL','Xn','Hd','gL','Vn'].map(classSource).join('\n')+js.slice(begin,end)+
  ';({Runner:PL,Dummy:Xn,Drivetrain:Hd,Aligner:gL,Robot:Vn})',context);

function simulation(steps,{start={x:0,z:0},yaw=0}={}) {
  const robot={
    root:{position:new Vector(start.x,0,start.z),rotation:{y:yaw}},goals:[],objectManager:{all:[]},
    lift:{h:.2,target:.2,update(){}},transfer:{grabbed:true,state:'HELD',update(){}},
    claw:{update(){},toggle(){}},intake:{update(){}},physics:{updateRobot(){}},canUseGoal:goal=>!!goal,_collideReach(){}
  };
  robot.drivetrain=new Drivetrain(robot.root);robot.aligner=new Aligner(robot.root);
  const dummy=new Dummy({yaw}),runner=robot._autonRunner=new Runner(robot,dummy,steps);
  runner._s0x=runner._s1x;runner._s0z=runner._s1z;runner._c=1;runner._s=0;runner._dyaw=0;
  return {robot,dummy,runner,elapsed:0,trace:[],tick(){
    runner.update(1/60);Robot.prototype.update.call(robot,1/60,dummy.input,dummy.view,true);
    this.elapsed+=1/60;this.trace.push({x:robot.root.position.x,z:robot.root.position.z,speed:Math.abs(robot.drivetrain.speed)});
  },finish(seconds=35){
    for(let tick=0;tick<seconds*60&&!runner.done;tick++)this.tick();
    assert(runner.done,'Curve commands must finish within their allotted time');return this;
  }};
}
const curve={t:'curveTo',x:1,z:1,c1x:0,c1z:.6,c2x:.4,c2z:1,lookahead:.2,speed:.55};
const path=geometry.labSampleBezier({x:0,z:0},curve);
assert.deepEqual(geometry.labBezierPoint({x:0,z:0},curve,0),{x:0,z:0});
assert.deepEqual(geometry.labBezierPoint({x:0,z:0},curve,1),{x:1,z:1});
assert(path.length>Math.SQRT2);
const target=geometry.labCurveLookahead(path,{x:0,z:0},0,.2);
assert(Math.abs(Math.hypot(target.x,target.z)-.2)<1e-8,'The follower target must intersect the lookahead circle');

const forward=simulation([curve]).finish(),reverse=simulation([{...curve,rev:true}],{yaw:Math.PI}).finish();
for(const result of [forward,reverse]) {
  assert(Math.hypot(result.robot.root.position.x-1,result.robot.root.position.z-1)<.1,'FWD and REV curves must reach the endpoint');
  const error=Math.max(...result.trace.map(point=>geometry.labCurveProject(path,point).distance));
  assert(error<.07,`The robot must follow the bend, rather than drive its chord (error ${error})`);
  assert.equal(result.dummy.input.throttle,undefined,'Finishing a curve must release its analog throttle');
}
assert(reverse.elapsed>forward.elapsed,'REV must retain the simulator’s existing reverse speed scale');
const slow=simulation([{...curve,speed:.1}]).finish();
assert(slow.elapsed>6&&Math.hypot(slow.robot.root.position.x-1,slow.robot.root.position.z-1)<.1,'Slow curves must not be skipped by the old six-second step timeout');
const wide=simulation([{...curve,lookahead:.8}]).finish();
const maxError=result=>Math.max(...result.trace.map(point=>geometry.labCurveProject(path,point).distance));
assert(maxError(wide)>maxError(forward)+.01,'Changing lookahead must affect the executed path');

const peak=result=>Math.max(...result.trace.map(point=>point.speed));
const regular=simulation([{t:'driveTo',x:0,z:1.5}]).finish();
const fullCurve=simulation([{...curve,speed:1}]).finish();
assert(peak(fullCurve)>=peak(regular)*.98,'A curve at 100% must reach regular DRIVE speed without a hidden bend multiplier');
const regularReverse=simulation([{t:'driveTo',x:0,z:1.5,rev:true}],{yaw:Math.PI}).finish();
const fullReverse=simulation([{...curve,speed:1,rev:true}],{yaw:Math.PI}).finish();
const halfForward=simulation([{...curve,speed:.5}]).finish();
assert(peak(fullReverse)<peak(halfForward),'A full-speed REV curve must be slower than a 50% FWD curve');
assert(Math.abs(peak(regularReverse)/peak(regular)-.4)<.01,'REV DRIVE must reach 40% of FWD DRIVE speed');
assert(Math.abs(peak(fullReverse)/peak(regularReverse)-1)<.02,'Full-speed reverse curves must match REV DRIVE speed');
for(const result of [fullCurve,fullReverse])assert(Math.hypot(result.robot.root.position.x-1,result.robot.root.position.z-1)<.1,'Full-speed curves must still reach their endpoint');
const longReverse=simulation([{t:'driveTo',x:0,z:1.5,rev:true}],{start:{x:0,z:-1.5},yaw:Math.PI}).finish();
assert(longReverse.elapsed>4&&Math.abs(longReverse.robot.root.position.z-1.5)<.1,'A long REV DRIVE must reach its waypoint beyond the original timeout');
assert.equal(longReverse.dummy.input.throttle,undefined,'Finishing a REV DRIVE must clear its throttle override');
const adaptive=simulation([{...curve,speed:1,adaptive:true}]).finish();
assert(peak(adaptive)<peak(fullCurve)*.97,'Slowing for bends must be an explicit adaptive-speed option');

const mixed=simulation([curve,{t:'driveTo',x:1.5,z:1},{t:'wait',ms:500}]).finish();
assert(Math.hypot(mixed.robot.root.position.x-1.5,mixed.robot.root.position.z-1)<.15,'A straight DRIVE must work after a curve');
const loop={...curve,x:0,z:0,c1x:1,c1z:0,c2x:1,c2z:1,speed:.4};
const closed=simulation([loop],{yaw:Math.PI/2});closed.tick();
assert(!closed.runner.done,'A closed curve must not finish merely because it starts at its endpoint');
closed.finish();assert(Math.hypot(closed.robot.root.position.x,closed.robot.root.position.z)<.1);
const zero=simulation([{...curve,x:0,z:0,c1x:0,c1z:0,c2x:0,c2z:0}]).finish();assert(zero.elapsed<.1);

const first=simulation([curve]),second=simulation([{...curve,rev:true}],{yaw:Math.PI});
for(let tick=0;tick<150;tick++){first.tick();second.tick();}
assert.notEqual(first.runner._labCurve,second.runner._labCurve,'Each robot must own its pursuit progress');
assert(first.runner._labCurve.progress>second.runner._labCurve.progress,'The two followers must advance independently');

// Editing one endpoint carries its neighboring tangent with it, and undo data
// includes the complete curve without sharing the other robot’s step objects.
const editorSource=await readFile(new URL('../src/auton-curves.js',import.meta.url),'utf8');
const draft={steps:[geometry.labMakeCurve({x:0,z:0},{x:1,z:1}),geometry.labMakeCurve({x:1,z:1},{x:1.4,z:.4})],selected:0};
const editor=vm.runInNewContext(editorSource.slice(0,editorSource.indexOf('\nIp.curveTo='))+';labCurves',{
  ...geometry,Y:draft,lab:{editorPose:()=>({x:0,z:0,yaw:0})},Hn:()=>1.62,CC:1.83,us:clamp,VC:value=>Math.round(value*100)/100
});
const previousC2=draft.steps[0].c2x,nextC1=draft.steps[1].c1x;
editor.moveEnd(0,1.1,1);
assert(Math.abs(draft.steps[0].c2x-previousC2-.1)<1e-8);
assert(Math.abs(draft.steps[1].c1x-nextC1-.1)<1e-8);
assert.deepEqual(JSON.parse(JSON.stringify(draft.steps)),draft.steps);
console.log('Passed: Bézier geometry, FWD/REV tracking, full DRIVE-speed curves, optional adaptive easing, lookahead tuning, long curves, loops, mixed commands, independent followers, and handle editing.');
