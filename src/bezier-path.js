// Shared geometry for the field preview and the pure pursuit follower.
export function labCurveClamp(value,low,high) {
  return Math.max(low,Math.min(high,value));
}

export function labCurveOptions(step) {
  return {
    lookahead:labCurveClamp(Number.isFinite(step.lookahead)?step.lookahead:.3,.1,1),
    speed:labCurveClamp(Number.isFinite(step.speed)?step.speed:1,.1,1),
    adaptive:step.adaptive===true
  };
}

export function labBezierPoint(start,step,t) {
  const u=1-t,a=u*u*u,b=3*u*u*t,c=3*u*t*t,d=t*t*t;
  return {x:a*start.x+b*step.c1x+c*step.c2x+d*step.x,z:a*start.z+b*step.c1z+c*step.c2z+d*step.z};
}

export function labMakeCurve(start,end,{bend=.18,rev=false,lookahead=.3,speed=1,adaptive=false,limit=Infinity}={}) {
  const dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz);
  const offset=Math.min(Math.abs(bend),length*.3)*Math.sign(bend);
  const nx=length>1e-8?dz/length:0,nz=length>1e-8?-dx/length:0;
  const bound=value=>labCurveClamp(value,-limit,limit);
  return {
    t:'curveTo',x:bound(end.x),z:bound(end.z),
    c1x:bound(start.x+dx/3+nx*offset),c1z:bound(start.z+dz/3+nz*offset),
    c2x:bound(start.x+dx*2/3+nx*offset),c2z:bound(start.z+dz*2/3+nz*offset),
    rev:!!rev,...labCurveOptions({lookahead,speed,adaptive})
  };
}

export function labCurveStart(steps,index,pose) {
  let point={x:pose.x,z:pose.z};
  for(let i=0;i<index;i++) {
    const step=steps[i];
    if((step.t==='driveTo'||step.t==='curveTo')&&Number.isFinite(step.x)&&Number.isFinite(step.z))point={x:step.x,z:step.z};
    else if(step.t==='score'&&Number.isFinite(step.gx)&&Number.isFinite(step.gz))point={x:step.gx,z:step.gz};
  }
  return point;
}

export function labSampleBezier(start,step) {
  // Flat numeric fields keep old routine copies, undo, and browser saves safe.
  const linear=labMakeCurve(start,{x:Number.isFinite(step.x)?step.x:start.x,z:Number.isFinite(step.z)?step.z:start.z},{bend:0});
  const curve={...linear,...step};
  for(const key of ['x','z','c1x','c1z','c2x','c2z'])if(!Number.isFinite(curve[key]))curve[key]=linear[key];
  const upper=Math.hypot(curve.c1x-start.x,curve.c1z-start.z)+Math.hypot(curve.c2x-curve.c1x,curve.c2z-curve.c1z)+Math.hypot(curve.x-curve.c2x,curve.z-curve.c2z);
  const count=labCurveClamp(Math.ceil(upper/.02),32,400),points=[{...start,s:0}];
  for(let i=1;i<=count;i++) {
    const point=labBezierPoint(start,curve,i/count),previous=points.at(-1);
    points.push({...point,s:previous.s+Math.hypot(point.x-previous.x,point.z-previous.z)});
  }
  return {points,length:points.at(-1).s};
}

export function labCurveAt(path,distance) {
  const points=path.points,s=labCurveClamp(distance,0,path.length);
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];
    if(b.s<s)continue;
    const t=(s-a.s)/Math.max(1e-12,b.s-a.s);
    return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,s};
  }
  return {...points.at(-1)};
}

export function labCurveProject(path,point,minS=0,maxS=path.length) {
  let best={...labCurveAt(path,minS),distance:Infinity};
  for(let i=1;i<path.points.length;i++) {
    const a=path.points[i-1],b=path.points[i];
    if(b.s<minS||a.s>maxS)continue;
    const dx=b.x-a.x,dz=b.z-a.z,span=b.s-a.s;
    if(span<1e-10)continue;
    const low=labCurveClamp((minS-a.s)/span,0,1),high=labCurveClamp((maxS-a.s)/span,0,1);
    const t=labCurveClamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz),low,high);
    const x=a.x+t*dx,z=a.z+t*dz,distance=Math.hypot(point.x-x,point.z-z);
    if(distance<best.distance)best={x,z,s:a.s+t*span,distance};
  }
  return best;
}

export function labCurveLookahead(path,point,progress,radius) {
  // Intersect the lookahead circle with the forward part of the sampled path.
  // A local arc-length window avoids jumping branches on a crossing curve.
  const maxS=Math.min(path.length,progress+Math.max(radius*2.5,.6));
  let target=null;
  for(let i=1;i<path.points.length;i++) {
    const a=path.points[i-1],b=path.points[i];
    if(b.s<progress||a.s>maxS)continue;
    const dx=b.x-a.x,dz=b.z-a.z,ox=a.x-point.x,oz=a.z-point.z;
    const aa=dx*dx+dz*dz;if(aa<1e-12)continue;
    const bb=2*(ox*dx+oz*dz),cc=ox*ox+oz*oz-radius*radius,disc=bb*bb-4*aa*cc;
    if(disc<0)continue;
    for(const t of [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)]) {
      const s=a.s+t*(b.s-a.s);
      if(t>=0&&t<=1&&s>=progress-1e-8&&s<=maxS+1e-8&&(!target||s>target.s))target={x:a.x+t*dx,z:a.z+t*dz,s};
    }
  }
  return target||labCurveAt(path,Math.min(path.length,progress+radius));
}

export function labPurePursuit(position,yaw,target,reverse=false) {
  const dx=target.x-position.x,dz=target.z-position.z,distance=Math.hypot(dx,dz);
  const motionYaw=yaw+(reverse?Math.PI:0),bearing=Math.atan2(dx,dz);
  const error=Math.atan2(Math.sin(bearing-motionYaw),Math.cos(bearing-motionYaw));
  return {error,bearing:Math.atan2(Math.sin(bearing+(reverse?Math.PI:0)),Math.cos(bearing+(reverse?Math.PI:0))),curvature:distance>1e-6?2*Math.sin(error)/distance:0};
}
