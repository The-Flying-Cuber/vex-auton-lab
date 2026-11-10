// Added to the pinned Vsimulator module by scripts/build.mjs. Keeping the
// extension here leaves the upstream editor, renderer and physics intact.
const lab = {
  key: 'vexAutonLab.v1',
  mode: 'match',
  run: 'both',
  active: 0,
  camera: 'locked',
  testing: false,
  config: null,
  slots: [0, 1],
  get duration() { return this.mode === 'skills' ? 60 : 15; },
  defaults() {
    const starts = qc();
    const skillsStart = wf(lf());
    return {
      mode: 'match', run: 'both', active: 0, camera: 'locked',
      routines: { match: ['default', 'lab-match-2'], skills: ['lab-skills-1', 'lab-skills-2'] },
      poses: {
        match: [starts.red1, starts.red2],
        skills: [{ ...skillsStart }, { ...starts.red1 }]
      }
    };
  },
  load() {
    const defaults = this.defaults();
    let stored;
    try { stored = JSON.parse(localStorage.getItem(this.key)); } catch {}
    this.config = defaults;
    if (stored && typeof stored === 'object') {
      if (['match','skills'].includes(stored.mode)) this.config.mode = stored.mode;
      if (['1','2','both'].includes(stored.run)) this.config.run = stored.run;
      this.config.active = stored.active === 1 ? 1 : 0;
      if (['locked','free'].includes(stored.camera)) this.config.camera=stored.camera;
      for (const mode of ['match','skills']) {
        for (let index = 0; index < 2; index++) {
          const id = stored.routines?.[mode]?.[index];
          if (typeof id === 'string') this.config.routines[mode][index] = id;
          const pose = stored.poses?.[mode]?.[index];
          if (pose && [pose.x,pose.z,pose.yaw].every(Number.isFinite)) {
            const limit = Hn();
            this.config.poses[mode][index] = { x:us(pose.x,-limit,limit), z:us(pose.z,-limit,limit), yaw:Wt(pose.yaw) };
          }
        }
      }
    }
    this.mode = this.config.mode;
    this.run = this.config.run;
    this.active = this.config.active;
    this.camera = this.config.camera;
    const store = Zy();
    for (const mode of ['match','skills']) {
      for (let index = 0; index < 2; index++) {
        const id = this.config.routines[mode][index];
        if (!store.autos.some(auto => auto.id === id)) {
          const replacement = `lab-${mode}-${index+1}`;
          if (!store.autos.some(auto => auto.id === replacement)) {
            store.autos.push({ id:replacement, name:`${mode === 'match' ? 'Match' : 'Skills'} · Robot ${index+1}`, steps:[] });
          }
          this.config.routines[mode][index] = replacement;
        }
      }
    }
    Wa(store);
    this.save();
  },
  save() {
    if (!this.config) return;
    Object.assign(this.config, { mode:this.mode, run:this.run, active:this.active, camera:this.camera });
    try { localStorage.setItem(this.key, JSON.stringify(this.config)); } catch {}
  },
  editorPose() { return this.config?.poses[this.mode][this.active] || tE('red'); },
  syncStartInputs() {
    const pose=this.editorPose();
    for(const input of document.querySelectorAll('#lab-options [data-start-axis]')) {
      const axis=input.dataset.startAxis;
      input.value=String(VC(axis==='yaw'?pose.yaw*180/Math.PI:pose[axis]));
    }
  },
  clampRedStart(pose) {
    const limit=Hn();
    // The red alliance has two adjacent starting walls, one per red quadrant.
    return Math.abs(pose.x+limit)<Math.abs(pose.z-limit)
      ? {x:-limit,z:us(pose.z,-limit,limit),yaw:pose.yaw}
      : {x:us(pose.x,-limit,limit),z:limit,yaw:pose.yaw};
  },
  openStartEditor() {
    if(this.startEditing||!Y.open)return;
    const panel=document.getElementById('spPanel');
    const state={
      poses:this.config.poses[this.mode].map(pose=>({...pose})),
      active:this.active,
      previousState:iI,
      previousOverlay:Object.keys(rA.overlays).find(key=>!rA.overlays[key].classList.contains('hidden'))||'home',
      getRobot:EB.getRobot,lockWall:EB.lockWall,clampFn:EB.clampFn,onChange:EB.onChange,
      rootDisplay:Y.root.style.display,
      heading:panel.querySelector('h2').textContent,
      instruction:panel.querySelector('.sp-instr').innerHTML,
      presetDisplay:document.getElementById('spPresets').style.display,
      presetLabelDisplay:document.getElementById('spPresetsLbl').style.display,
      saveOnceDisplay:document.getElementById('spSaveOnce').style.display,
      saveAlwaysText:document.getElementById('spSaveAlways').textContent
    };
    this.startEditing=state;
    const run=this.run;this.run='both';this.prepare();this.run=run;
    state.robots=qI.slice();
    EB.getRobot=()=>state.robots[state.active];EB.lockWall=null;EB.drag=null;
    EB.clampFn=pose=>this.clampRedStart(pose);
    EB.onChange=pose=>{state.poses[state.active]={...pose};this.updateStartEditor();};
    for(let index=0;index<2;index++){
      state.robots[index].root.position.set(state.poses[index].x,0,state.poses[index].z);
      state.robots[index].root.rotation.y=state.poses[index].yaw;
      Rg.updateRobot(state.robots[index]);
    }
    const robots=tI('div','sp-presets');robots.id='lab-start-robots';
    for(let index=0;index<2;index++){
      const button=tI('button','sp-preset',`Robot ${index+1}`);button.dataset.robot=String(index);
      button.onclick=()=>{state.active=index;this.updateStartEditor();};robots.append(button);
    }
    panel.querySelector('.sp-instr').insertAdjacentElement('afterend',robots);
    const status=tI('p','sp-instr');status.id='lab-start-status';robots.insertAdjacentElement('afterend',status);
    panel.querySelector('.sp-instr').innerHTML='Drag the robot along either red wall to move it.<br>Drag the handle to rotate it.';
    document.getElementById('spPresets').style.display='';document.getElementById('spPresetsLbl').style.display='';
    panel.querySelectorAll('[data-team]').forEach(button=>{button.style.display=button.dataset.team.startsWith('red')?'':'none';});
    document.getElementById('spSaveOnce').style.display='none';
    document.getElementById('spSaveAlways').textContent='Save starts';
    Y.root.style.display='none';iI=WA.MATCH_CONFIG;rA.show('startPos');wB(false);
    this.updateStartEditor();EB.open();
  },
  updateStartEditor() {
    const state=this.startEditing;if(!state)return;
    document.querySelector('#spPanel h2').textContent=`Robot ${state.active+1} Starting Position`;
    document.querySelectorAll('#lab-start-robots button').forEach(button=>button.classList.toggle('lab-start-selected',Number(button.dataset.robot)===state.active));
    const sameQuadrant=(Math.abs(state.poses[0].x+Hn())<.01)===(Math.abs(state.poses[1].x+Hn())<.01);
    document.getElementById('lab-start-status').textContent=this.mode==='skills'
      ? sameQuadrant?'For VEXU Skills, use separate red quadrants. Red 1 and Red 2 are available below.':'Both robots are in separate red starting quadrants.'
      : 'Set each robot independently with Red 1 and Red 2.';
  },
  startPreset(name) {
    const pose=qc()[name];if(!pose||!name.startsWith('red'))return;
    EB.setPose(pose);this.startEditing.poses[this.startEditing.active]={...pose};this.updateStartEditor();
  },
  closeStartEditor(save) {
    const state=this.startEditing;if(!state)return;
    EB.drag=null;EB.close();
    if(save)this.config.poses[this.mode]=state.poses.map(pose=>({...pose}));
    EB.getRobot=state.getRobot;EB.lockWall=state.lockWall;EB.clampFn=state.clampFn;EB.onChange=state.onChange;
    this.startEditing=null;
    const panel=document.getElementById('spPanel');panel.querySelector('h2').textContent=state.heading;
    panel.querySelector('.sp-instr').innerHTML=state.instruction;
    document.getElementById('lab-start-robots').remove();document.getElementById('lab-start-status').remove();
    panel.querySelectorAll('[data-team]').forEach(button=>button.style.display='');
    document.getElementById('spPresets').style.display=state.presetDisplay;
    document.getElementById('spPresetsLbl').style.display=state.presetLabelDisplay;
    document.getElementById('spSaveOnce').style.display=state.saveOnceDisplay;
    document.getElementById('spSaveAlways').textContent=state.saveAlwaysText;
    iI=state.previousState;rA.show(state.previousOverlay);Y.root.style.display=state.rootDisplay;
    this.save();this.prepare();tp();this.mountControls();rC();Bg();
  },
  bindStartDrag() {
    const canvas=Y.canvas;
    if(!canvas||canvas.dataset.labStartDrag)return;
    canvas.dataset.labStartDrag='1';
    canvas.setAttribute('aria-label','Auton field. Drag the numbered start node to move it, or its small direction handle to turn it.');
    canvas.title='Drag the numbered start node to move. Drag its small handle to turn.';
    const hit=(event)=>{
      const rect=canvas.getBoundingClientRect(),pose=this.editorPose();
      const x=(Pg-pose.x)/(2*Pg)*rect.width+rect.left;
      const y=(Pg-pose.z)/(2*Pg)*rect.height+rect.top;
      const length=26*rect.width/ja;
      const rotate=Math.hypot(event.clientX-(x-Math.sin(pose.yaw)*length),event.clientY-(y-Math.cos(pose.yaw)*length))<10;
      return {x,y,rotate,move:Math.hypot(event.clientX-x,event.clientY-y)<13};
    };
    let drag=null;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||Y.pickGoalFor>=0)return;
      const target=hit(event);
      if(!target.rotate&&!target.move)return;
      event.preventDefault();event.stopImmediatePropagation();
      drag={id:event.pointerId,rotate:target.rotate,original:{...this.editorPose()}};
      canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
    },true);
    canvas.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      event.preventDefault();event.stopImmediatePropagation();
      const pose=this.editorPose();
      if(drag.rotate){
        const center=hit(event);
        if(Math.hypot(event.clientX-center.x,event.clientY-center.y)>5)pose.yaw=Wt(Math.atan2(center.x-event.clientX,center.y-event.clientY));
      }else{
        const point=Wy(event.clientX,event.clientY),limit=Hn();
        pose.x=VC(us(point.x,-limit,limit));pose.z=VC(us(point.z,-limit,limit));
      }
      this.syncStartInputs();oE();
    },true);
    const finish=(event,cancel=false)=>{
      if(!drag||event.pointerId!==drag.id)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(cancel)Object.assign(this.editorPose(),drag.original);
      drag=null;
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor='grab';this.save();this.prepare();tp();rC();this.syncStartInputs();
    };
    canvas.addEventListener('pointerup',event=>finish(event),true);
    canvas.addEventListener('pointercancel',event=>finish(event,true),true);
    canvas.addEventListener('pointermove',event=>{
      if(drag||Y.dragWaypoint>=0||Y.pickGoalFor>=0)return;
      const target=hit(event);
      if(target.move||target.rotate)canvas.style.cursor='grab';
    });
  },
  steps(index) {
    const store = Y.open && Y.store ? Y.store : Zy();
    const id = this.config.routines[this.mode][index];
    return (store.autos.find(auto => auto.id === id)?.steps || []).map(step => ({...step}));
  },
  remember() {
    if (!this.config || !Y.store) return;
    const id = Y.store.selectedId;
    if (Y.store.autos.some(auto => auto.id === id)) this.config.routines[this.mode][this.active] = id;
    this.save();
  },
  selectRoutine() {
    const store = Y.store || Zy();
    let id = this.config.routines[this.mode][this.active];
    if (!store.autos.some(auto => auto.id === id)) {
      id = store.autos[0]?.id;
      this.config.routines[this.mode][this.active] = id;
    }
    store.selectedId = id;
    Wa(store);
    if (Y.open) { Y.store=store; kl(id); }
  },
  prepare() {
    if (!aE) return;
    bg();
    mI = this.mode;
    PH(this.duration, this.duration);
    GB.attachScene({
      renderer:Cg, scene:lg, getAlliance:()=>'red', getGoals:()=>eg || [],
      getOccluders:()=>[Gi, ...qI.map(robot=>robot.root)].filter(Boolean)
    });
  },
  switchTo(change) {
    gr(() => {
      this.remember();
      change();
      this.save();
      this.selectRoutine();
      this.prepare();
      tp();
      this.mountControls();
      rC();
    });
  },
  populate() {
    Wp();
    LD();
    this.slots = this.run === 'both' ? [0,1] : [Number(this.run)-1];
    qI = this.slots.map((slot, index) => index === 0 ? wA : Ki[0]);
    nE.setRobots(qI);
    for (let index = 0; index < qI.length; index++) {
      const robot = qI[index];
      const slot = this.slots[index];
      robot._autonRunner = null;
      robot.activeMode = mI;
      if (!robot._physBody) Rg.addRobot(robot);
      robot.root.visible = true;
      robot.reset({ mode:mI, alliance:'red', startPose:this.config.poses[mI][slot] });
      // Reset the primary preload reference too, so every run starts identically.
      if (index === 0) {
        if (ge) { Kg.remove(ge); ge=null; }
        ge = Kg.makeHeldPin('red','yellow');
        robot.transfer.loadPreload(ge);
      } else {
        robot.transfer.loadPreload(Kg.makeHeldPin('red','yellow'));
      }
      if (!robot._dummy) robot._dummy = new Xn();
      robot._dummy.setYaw(robot.root.rotation.y);
      this.label(robot, slot);
    }
    // Keep hidden robots out of collision, scoring, and loader updates.
    SI.yaw = wA.root.rotation.y;
    eI.update(wA);
    eI.updateScore(Br(), UI.clockString(), mI);
  },
  label(robot, slot) {
    if (robot._labLabelSlot === slot) return;
    if (robot._labLabel) {
      robot.root.remove(robot._labLabel);
      robot._labLabel.material.map.dispose();
      robot._labLabel.material.dispose();
    }
    const canvas = document.createElement('canvas');
    canvas.width=128; canvas.height=128;
    const context=canvas.getContext('2d');
    context.fillStyle=slot===0?'#7fdcff':'#ffb068';
    context.beginPath(); context.arc(64,64,48,0,Math.PI*2); context.fill();
    context.fillStyle='#04101f'; context.font='800 72px sans-serif';
    context.textAlign='center'; context.textBaseline='middle'; context.fillText(String(slot+1),64,68);
    const texture=new RM(canvas); texture.colorSpace=AC;
    const sprite=new FM(new sc({map:texture,depthTest:false}));
    sprite.scale.set(.2/M.robot.scale,.2/M.robot.scale,1);
    sprite.position.y=.62/M.robot.scale;
    robot.root.add(sprite); robot._labLabel=sprite; robot._labLabelSlot=slot;
  },
  startRunners() {
    for (let index=0; index<qI.length; index++) {
      const robot=qI[index];
      robot._autonDummy = index===0 ? new Xn() : robot._dummy;
      robot._autonDummy.setYaw(robot.root.rotation.y);
      robot._autonRunner=new PL(robot,robot._autonDummy,this.steps(this.slots[index]));
      // Editor waypoints are absolute field coordinates. Each robot has its own
      // origin marker; moving Robot 2's start must not rotate its whole route.
      const runner=robot._autonRunner;
      runner._s0x=runner._s1x; runner._s0z=runner._s1z;
      runner._c=1; runner._s=0; runner._dyaw=0;
    }
  },
  drawOtherRobot(context, dpr, size, toX, toZ) {
    if (!this.config) return;
    const other=1-this.active;
    const pose=this.config.poses[this.mode][other];
    context.save();
    context.globalAlpha=this.run==='both'?.75:.3;
    context.strokeStyle=other===0?'#7fdcff':'#ffb068';
    context.fillStyle=context.strokeStyle;
    context.lineWidth=2*dpr; context.setLineDash([4*dpr,4*dpr]);
    context.beginPath(); context.moveTo(toX(pose.x),toZ(pose.z));
    for (const step of this.steps(other)) if (step.t==='driveTo') context.lineTo(toX(step.x),toZ(step.z));
    context.stroke(); context.setLineDash([]);
    context.beginPath(); context.arc(toX(pose.x),toZ(pose.z),8*dpr,0,Math.PI*2); context.fill();
    context.fillStyle='#04101f'; context.font=`800 ${10*dpr}px sans-serif`;
    context.textAlign='center'; context.textBaseline='middle'; context.fillText(String(other+1),toX(pose.x),toZ(pose.z));
    const own=this.editorPose();
    context.globalAlpha=1; context.fillStyle=this.active===0?'#7fdcff':'#ffb068';
    // A second handle edits heading without adding an auton command.
    const centerX=toX(own.x),centerY=toZ(own.z);
    const directionX=-Math.sin(own.yaw),directionY=-Math.cos(own.yaw);
    const handleX=centerX+directionX*26*dpr,handleY=centerY+directionY*26*dpr;
    context.strokeStyle=context.fillStyle;context.lineWidth=2*dpr;
    context.beginPath();context.moveTo(centerX+directionX*9*dpr,centerY+directionY*9*dpr);context.lineTo(handleX,handleY);context.stroke();
    context.beginPath();context.arc(handleX,handleY,5*dpr,0,Math.PI*2);context.fill();
    context.beginPath(); context.arc(toX(own.x),toZ(own.z),8*dpr,0,Math.PI*2); context.fill();
    context.fillStyle='#04101f'; context.fillText(String(this.active+1),toX(own.x),toZ(own.z));
    context.restore();
  },
  mountControls() {
    document.getElementById('lab-options')?.remove();
    const bar=document.createElement('div'); bar.id='lab-options';
    const group=(text)=>{ const el=document.createElement('div');el.className='lab-group';const label=document.createElement('span');label.className='lab-label';label.textContent=text;el.append(label);bar.append(el);return el; };
    const button=(parent,text,selected,action)=>{
      const el=tI('button','auton-revmini'+(selected?' rev':''),text);
      el.type='button';el.setAttribute('aria-pressed',String(selected));el.onclick=action;parent.append(el);return el;
    };
    const field=group('FIELD');
    button(field,'Match · 15 sec',this.mode==='match',()=>this.switchTo(()=>{this.mode='match';}));
    button(field,'Skills · 60 sec',this.mode==='skills',()=>this.switchTo(()=>{this.mode='skills';}));
    const robots=group('RUN');
    button(robots,'Robot 1',this.run==='1',()=>this.switchTo(()=>{this.run='1';}));
    button(robots,'Robot 2',this.run==='2',()=>this.switchTo(()=>{this.run='2';}));
    button(robots,'Both robots',this.run==='both',()=>this.switchTo(()=>{this.run='both';}));
    const editing=group('EDITING');
    button(editing,'Edit Robot 1',this.active===0,()=>this.switchTo(()=>{this.active=0;}));
    button(editing,'Edit Robot 2',this.active===1,()=>this.switchTo(()=>{this.active=1;}));
    const camera=group('VIEW');
    button(camera,'Locked view',this.camera==='locked',()=>{this.setCamera('locked');this.mountControls();});
    button(camera,'Free cam',this.camera==='free',()=>{this.setCamera('free');this.mountControls();});
    const start=group('START');
    button(start,'Customize start',false,()=>this.openStartEditor());
    const pose=this.editorPose();
    for (const [key,label,value] of [['x','X (m)',pose.x],['z','Z (m)',pose.z],['yaw','Heading (°)',pose.yaw*180/Math.PI]]) {
      const wrap=document.createElement('label');wrap.className='lab-pose-label';wrap.textContent=label;
      const input=document.createElement('input');input.type='number';input.className='auton-in';input.value=String(Math.round(value*100)/100);
      input.step=key==='yaw'?'5':'.05';input.setAttribute('aria-label',`Robot ${this.active+1} start ${label}`);
      input.dataset.startAxis=key;
      input.onchange=()=>{if(!Number.isFinite(input.valueAsNumber))return;const limit=Hn();pose[key]=key==='yaw'?Wt(input.valueAsNumber*Math.PI/180):us(input.valueAsNumber,-limit,limit);this.save();this.prepare();tp();rC();};
      wrap.append(input);start.append(wrap);
    }
    button(start,'Reset start',false,()=>{this.config.poses[this.mode][this.active]={...this.defaults().poses[this.mode][this.active]};this.save();this.prepare();tp();this.mountControls();rC();});
    Y.panel.insertBefore(bar,Y.panel.querySelector('.auton-body'));
    Y.panel.querySelector('.lab-run')?.remove();
    const test=tI('button','auton-btn good lab-run',`▶ RUN ${this.duration} SEC`);
    test.onclick=()=>{
      kD();Y.store.selectedId=Y.editingId;Wa(Y.store);this.remember();
      op();this.testing=true;M.controls.matchAuton=true;
      mD(this.mode);this.showRunBar();
    };
    Y.panel.querySelector('.auton-foot').append(test);
    const title=Y.panel.querySelector('.auton-title');
    title.innerHTML=`AUTON<em>CODER</em><small>${this.mode==='skills'?'SKILLS':'MATCH'} · ROBOT ${this.active+1}</small>`;
    Y.panel.querySelectorAll('.auton-foot button:not(.lab-run)').forEach(el=>{
      if(!el.dataset.labRemember){el.dataset.labRemember='1';el.addEventListener('click',()=>this.remember());}
    });
    this.bindStartDrag();
  },
  redSideView() {
    if(this.originalFov==null)this.originalFov=xg.fov;
    xg.fov=42;xg.updateProjectionMatrix();
    Lg.pos.set(0,2.9,3.55);
    Lg.yaw=0;Lg.pitch=Math.atan2(.1-2.9,3.2);Lg.speed=M.spectator.speed;
    Lg.update(0,lA,true);
    this.applyCamera(false);
  },
  restoreCameraFov() {
    if(this.originalFov==null)return;
    xg.fov=this.originalFov;xg.updateProjectionMatrix();this.originalFov=null;
  },
  setCamera(mode) {
    this.camera=mode==='free'?'free':'locked';this.save();
    this.applyCamera();
  },
  applyCamera(capture=true) {
    if(this.testing){
      Vi=false;ig=this.camera==='free';$C=!ig;
      if(ig){if(capture)lA.requestLock();}
      else lA.exitLock();
    }
    const button=document.getElementById('lab-camera-toggle');
    if(button)button.textContent=this.camera==='free'?'View: Free cam · F':'View: Locked · F';
  },
  showRunBar() {
    let bar=document.getElementById('lab-runbar');
    if (!bar) {
      bar=tI('div');bar.id='lab-runbar';
      const back=tI('button','auton-btn','← Edit auton');back.onclick=()=>this.returnToEditor();
      const camera=tI('button','auton-btn');camera.id='lab-camera-toggle';
      camera.title='Click or press F to switch between locked view and free camera';
      camera.onclick=()=>this.setCamera(this.camera==='free'?'locked':'free');
      const text=tI('span');text.id='lab-run-summary';
      const progress=tI('span');progress.id='lab-run-progress';progress.setAttribute('aria-live','off');
      bar.append(back,camera,text,progress);document.body.append(bar);
    }
    document.getElementById('lab-run-summary').textContent=`${this.mode==='skills'?'Skills · 60 sec':'Match · 15 sec'} · ${this.run==='both'?'2 robots':`Robot ${this.run}`}`;
    bar.hidden=false;
    this.applyCamera(false);
    this.updateProgress();
  },
  updateProgress() {
    if(!this.testing)return;
    const progress=document.getElementById('lab-run-progress');
    if(!progress)return;
    progress.textContent=qI.map((robot,index)=>{
      const runner=robot._autonRunner;
      return `R${this.slots[index]+1}: ${runner&&!runner.done?`${runner.i+1}/${runner.steps.length}`:'done'}`;
    }).join(' · ');
    progress.dataset.remaining=String(UI.timeLeft);
    progress.dataset.running=String(UI.running);
    progress.dataset.robots=JSON.stringify(qI.map((robot,index)=>({slot:this.slots[index]+1,x:robot.root.position.x,z:robot.root.position.z,step:robot._autonRunner?.i??-1,done:robot._autonRunner?.done??true})));
  },
  returnToEditor() {
    bg();lA.exitLock();rB();this.testing=false;iI=WA.HOME;rA.show('home');Bg();
    GB.open();
  },
  exportProject() {
    const data={format:'vex-auton-lab',version:1,settings:this.config,library:Zy()};
    const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    link.href=url;link.download='auton-routines.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  afterBoot() {
    // Online accounts/scores remain on the original simulator. This fork runs
    // entirely as static files and never submits modified runs to its services.
    for (const key of ['onMultiplayer','onLeaderboard','onLogin']) rA.cb[key]=()=>window.open('https://sim.robostem.org/','_blank','noopener');
    const home=document.getElementById('homePlay');
    const open=tI('button','item','Auton Coder');open.id='homeAutonLab';open.onclick=()=>GB.open();home.insertAdjacentElement('afterend',open);
    const version=document.getElementById('homeVersion');version.textContent+=' · Auton Lab';
    version.title='Unofficial extension of RoboSTEM Vsimulator';
    const style=document.createElement('style');style.textContent=LAB_CSS;document.head.append(style);
    const lockChanged=lA.onLockChange;
    lA.onLockChange=(...args)=>{if(this.testing&&this.camera==='locked')return;lockChanged(...args);};
    const lockError=lA.onLockError;
    lA.onLockError=(...args)=>{if(this.testing&&this.camera==='locked')return;lockError(...args);};
    window.addEventListener('keydown',event=>{
      if(this.startEditing&&event.code==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();this.closeStartEditor(false);return;
      }
      if(event.code!=='KeyF'||event.repeat||!this.testing||iI!==WA.PLAYING||GB.isOpen())return;
      if(event.target instanceof Element&&event.target.closest('input,textarea,[contenteditable="true"]'))return;
      event.preventDefault();event.stopImmediatePropagation();
      this.setCamera(this.camera==='free'?'locked':'free');
    },true);
    for(const key of ['onSpPreset','onSpSave','onSpReset','onSpCancel']){
      const original=rA.cb[key];
      rA.cb[key]=(...args)=>{
        if(!this.startEditing)return original(...args);
        if(key==='onSpPreset')this.startPreset(args[0]);
        else if(key==='onSpSave')this.closeStartEditor(true);
        else if(key==='onSpCancel')this.closeStartEditor(false);
        else{
          const index=this.startEditing.active,pose=this.defaults().poses[this.mode][index];
          EB.setPose(pose);this.startEditing.poses[index]={...pose};this.updateStartEditor();
        }
      };
    }
    this.selectRoutine();
    // A direct link opens the same editor; all original singleplayer menus stay.
    if (new URLSearchParams(location.search).get('auton')==='1') GB.open();
  }
};

const LAB_CSS=`
 #lab-options{display:flex;flex-wrap:wrap;gap:12px 20px;padding:12px 22px;border-bottom:1px solid rgba(125,165,225,.1);background:rgba(127,220,255,.025)}
 .lab-group{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
 .lab-label{font-size:10px;font-weight:800;letter-spacing:.12em;color:#9fb2d2;margin-right:4px}
 .lab-pose-label{font-size:10px;color:#9fb2d2;display:flex;align-items:center;gap:4px}
 .lab-pose-label input{width:65px!important}
 #lab-start-robots .lab-start-selected{background:#37a0ff;color:#04101f;border-color:#37a0ff}
 .auton-title small{display:block;font-size:9px;letter-spacing:.08em;margin-top:5px;color:#7fdcff;white-space:nowrap}
 .auton-foot .lab-run{margin-left:auto;white-space:nowrap}
 #lab-runbar{position:fixed;z-index:1200;right:18px;top:76px;display:flex;align-items:center;gap:10px;font:600 12px var(--ui-font);color:#e8edf5;background:rgba(12,16,24,.8);padding:8px 12px;border-radius:10px;backdrop-filter:blur(4px)}
 #lab-run-progress{color:#7fdcff;font-variant-numeric:tabular-nums}
 #lab-runbar[hidden]{display:none}
 .auton-panel{max-height:95vh!important}
 @media(max-width:880px){.auton-panel{overflow:auto!important}.auton-left{align-items:center}.auton-canvas{max-width:100%;height:auto!important}.auton-left{padding:12px!important}.auton-right{min-height:300px}.auton-title{font-size:11px!important}#lab-options{padding:10px 12px;gap:8px}.auton-head{padding:12px!important}#lab-runbar span{display:none}}
`;

lab.load();
M.scoring.robotAlliance='red';
M.arena.warehouse.enabled=false;
vg='override';
// The fork has no account server. Keep all routines and settings in this origin.
re=async()=>{go=false;dI=null;rA.setAuthEnabled(false);};
const labOriginalPH=PH;
PH=function(duration,autonDuration=0){
  labOriginalPH(duration,autonDuration);
  lab.mode=mI==='skills'?'skills':'match';
  lab.populate();
};
ZH=()=>lab.startRunners();
const labOriginalMD=mD;
mD=function(mode){labOriginalMD(mode);if(lab.testing)lab.redSideView();};
const labRequestLock=lA.requestLock.bind(lA);
lA.requestLock=function(){if(lab.testing&&lab.camera==='locked')return;return labRequestLock();};
const labOriginalOpen=GB.open.bind(GB);
GB.open=function(onClose){
  if(Y.open)return;
  lab.restoreCameraFov();
  lab.prepare();lab.selectRoutine();
  document.getElementById('lab-runbar')?.setAttribute('hidden','');
  labOriginalOpen(()=>{lab.remember();if(typeof onClose==='function')onClose();});
  lab.mountControls();rC();
};
const labOriginalTT=tt;
tt=function(){lab.testing=false;lab.restoreCameraFov();document.getElementById('lab-runbar')?.setAttribute('hidden','');labOriginalTT();};
window.autonLab=lab;
ox().then(()=>lab.afterBoot()).catch(error=>{
  console.error('Auton Lab failed to start',error);
  const loading=document.getElementById('loadingScreen');
  if(loading){loading.classList.remove('hidden');loading.textContent='Could not load the simulator. Reload the page to retry.';}
});
