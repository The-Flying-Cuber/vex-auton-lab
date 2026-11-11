const labCurves={
  drawMode:false,
  expanded:new Set(),
  start(index) { return labCurveStart(Y.steps,index,lab.editorPose()); },
  newStep(end,index=Y.steps.length) {
    const start=this.start(index);
    if(!end) {
      let yaw=lab.editorPose().yaw;
      for(let i=index-1;i>=0;i--) {
        const previous=Y.steps[i];
        if(previous.t==='curveTo'){yaw=Math.atan2(previous.x-previous.c2x,previous.z-previous.c2z);break;}
        if(previous.t==='driveTo') {
          const from=this.start(i);yaw=Math.atan2(previous.x-from.x,previous.z-from.z);break;
        }
      }
      const limit=Hn();
      end={x:us(start.x+Math.sin(yaw)*.75,-limit,limit),z:us(start.z+Math.cos(yaw)*.75,-limit,limit)};
      if(Math.hypot(end.x-start.x,end.z-start.z)<.2) {
        const length=Math.hypot(start.x,start.z)||1;
        end={x:start.x-start.x/length*.75,z:start.z-start.z/length*.75};
      }
    }
    return labMakeCurve(start,end,{rev:Y.rev,limit:CC});
  },
  waypoint(x,z) { return this.drawMode?this.newStep({x,z}):{t:'driveTo',x,z,...Y.rev?{rev:true}:{}}; },
  trace(context,toX,toZ,step) {
    if(step.t==='curveTo')context.bezierCurveTo(toX(step.c1x),toZ(step.c1z),toX(step.c2x),toZ(step.c2z),toX(step.x),toZ(step.z));
    else context.lineTo(toX(step.x),toZ(step.z));
  },
  convert(index,curved) {
    const step=Y.steps[index];vi();
    Y.steps[index]=curved?labMakeCurve(this.start(index),step,{rev:step.rev,limit:CC}):{t:'driveTo',x:step.x,z:step.z,...step.rev?{rev:true}:{}};
    Y.selected=index;rC();
  },
  moveEnd(index,x,z) {
    const step=Y.steps[index],dx=x-step.x,dz=z-step.z;
    step.x=x;step.z=z;step.c2x=us(step.c2x+dx,-CC,CC);step.c2z=us(step.c2z+dz,-CC,CC);
    // The next curve shares this endpoint. Carry its outgoing handle with it.
    for(let i=index+1;i<Y.steps.length;i++) {
      const next=Y.steps[i];
      if(next.t==='curveTo'){next.c1x=us(next.c1x+dx,-CC,CC);next.c1z=us(next.c1z+dz,-CC,CC);break;}
      if(next.t==='driveTo'||(next.t==='score'&&next.gx!=null))break;
    }
  },
  numeric(step,index,key,label,{min=-CC,max=CC,scale=1,stepSize=.05}={}) {
    const set=value=>{
      const bounded=us(value/scale,min,max);
      if(key==='x'||key==='z')this.moveEnd(index,key==='x'?bounded:step.x,key==='z'?bounded:step.z);
      else step[key]=bounded;
    };
    const input=jt(()=>VC(step[key]*scale),set,set,{min:min*scale,max:max*scale,step:stepSize});
    input.setAttribute('aria-label',`Curve ${index+1} ${label}`);
    input.dataset.curveIndex=String(index);input.dataset.curveField=key;input.dataset.curveScale=String(scale);
    return zt(label,input);
  },
  fields(step,index) {
    const fields=tI('div','auton-fields lab-curve-fields');
    const end=tI('div','lab-curve-row');
    end.append(this.numeric(step,index,'x','End X'),this.numeric(step,index,'z','End Z'));
    const reverse=tI('button','auton-revmini'+(step.rev?' rev':''),step.rev?'REV':'FWD');
    reverse.title=`REV uses ${LAB_AUTON_REVERSE_SCALE * 100}% of FWD speed at the same setting.`;
    reverse.onclick=()=>{vi();step.rev=!step.rev;rC();};
    const line=tI('button','auton-revmini','LINE');line.title='Convert this curve to a straight DRIVE block';line.onclick=()=>this.convert(index,false);
    end.append(reverse,line);fields.append(end);
    const tuning=tI('div','lab-curve-row');
    tuning.append(this.numeric(step,index,'lookahead','Lookahead (m)',{min:.1,max:1}),this.numeric(step,index,'speed','Speed (%)',{min:.1,max:1,scale:100,stepSize:5}));
    tuning.title='Smaller lookahead follows bends tighter. Larger lookahead turns more gently.';
    const adaptive=tI('button','auton-revmini'+(step.adaptive?' rev':''),step.adaptive?'ADAPTIVE SPEED':'FIXED SPEED');
    adaptive.setAttribute('aria-pressed',String(!!step.adaptive));
    adaptive.title='Fixed: use the requested speed throughout, like DRIVE. Adaptive: slow for tight bends and the endpoint.';
    adaptive.onclick=()=>{vi();step.adaptive=!step.adaptive;rC();};tuning.append(adaptive);
    fields.append(tuning);
    const handles=tI('details','lab-curve-coordinates'),summary=tI('summary','','Control points');handles.append(summary);
    const disclosureKey=Y.editingId+':'+index;handles.open=this.expanded.has(disclosureKey);
    handles.addEventListener('toggle',()=>{
      if(handles.isConnected){if(handles.open)this.expanded.add(disclosureKey);else this.expanded.delete(disclosureKey);}
    });
    const points=tI('div','lab-curve-row');
    for(const [key,label] of [['c1x','C1 X'],['c1z','C1 Z'],['c2x','C2 X'],['c2z','C2 Z']])points.append(this.numeric(step,index,key,label));
    const reset=tI('button','auton-revmini','STRAIGHTEN');
    reset.title='Put both curve handles on a straight line';reset.onclick=()=>{
      vi();Object.assign(step,labMakeCurve(this.start(index),step,{bend:0,rev:step.rev,...labCurveOptions(step),limit:CC}));rC();
    };
    points.append(reset);handles.append(points);fields.append(handles);
    fields.append(tI('div','lab-curve-note','Drag C1 and C2 on the field to shape the bend.'));
    return fields;
  },
  syncFields() {
    for(const input of document.querySelectorAll('[data-curve-field]')) {
      if(input===document.activeElement)continue;
      const step=Y.steps[Number(input.dataset.curveIndex)];
      if(step?.t==='curveTo')input.value=String(VC(step[input.dataset.curveField]*Number(input.dataset.curveScale)));
    }
  },
  hint() {
    if(Y.pickGoalFor>=0)return;
    const hint=document.getElementById('auton-hint');
    if(hint&&(this.drawMode||Y.steps[Y.selected]?.t==='curveTo'))hint.textContent='Click to add '+(this.drawMode?'a curve':'a waypoint')+' · drag endpoints or C1/C2 to shape curves · undo works for handles too';
  },
  mount() {
    const bar=Y.panel?.querySelector('.auton-bar');if(!bar)return;
    let toggle=document.getElementById('lab-curve-tool');
    if(!toggle) {
      toggle=tI('button','auton-revbtn');toggle.id='lab-curve-tool';
      toggle.title='Choose straight waypoints or Bézier curves for field clicks';
      toggle.onclick=()=>{this.drawMode=!this.drawMode;ep();};bar.append(toggle);
    }
    toggle.textContent=this.drawMode?'DRAW: CURVE':'DRAW: LINE';
    toggle.classList.toggle('on',this.drawMode);toggle.setAttribute('aria-pressed',String(this.drawMode));
    this.bindCanvas();this.syncFields();this.hint();
  },
  drawControls(context,dpr,size,toX,toZ) {
    const index=Y.selected,step=Y.steps[index];if(step?.t!=='curveTo'||Y.pickGoalFor>=0)return;
    const start=this.start(index),scale=size/(2*Pg),lookahead=labCurveOptions(step).lookahead;
    context.save();
    context.strokeStyle='rgba(183,154,255,.28)';context.lineWidth=dpr;context.setLineDash([3*dpr,4*dpr]);
    context.beginPath();context.arc(toX(start.x),toZ(start.z),lookahead*scale,0,Math.PI*2);context.stroke();
    for(const handle of [
      {key:'c1',label:'C1',anchor:start,color:'#d5adff'},
      {key:'c2',label:'C2',anchor:step,color:'#83f0bf'}
    ]) {
      const x=toX(step[handle.key+'x']),y=toZ(step[handle.key+'z']);
      context.strokeStyle=handle.color;context.lineWidth=1.5*dpr;context.setLineDash([4*dpr,3*dpr]);
      context.beginPath();context.moveTo(toX(handle.anchor.x),toZ(handle.anchor.z));context.lineTo(x,y);context.stroke();context.setLineDash([]);
      context.fillStyle=handle.color;context.beginPath();context.arc(x,y,6*dpr,0,Math.PI*2);context.fill();
      context.strokeStyle='#091320';context.lineWidth=1.5*dpr;context.stroke();
      context.font=`800 ${10*dpr}px sans-serif`;context.textAlign='center';context.textBaseline='bottom';
      context.lineWidth=3*dpr;context.strokeText(handle.label,x,y-9*dpr);context.fillText(handle.label,x,y-9*dpr);
    }
    // A small arrow makes the path's order clear, even on a loop.
    const a=labBezierPoint(start,step,.49),b=labBezierPoint(start,step,.51);
    const angle=Math.atan2(toZ(b.z)-toZ(a.z),toX(b.x)-toX(a.x));
    context.translate(toX(b.x),toZ(b.z));context.rotate(angle);
    context.fillStyle=step.rev?'#ffb068':'#7fdcff';context.beginPath();context.moveTo(5*dpr,0);context.lineTo(-4*dpr,-4*dpr);context.lineTo(-4*dpr,4*dpr);context.closePath();context.fill();
    context.restore();
  },
  hit(event) {
    const rect=Y.canvas.getBoundingClientRect(),screen=point=>({x:rect.left+(Pg-point.x)/(2*Pg)*rect.width,y:rect.top+(Pg-point.z)/(2*Pg)*rect.height});
    const distance=point=>{const p=screen(point);return Math.hypot(event.clientX-p.x,event.clientY-p.y);};
    const start=lab.editorPose(),center=screen(start),handleLength=26*rect.width/ja;
    if(distance(start)<13||Math.hypot(event.clientX-(center.x-Math.sin(start.yaw)*handleLength),event.clientY-(center.y-Math.cos(start.yaw)*handleLength))<10)return null;
    const selected=Y.steps[Y.selected];
    if(selected?.t==='curveTo')for(const key of ['c1','c2'])if(distance({x:selected[key+'x'],z:selected[key+'z']})<12)return {index:Y.selected,kind:key};
    for(let index=Y.steps.length-1;index>=0;index--) {
      const step=Y.steps[index];
      if(step.t==='curveTo'&&distance(step)<12)return {index,kind:'end'};
    }
    const point=Wy(event.clientX,event.clientY);
    for(let index=Y.steps.length-1;index>=0;index--) {
      const step=Y.steps[index];if(step.t!=='curveTo')continue;
      const path=labSampleBezier(this.start(index),step);
      if(labCurveProject(path,point).distance*rect.width/(2*Pg)<6)return {index,kind:'select'};
    }
    return null;
  },
  bindCanvas() {
    const canvas=Y.canvas;if(!canvas)return;
    canvas.setAttribute('aria-label','Auton field. Drag numbered start nodes, waypoint endpoints, or the selected curve’s C1 and C2 handles.');
    if(canvas.dataset.labCurveDrag)return;canvas.dataset.labCurveDrag='1';
    let drag=null;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||Y.pickGoalFor>=0)return;
      const target=this.hit(event);if(!target)return;
      event.preventDefault();event.stopImmediatePropagation();const changed=Y.selected!==target.index;Y.selected=target.index;
      if(target.kind!=='select') {
        drag={...target,id:event.pointerId,x:event.clientX,y:event.clientY,pushed:false,original:JSON.stringify(Y.steps),redo:Y.redo.slice()};
        canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';
      }
      if(changed)Xe();oE();
    },true);
    canvas.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!drag.pushed&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<2)return;
      if(!drag.pushed){vi();drag.pushed=true;}
      const point=Wy(event.clientX,event.clientY),step=Y.steps[drag.index];
      if(drag.kind==='end')this.moveEnd(drag.index,VC(point.x),VC(point.z));
      else{step[drag.kind+'x']=VC(point.x);step[drag.kind+'z']=VC(point.z);}
      this.syncFields();oE();
    },true);
    const finish=(event,cancel=false)=>{
      if(!drag||event.pointerId!==drag.id)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(cancel&&drag.pushed){Y.steps=JSON.parse(drag.original);Y.undo.pop();Y.redo=drag.redo;}
      drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor='crosshair';rC();
    };
    canvas.addEventListener('pointerup',event=>finish(event),true);
    canvas.addEventListener('pointercancel',event=>finish(event,true),true);
    canvas.addEventListener('pointermove',event=>{if(!drag&&Y.dragWaypoint<0&&Y.pickGoalFor<0&&this.hit(event))canvas.style.cursor='grab';});
  }
};

Ip.curveTo='CURVE';WL.curveTo=()=>labCurves.newStep();
const labCurveOriginalFields=gm;
gm=function(step,index) {
  if(step.t==='curveTo')return labCurves.fields(step,index);
  const fields=labCurveOriginalFields(step,index);
  if(step.t==='driveTo') {
    const direction=fields.querySelector('button.auton-revmini');
    if(direction) direction.title=`REV uses ${LAB_AUTON_REVERSE_SCALE * 100}% of FWD speed.`;
    const curve=tI('button','auton-revmini','CURVE');curve.title='Convert this DRIVE block to an editable Bézier curve';curve.onclick=()=>labCurves.convert(index,true);fields.append(curve);
  }
  return fields;
};
const labCurveOriginalEp=ep;
ep=function(){labCurveOriginalEp();labCurves.mount();};
const labCurveOriginalXe=Xe;
Xe=function(){
  labCurveOriginalXe();
  document.querySelectorAll('#auton-list .auton-card').forEach((card,index)=>{
    if(Y.steps[index]?.t==='curveTo'){
      card.classList.add('lab-curve-card');card.dataset.curveIndex=String(index);
      card.querySelector('.auton-stype').style.color='#d5adff';
    }
  });labCurves.hint();
};

const LAB_CURVE_CSS=`
 .auton-head{flex-shrink:0}
 .auton-bar{flex-wrap:wrap;gap:8px!important}.auton-hint{flex-basis:180px}
 #lab-curve-tool.on{background:#d5adff;border-color:#d5adff}
 .lab-curve-card{display:grid!important;grid-template-columns:13px 22px minmax(0,1fr) repeat(3,24px);align-items:center!important;gap:8px!important}
 .lab-curve-card>.auton-cbtn{grid-row:1}
 .lab-curve-card>.auton-cbtn:nth-last-child(3){grid-column:4}
 .lab-curve-card>.auton-cbtn:nth-last-child(2){grid-column:5}
 .lab-curve-card>.auton-cbtn:last-child{grid-column:6}
 .lab-curve-fields{grid-row:2;grid-column:1/-1;display:flex!important;flex-direction:column;align-items:stretch!important;gap:8px!important;min-width:0}
 .lab-curve-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px 9px}
 .lab-curve-row .auton-in{width:78px;min-width:78px;padding:5px 6px;letter-spacing:0;font-size:12px}
 .lab-curve-note,.lab-curve-coordinates summary{font-size:10px;color:#aebede;line-height:1.4}
 .lab-curve-coordinates summary{cursor:pointer;color:#d5adff;margin-bottom:4px}
 .lab-curve-coordinates .lab-curve-row{padding:5px 0}
 @media(min-width:881px) and (max-height:780px){.auton-left{align-items:center}.auton-left .auton-canvas{width:calc(100vh - 400px)!important;height:auto!important;max-width:100%}}
`;
