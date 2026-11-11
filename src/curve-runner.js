// AUTON_LAB_CURVE_RUNNER_BEGIN
// Pure pursuit geometry follows Coulter's lookahead-circle construction:
// https://publications.ri.cmu.edu/implementation-of-the-pure-pursuit-path-tracking-algorithm
const LAB_AUTON_REVERSE_SCALE = .4;

const labOriginalDriveTo = PL.prototype._st_driveTo;
PL.prototype._st_driveTo = function(step, dt) {
  labOriginalDriveTo.call(this, step, dt);
  if (step.rev) {
    const reversing = this.dummy.input.isDown('KeyS');
    this.dummy.setThrottle(reversing ? -LAB_AUTON_REVERSE_SCALE : undefined);
  }
};

function labCurveTimeout(runner,step) {
  const length=runner._labCurve?.index===runner.i?runner._labCurve.path.length:0;
  const speed=cG(runner.robot.driveParams??M.drive)*(runner.robot.drivetrain?.speedMult??1)*(step.rev?LAB_AUTON_REVERSE_SCALE:1);
  return Math.max(M.auton.driveTimeout,length/Math.max(.04,speed*labCurveOptions(step).speed*.5)+4);
}

PL.prototype._st_curveTo=function(step,dt) {
  const position=this._pos(),options=labCurveOptions(step);
  if(this.phase===null) {
    const point=(x,z)=>({x:this._tx(x,z),z:this._tz(x,z)});
    const end=point(step.x,step.z),c1=point(step.c1x,step.c1z),c2=point(step.c2x,step.c2z);
    const path=labSampleBezier({x:position.x,z:position.z},{...step,...end,c1x:c1.x,c1z:c1.z,c2x:c2.x,c2z:c2.z});
    const tangent=path.points.find(p=>Math.hypot(p.x-position.x,p.z-position.z)>.005)||path.points.at(-1);
    this._labCurve={index:this.i,path,progress:0,startYaw:Math.atan2(tangent.x-position.x,tangent.z-position.z)+(step.rev?Math.PI:0)};
    this.phase='curve-align';
  }
  const state=this._labCurve,path=state.path,end=path.points.at(-1);
  const endDistance=Math.hypot(end.x-position.x,end.z-position.z);
  const projection=labCurveProject(path,position,state.progress,Math.min(path.length,state.progress+Math.max(options.lookahead*2.5,.6)));
  state.progress=Math.max(state.progress,projection.s);
  if((path.length<M.auton.driveTol||path.length-state.progress<Math.max(options.lookahead,.2))&&endDistance<M.auton.driveTol) {
    this._advance();return;
  }
  if(this.phase==='curve-align') {
    if(Math.abs(this._steerToward(state.startYaw,dt))>=.12) {
      this.dummy.setKey('KeyW',false);this.dummy.setKey('KeyS',false);this.dummy.setThrottle(0);return;
    }
    this.phase='curve-drive';
  }
  const target=labCurveLookahead(path,position,state.progress,options.lookahead);
  const steering=labPurePursuit(position,this.cmdYaw,target,!!step.rev);
  // Recover after a collision without powering sideways into a large heading error.
  if(Math.abs(steering.error)>1.2) {
    this.dummy.setKey('KeyW',false);this.dummy.setKey('KeyS',false);this.dummy.setThrottle(0);
    this._steerToward(steering.bearing,dt);return;
  }
  const velocity=Math.max(.04,Math.abs(this.robot.drivetrain?.speed??0));
  const yawRate=labCurveClamp(velocity*steering.curvature,-M.auton.turnRate,M.auton.turnRate);
  this.cmdYaw=Wt(this.cmdYaw+yawRate*dt);this.dummy.setYaw(this.cmdYaw);
  // Fixed 100% uses exactly the same throttle as a normal W/S DRIVE block.
  // Corner and endpoint easing is available only when explicitly selected.
  const turnScale=options.adaptive?1/Math.sqrt(1+Math.abs(steering.curvature)*.4):1;
  const endScale=options.adaptive?labCurveClamp(endDistance/Math.max(options.lookahead,.2),.18,1):1;
  const throttle=options.speed*turnScale*endScale*(step.rev?-LAB_AUTON_REVERSE_SCALE:1);
  this.dummy.setThrottle(throttle);
  this.dummy.setKey('KeyW',!step.rev);this.dummy.setKey('KeyS',!!step.rev);
};

const labCurveOriginalIdle=PL.prototype._idle;
PL.prototype._idle=function() {
  this.dummy?.setThrottle?.(undefined);
  return labCurveOriginalIdle.call(this);
};
// AUTON_LAB_CURVE_RUNNER_END
