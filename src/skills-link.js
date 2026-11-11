const LAB_SKILLS_FRAGMENT='skills-route';

function labInRange(value,min,max) {
  return Number.isFinite(value)&&value>=min&&value<=max;
}

function labValidSkillsStep(step) {
  if(!step||typeof step!=='object')return false;
  const coordinate=value=>labInRange(value,-2,2);
  const optionalFlag=value=>value===undefined||typeof value==='boolean';
  switch(step.t) {
    case 'driveTo':
      return coordinate(step.x)&&coordinate(step.z)&&optionalFlag(step.rev);
    case 'curveTo':
      return [step.x,step.z,step.c1x,step.c1z,step.c2x,step.c2z].every(coordinate)
        &&optionalFlag(step.rev)&&optionalFlag(step.adaptive)
        &&(step.speed===undefined||labInRange(step.speed,.1,1))
        &&(step.lookahead===undefined||labInRange(step.lookahead,.1,1));
    case 'score':
      return coordinate(step.gx)&&coordinate(step.gz);
    case 'turnTo':
      return labInRange(step.yaw,-2*Math.PI,2*Math.PI);
    case 'lift':
      return labInRange(step.h,0,1);
    case 'intake':
    case 'wait':
      return labInRange(step.ms,0,60000);
    case 'intakeMode':
      return ['all','pin','cup'].includes(step.mode);
    case 'claw':
    case 'reverse':
      return true;
    default:
      return false;
  }
}

function labValidSkillsRobot(robot,limit) {
  const pose=robot?.pose;
  return pose&&labInRange(pose.x,-limit,limit)&&labInRange(pose.z,-limit,limit)
    &&labInRange(pose.yaw,-Math.PI,Math.PI)
    &&typeof robot.pins?.preloadFlipped==='boolean'
    &&typeof robot.pins.matchLoadPinFlipped==='boolean'
    &&Array.isArray(robot.steps)&&robot.steps.length<=250&&robot.steps.every(labValidSkillsStep);
}

async function labReadSkillsLink(hash,limit) {
  const payload=new URLSearchParams(hash.slice(1)).get(LAB_SKILLS_FRAGMENT);
  if(payload===null)return null;
  if(!/^[A-Za-z0-9_-]{1,9000}$/.test(payload))throw new Error('Invalid Skills route link');
  const bytes=Uint8Array.from(atob(payload.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decoded=await new Response(stream).text();
  if(decoded.length>60000)throw new Error('Skills route is too large');
  const route=JSON.parse(decoded);
  if(route?.version!==1||typeof route.name!=='string'||!route.name.trim()||route.name.length>64
    ||!Array.isArray(route.robots)||route.robots.length!==2||!route.robots.every(robot=>labValidSkillsRobot(robot,limit))) {
    throw new Error('Invalid Skills route data');
  }
  // Use a separate browser save for each linked pair of routines.
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(decoded)));
  const id=Array.from(digest.slice(0,12),byte=>byte.toString(16).padStart(2,'0')).join('');
  return {id,name:route.name.trim(),robots:route.robots};
}
