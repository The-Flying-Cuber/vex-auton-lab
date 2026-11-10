// A loader visit belongs to a robot, rather than to everybody near the station.
// Stock counts, possession limits, and spawn checks stay with the original loader.
function labRobotTouchesLoader(station,robot,margin=0) {
  const settings=M.matchLoad,position=robot.root.position;
  const halfX=settings.triggerHalfWidth+margin,halfZ=settings.triggerHalfDepth+margin;
  const dx=Math.abs(position.x-station.trigger.x)-halfX,dz=Math.abs(position.z-station.trigger.z)-halfZ;
  const radius=robot.drivetrain?.radius??.26*M.robot.scale;
  if(Math.hypot(Math.max(0,dx),Math.max(0,dz))<=radius)return true;
  if(!robot.intake)return false;
  // Match the actual intake mouth's rectangle, including its front reach.
  const yaw=robot.root.rotation.y,scale=M.robot.scale;
  const fx=Math.sin(yaw),fz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw);
  const near=robot.intake.frontZ-.08,far=robot.intake.frontZ+M.intake.reach;
  const center=(near+far)*.5*scale,length=(far-near)*.5*scale,width=M.intake.halfWidth*scale;
  const ox=position.x+fx*center-station.trigger.x,oz=position.z+fz*center-station.trigger.z;
  for(const [ax,az] of [[1,0],[0,1],[fx,fz],[sx,sz]]) {
    const gap=Math.abs(ox*ax+oz*az);
    const reach=halfX*Math.abs(ax)+halfZ*Math.abs(az)+length*Math.abs(fx*ax+fz*az)+width*Math.abs(sx*ax+sz*az);
    if(gap>reach)return false;
  }
  return true;
}

function labRefreshLoaderVisits(station,robots) {
  station._labServed??=new Set();
  const settings=M.matchLoad;
  for(const robot of station._labServed) {
    if(!robots.includes(robot)||!labRobotTouchesLoader(station,robot,settings.rearmMargin))station._labServed.delete(robot);
  }
}

function labRobotCanLoad(station,robot) {
  return !station._labServed.has(robot)&&!!robot.transfer?.matchLoadNeed();
}
