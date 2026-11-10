// A loader visit belongs to a robot, rather than to everybody near the station.
// Keep the original trigger, stock counts, possession limits, and spawn checks.
function labRefreshLoaderVisits(station,robots) {
  station._labServed??=new Set();
  const settings=M.matchLoad;
  for(const robot of station._labServed) {
    if(!robots.includes(robot)||!mS(robot.root.position,station.trigger,settings.triggerHalfWidth+settings.rearmMargin,settings.triggerHalfDepth+settings.rearmMargin))station._labServed.delete(robot);
  }
}

function labRobotCanLoad(station,robot) {
  return !station._labServed.has(robot)&&!!robot.transfer?.matchLoadNeed();
}
