// Added to the pinned Vsimulator module by scripts/build.mjs. Keeping the
// extension here leaves the upstream editor, renderer and physics intact.
const lab = {
  key: 'vexAutonLab.v1',
  mode: 'match',
  run: 'both',
  active: 0,
  testing: false,
  config: null,
  slots: [0, 1],
  get duration() { return this.mode === 'skills' ? 60 : 15; },
  defaults() {
    const starts = qc();
    const skillsStart = wf(lf());
    return {
      mode: 'match', run: 'both', active: 0,
      routines: { match: ['default', 'lab-match-2'], skills: ['lab-skills-1', 'lab-skills-2'] },
      poses: {
        match: [starts.red1, starts.red2],
        skills: [{ ...skillsStart, z: .45 }, { ...skillsStart, z: -.45 }]
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
    Object.assign(this.config, { mode:this.mode, run:this.run, active:this.active });
    try { localStorage.setItem(this.key, JSON.stringify(this.config)); } catch {}
  },
  editorPose() { return this.config?.poses[this.mode][this.active] || tE('red'); },
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
    const start=group('START');
    const pose=this.editorPose();
    for (const [key,label,value] of [['x','X (m)',pose.x],['z','Z (m)',pose.z],['yaw','Heading (°)',pose.yaw*180/Math.PI]]) {
      const wrap=document.createElement('label');wrap.className='lab-pose-label';wrap.textContent=label;
      const input=document.createElement('input');input.type='number';input.className='auton-in';input.value=String(Math.round(value*100)/100);
      input.step=key==='yaw'?'5':'.05';input.setAttribute('aria-label',`Robot ${this.active+1} start ${label}`);
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
      mD(this.mode);if(this.run==='both'){ig=true;Lg.frameArena();}this.showRunBar();
    };
    Y.panel.querySelector('.auton-foot').append(test);
    const title=Y.panel.querySelector('.auton-title');
    title.innerHTML=`AUTON<em>CODER</em><small>${this.mode==='skills'?'SKILLS':'MATCH'} · ROBOT ${this.active+1}</small>`;
    Y.panel.querySelectorAll('.auton-foot button:not(.lab-run)').forEach(el=>el.addEventListener('click',()=>this.remember()));
  },
  showRunBar() {
    let bar=document.getElementById('lab-runbar');
    if (!bar) {
      bar=tI('div');bar.id='lab-runbar';
      const back=tI('button','auton-btn','← Edit auton');back.onclick=()=>this.returnToEditor();
      const text=tI('span');text.id='lab-run-summary';
      const progress=tI('span');progress.id='lab-run-progress';progress.setAttribute('aria-live','off');
      bar.append(back,text,progress);document.body.append(bar);
    }
    document.getElementById('lab-run-summary').textContent=`${this.mode==='skills'?'Skills · 60 sec':'Match · 15 sec'} · ${this.run==='both'?'2 robots':`Robot ${this.run}`}`;
    bar.hidden=false;
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
const labOriginalOpen=GB.open.bind(GB);
GB.open=function(onClose){
  if(Y.open)return;
  lab.prepare();lab.selectRoutine();
  document.getElementById('lab-runbar')?.setAttribute('hidden','');
  labOriginalOpen(()=>{lab.remember();if(typeof onClose==='function')onClose();});
  lab.mountControls();rC();
};
const labOriginalTT=tt;
tt=function(){lab.testing=false;document.getElementById('lab-runbar')?.setAttribute('hidden','');labOriginalTT();};
window.autonLab=lab;
ox().then(()=>lab.afterBoot()).catch(error=>{
  console.error('Auton Lab failed to start',error);
  const loading=document.getElementById('loadingScreen');
  if(loading){loading.classList.remove('hidden');loading.textContent='Could not load the simulator. Reload the page to retry.';}
});
