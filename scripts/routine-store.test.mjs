import assert from 'node:assert/strict';
import {labIsolateRoutines,labSaveRoutine,labRoutineOwner} from '../src/routine-store.js';

let sequence=0;
const makeId=()=>`test-${++sequence}`;
const legacy={selectedId:'shared',autos:[{id:'shared',name:'Saved auton',steps:[{t:'driveTo',x:1,z:.5}]}]};
const linked={match:['shared','shared'],skills:['shared','shared']};
const migrated=labIsolateRoutines(legacy,linked,makeId);
assert.equal(new Set(Object.values(migrated.routines).flat()).size,4,'Legacy shared assignments must become four independent paths');
assert.deepEqual(legacy.autos[0].steps,[{t:'driveTo',x:1,z:.5}],'Migration must preserve the original data');
for(const mode of ['match','skills'])for(let robot=0;robot<2;robot++) {
  const record=migrated.store.autos.find(auto=>auto.id===migrated.routines[mode][robot]);
  assert.equal(record.labOwner,labRoutineOwner(mode,robot));
  assert.deepEqual(record.steps,legacy.autos[0].steps);
}
const robot1=migrated.routines.skills[0],robot2=migrated.routines.skills[1];
const robot2Before=structuredClone(migrated.store.autos.find(auto=>auto.id===robot2));
const editedSteps=[{t:'driveTo',x:-1,z:.8},{t:'wait',ms:500}];
const saved=labSaveRoutine(migrated.store,{mode:'skills',robot:0,id:robot1,name:'Robot 1 route',steps:editedSteps},makeId);
assert.equal(saved.id,robot1);
assert.deepEqual(saved.store.autos.find(auto=>auto.id===robot2),robot2Before,'Saving Robot 1 must leave Robot 2 unchanged');
editedSteps[0].x=99;
assert.equal(saved.store.autos.find(auto=>auto.id===robot1).steps[0].x,-1,'Saved steps must not alias the editor buffer');
const copied=labSaveRoutine(saved.store,{mode:'skills',robot:0,id:robot2,name:'Copied route',steps:robot2Before.steps},makeId);
assert.notEqual(copied.id,robot2,'Choosing another robot’s saved path must copy it');
assert.deepEqual(copied.store.autos.find(auto=>auto.id===robot2),robot2Before);
const again=labIsolateRoutines(migrated.store,migrated.routines,makeId);
assert.deepEqual(again.routines,migrated.routines,'Reloading owned paths must keep their IDs stable');
console.log('Passed: legacy path isolation, independent saves, deep copies, safe path copying, and reload stability.');
