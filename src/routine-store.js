// Ownership belongs to a field and robot, never to the editor's global selection.
export function labRoutineOwner(mode, robot) {
  return `${mode}:robot${robot+1}`;
}

export function labCloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function labUniqueRoutineId(autos, makeId) {
  let id;
  do { id=makeId(); } while(autos.some(auto=>auto.id===id));
  return id;
}

export function labIsolateRoutines(library, assignments, makeId) {
  const store=labCloneData(library);
  const routines=labCloneData(assignments);
  const used=new Set();
  for(const mode of ['match','skills'])for(let robot=0;robot<2;robot++) {
    const owner=labRoutineOwner(mode,robot);
    let auto=store.autos.find(candidate=>candidate.id===routines[mode][robot]);
    if(!auto) {
      auto={id:labUniqueRoutineId(store.autos,makeId),name:`${mode==='skills'?'Skills':'Match'} · Robot ${robot+1}`,steps:[],labOwner:owner};
      store.autos.push(auto);
    }else if(used.has(auto.id)||(auto.labOwner&&auto.labOwner!==owner)) {
      auto={...labCloneData(auto),id:labUniqueRoutineId(store.autos,makeId),labOwner:owner};
      store.autos.push(auto);
    }else {
      auto.labOwner=owner;
      auto.steps=labCloneData(auto.steps);
    }
    routines[mode][robot]=auto.id;
    used.add(auto.id);
  }
  return {store,routines};
}

export function labSaveRoutine(library, edit, makeId) {
  const store=labCloneData(library);
  const owner=labRoutineOwner(edit.mode,edit.robot);
  let auto=store.autos.find(candidate=>candidate.id===edit.id);
  // Copying a saved path is allowed. Sharing its mutable record is not.
  if(!auto||auto.labOwner!==owner) {
    auto={id:labUniqueRoutineId(store.autos,makeId),labOwner:owner};
    store.autos.push(auto);
  }
  auto.name=String(edit.name||'').trim()||'Untitled auto';
  auto.steps=labCloneData(edit.steps||[]);
  store.selectedId=auto.id;
  return {store,id:auto.id};
}
