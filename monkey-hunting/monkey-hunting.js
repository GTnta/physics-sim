(function () {
  'use strict';
  const physics = window.MonkeyPhysics;
  const $ = id => document.getElementById(id);
  const canvas = $('motionCanvas');
  const ctx = canvas.getContext('2d');
  const colors = { ball: '#cf5554', monkey: '#27846e', ink: '#203b42', muted: '#7a9296' };
  const state = {
    params: { ...physics.defaults }, plan: null, time: 0, playing: false,
    rate: .5, activePreset: 'direct', trails: true, ghosts: false, gravity: false, loop: false,
    frame: null, lastTimestamp: null, endTimestamp: null
  };
  let scene = null;
  try { scene = new window.MonkeyScene($('monkeyCanvas'), $('ballCanvas')); }
  catch (error) { $('webglError').hidden = false; console.warn('3D unavailable:', error.message); }
  function icons() { if (window.MonkeyIcons) window.MonkeyIcons(); }
  function fixed(value, digits = 2) { return (Math.abs(value) < 1e-9 ? 0 : value).toFixed(digits); }
  function setPlay(playing) {
    state.playing = playing;
    state.lastTimestamp = null;
    $('playButton').classList.toggle('running', playing);
    $('playButton').setAttribute('aria-pressed', String(playing));
    $('playButton').innerHTML = `<i data-lucide="${playing ? 'pause' : 'play'}" aria-hidden="true"></i><span>${playing ? '一時停止' : '再生'}</span>`;
    icons();
    if (!playing && state.frame !== null) { cancelAnimationFrame(state.frame); state.frame = null; }
    schedule();
  }
  function rebuild() {
    setPlay(false);
    state.plan = physics.createPlan(state.params);
    state.params = { ...state.plan.params };
    state.time = 0;
    state.endTimestamp = null;
    if (scene) scene.configure(state.plan);
    $('timeSlider').max = state.plan.duration;
    for (const input of document.querySelectorAll('[data-param]')) {
      const key = input.dataset.param;
      input.value = state.params[key];
      const digits = key === 'delay' ? 2 : key === 'gravity' || key === 'speed' || key === 'offset' ? 1 : 0;
      $(key + 'Value').value = fixed(state.params[key], digits);
    }
    $('dropsToggle').checked = state.params.drops;
    $('delaySlider').disabled = !state.params.drops;
    document.querySelectorAll('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === state.activePreset)));
    draw();
  }
  function resize2D() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }
  function metrics(width, height) {
    const p = state.params, plan = state.plan;
    const end = physics.sample(plan, plan.duration);
    const topTime = Math.min(Math.max(plan.vy / (p.gravity || .00001), 0), plan.duration);
    const top = physics.sample(plan, topTime).ball.y;
    const xmax = Math.max(p.distance + 3, end.ball.x + 2);
    const ghostTop = state.ghosts ? p.launchHeight + Math.max(0, plan.vy * plan.duration) : 0;
    const ymax = Math.max(p.height + 3.3, top + 1.7, ghostTop + 1.7);
    const scale = Math.min((width - 54) / (xmax + 1.5), (height - 52) / ymax);
    const originX = 32 + Math.max(0, (width - 54 - xmax * scale) / 2);
    const originY = height - 30;
    return { scale, originX, originY, xmax, ymax, width, height,
      point: (x, y) => ({ x: originX + x * scale, y: originY - y * scale }) };
  }
  function line(a, b, color, width = 1, dash = []) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
  }
  function arrow(a, b, color, width = 2) {
    line(a, b, color, width);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath(); ctx.fillStyle = color; ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - 6 * Math.cos(angle - .5), b.y - 6 * Math.sin(angle - .5));
    ctx.lineTo(b.x - 6 * Math.cos(angle + .5), b.y - 6 * Math.sin(angle + .5)); ctx.closePath(); ctx.fill();
  }
  function ellipse(x, y, rx, ry, fill, stroke = null) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.3; ctx.stroke(); }
  }
  function drawMonkey(point, size, released, ghost = false) {
    ctx.save(); ctx.translate(point.x, point.y); ctx.scale(size, size);
    if (ghost) ctx.globalAlpha = .22;
    ctx.strokeStyle = '#997b69'; ctx.lineWidth = .22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(.2,.3); ctx.bezierCurveTo(.85,.6,.95,-.3,.52,-.2); ctx.stroke();
    for (const side of [-1,1]) {
      line({x:side*.25,y:.2},{x:side*.23,y:.68},'#997b69',.22);
      line({x:side*.3,y:-.15},{x:side*.52,y:released?.23:-.84},'#997b69',.2);
      ellipse(side*.23,.7,.14,.09,'#e9ceb0');
    }
    ellipse(0,.04,.38,.43,'#947363'); ellipse(0,.06,.3,.29,'#27846e');
    ellipse(-.38,-.46,.15,.16,'#947363'); ellipse(.38,-.46,.15,.16,'#947363');
    ellipse(-.38,-.46,.085,.10,'#e9ceb0'); ellipse(.38,-.46,.085,.10,'#e9ceb0');
    ellipse(0,-.48,.37,.33,'#947363'); ellipse(0,-.43,.28,.23,'#eed5b4');
    ellipse(-.105,-.5,.034,.044,'#263b3c'); ellipse(.105,-.5,.034,.044,'#263b3c');
    ellipse(0,-.37,.045,.026,'#263b3c');
    ctx.beginPath(); ctx.strokeStyle = '#715645'; ctx.lineWidth = .025; ctx.arc(0,-.35,.12,.2,Math.PI-.2); ctx.stroke();
    ctx.restore();
  }
  function drawBall(point, radius, ghost = false) {
    ctx.save(); if (ghost) ctx.globalAlpha = .22;
    ellipse(point.x, point.y, radius, radius, '#dc6662', '#b34446');
    ctx.beginPath(); ctx.strokeStyle = '#fff7e9'; ctx.lineWidth = 1.3;
    ctx.ellipse(point.x,point.y,radius*.42,radius*.9,-.4,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
  function drawOverview(sample) {
    const { width, height } = resize2D();
    const m = metrics(width, height), p = state.params, plan = state.plan;
    ctx.clearRect(0,0,width,height); ctx.fillStyle = '#f5f9f7'; ctx.fillRect(0,0,width,height);
    const ground = m.point(0,0);
    ctx.fillStyle = '#e0ebe1'; ctx.fillRect(0,ground.y,width,height-ground.y);
    const gridStep = m.ymax > 20 || m.xmax > 35 ? 5 : 2;
    ctx.font = '10px "Yu Gothic UI",sans-serif'; ctx.fillStyle = '#6c8588'; ctx.textAlign = 'right';
    for (let y = gridStep; y < m.ymax; y += gridStep) {
      const a = m.point(0,y), b = m.point(m.xmax,y);
      line(a,b,'#dfe8e4'); ctx.fillText(String(y),a.x-6,a.y+3);
    }
    ctx.textAlign = 'center';
    for (let x = 0; x <= m.xmax; x += gridStep) {
      const a = m.point(x,0), b = m.point(x,m.ymax);
      line(a,b,'#e2ebe6'); ctx.fillText(String(x),a.x,ground.y+15);
    }
    line(m.point(0,0),m.point(m.xmax,0),'#9fb5aa',1.2);
    line(m.point(0,0),m.point(0,m.ymax),'#9fb5aa',1.2);
    ctx.fillStyle = '#6c8588'; ctx.textAlign='left'; ctx.fillText('y [m]',9,14); ctx.textAlign='right'; ctx.fillText('x [m]',width-7,height-4);
    const trunk = m.point(p.distance+1.1,0);
    line(trunk,m.point(p.distance+1.1,p.height+2.4),'#a89982',Math.max(5,m.scale*.23));
    line(m.point(p.distance-.8,p.height+1),m.point(p.distance+2.2,p.height+1),'#a89982',4);
    const leaves = m.point(p.distance+1.0,p.height+2.3);
    ellipse(leaves.x,leaves.y,Math.max(15,m.scale*1.4),Math.max(8,m.scale*.65),'#a8c6ac');
    const launcher = m.point(0,p.launchHeight);
    line(m.point(0,0),m.point(0,p.launchHeight-.3),'#8dacad',7);
    line(launcher,m.point(p.distance,p.height),'#92a4a6',1.1,[5,6]);
    if (Math.abs(p.offset)>.01) {
      const length = Math.hypot(p.distance,p.height-p.launchHeight);
      line(launcher,m.point(length*Math.cos(plan.launchAngle),p.launchHeight+length*Math.sin(plan.launchAngle)),'#d89995',1,[4,5]);
    }
    if (state.trails && sample.time>0) {
      for (const key of ['ball','monkey']) {
        ctx.beginPath(); ctx.strokeStyle=colors[key]; ctx.lineWidth=1.8; ctx.globalAlpha=.65;
        for (let i=0;i<=100;i+=1) {
          const v=physics.sample(plan,sample.time*i/100)[key], pt=m.point(v.x,v.y);
          if (!i) ctx.moveTo(pt.x,pt.y); else ctx.lineTo(pt.x,pt.y);
        }
        ctx.stroke(); ctx.globalAlpha=1;
      }
    }
    const ball=m.point(sample.ball.x,sample.ball.y), monkey=m.point(sample.monkey.x,sample.monkey.y);
    if (state.ghosts) {
      const ghostBall=m.point(plan.vx*sample.time,p.launchHeight+plan.vy*sample.time);
      const ghostMonkey=m.point(p.distance,p.height);
      line(ghostBall,ball,'#dba5a2',1,[3,4]); line(ghostMonkey,monkey,'#8bb8a9',1,[3,4]);
      drawBall(ghostBall,Math.max(5,m.scale*.26),true);
      drawMonkey(ghostMonkey,Math.max(11,m.scale*.64),true,true);
    }
    drawMonkey(monkey,Math.max(11,m.scale*.64),sample.released);
    drawBall(ball,Math.max(5,m.scale*.26));
    if (state.gravity && p.gravity>0) {
      const len=p.gravity*m.scale*.16;
      arrow({x:ball.x+10,y:ball.y},{x:ball.x+10,y:ball.y+len},'#d8423a');
      if (sample.released) arrow({x:monkey.x+13,y:monkey.y},{x:monkey.x+13,y:monkey.y+len},'#d8423a');
    }
    if (plan.meets && sample.finished) {
      ctx.beginPath();ctx.strokeStyle='#27846e';ctx.lineWidth=2;ctx.arc(ball.x,ball.y,Math.max(15,m.scale*.7),0,Math.PI*2);ctx.stroke();
    }
  }
  function updateReadouts(s) {
    const plan=state.plan,p=state.params;
    $('timeSlider').value=state.time; $('timeValue').value=fixed(state.time)+' s';
    $('separationValue').value=fixed(s.separation)+' m';
    $('ballDropValue').value=fixed(s.ballDrop)+' m'; $('monkeyDropValue').value=fixed(s.monkeyDrop)+' m';
    $('angleValue').value=fixed(plan.launchAngle*180/Math.PI,1)+'° / '+fixed(plan.sightAngle*180/Math.PI,1)+'°';
    const bearing=s.separation<1e-7?0:Math.abs(Math.atan2(Math.sin(s.bearing),Math.cos(s.bearing))*180/Math.PI);
    $('monkeyBearing').value=fixed(bearing,1)+'°'; $('ballBearing').value=fixed(bearing,1)+'°';
    let text='発射前：ボールを発射すると、サルも同じ時刻から動きます。';
    let outcome='ready';
    if (state.time>0 && !s.finished) {
      text=p.gravity===0?'重力なし。ボールは等速直線運動、サルは静止しています。':!p.drops?'ボールは放物運動。サルは枝につかまっています。':!s.released?'ボールを発射。サルはまだ枝につかまっています。':p.delay>0?'サルも落下中。落下している時間が異なります。':'ボールとサルが、同じ重力加速度で落下中。';
    } else if (s.finished) {
      outcome=plan.meets?'meet':'miss';
      text=plan.outcome==='meet'?`地面に着く前に出会いました（${fixed(plan.duration)} s）。`
        :plan.outcome==='ground-meet'?'地面の高さで出会います。空中で出会う条件の境目です。'
        :plan.outcome==='ball-ground'?'ボールが先に地面に着きました。ここで運動を止めます。'
        :plan.outcome==='monkey-ground'?'サルが先に地面に着きました。ここで運動を止めます。'
        :plan.outcome==='no-crossing'?'この向きでは出会いません。観察区間を終了します。'
        :'サルの位置を通過しましたが、出会いませんでした。';
    } else if (!p.drops) text='発射前：サルは枝につかまったままです。';
    else if (p.delay>0) text=`発射前：サルは発射から ${fixed(p.delay)} s 後に手を離します。`;
    if ($('statusText').textContent!==text) $('statusText').textContent=text;
    $('statusLine').dataset.outcome=outcome;
    const shared=p.gravity===0||(s.released&&p.delay===0);
    $('relativeText').textContent=shared?'相対加速度 = 0':s.released?'相対加速度 = 0':'相対加速度 ≠ 0';
    $('relativeDetail').textContent=p.gravity===0?'どちらにも加速度がない':shared?'2つの重力の項が差し引かれる':s.released?'ただし落下開始時の相対速度が異なる':'ボールは自由落下、サルは枝に支えられている';
    for (const terminal of document.querySelectorAll('.terminal')) terminal.hidden=!(plan.meets&&s.finished);
    $('stepBack').disabled=state.time<=0; $('stepForward').disabled=s.finished;
  }
  function draw() {
    if (!state.plan) return;
    const s=physics.sample(state.plan,state.time);
    drawOverview(s); if (scene) scene.render(s); updateReadouts(s);
  }
  function schedule() { if(state.playing&&state.frame===null) state.frame=requestAnimationFrame(tick); }
  function tick(timestamp) {
    state.frame=null;
    if (!state.playing) return;
    if(state.lastTimestamp===null) state.lastTimestamp=timestamp;
    const dt=Math.min(.08,(timestamp-state.lastTimestamp)/1000); state.lastTimestamp=timestamp;
    if(state.time>=state.plan.duration) {
      if(!state.loop) {setPlay(false);return;}
      if(state.endTimestamp===null) state.endTimestamp=timestamp;
      if(timestamp-state.endTimestamp>=1800) { state.time=0;state.endTimestamp=null; }
    } else state.time=Math.min(state.plan.duration,state.time+dt*state.rate);
    draw(); schedule();
  }
  document.querySelectorAll('[data-param]').forEach(input=>input.addEventListener('input',()=>{
    state.params[input.dataset.param]=Number(input.value);state.activePreset='';rebuild();
  }));
  document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
    state.params={...physics.presets[button.dataset.preset]};state.activePreset=button.dataset.preset;rebuild();
  }));
  $('dropsToggle').addEventListener('change',()=>{state.params.drops=$('dropsToggle').checked;state.activePreset='';rebuild();});
  $('aimButton').addEventListener('click',()=>{state.params.offset=0;state.activePreset='';rebuild();});
  $('playButton').addEventListener('click',()=>{if(!state.playing&&state.time>=state.plan.duration){state.time=0;state.endTimestamp=null;draw();}setPlay(!state.playing);});
  $('resetButton').addEventListener('click',()=>{
    state.params={...physics.defaults};state.activePreset='direct';state.rate=.5;
    $('rateSlider').value=.5;$('rateValue').value='0.5×';
    for(const [id,key,value] of [['trailsToggle','trails',true],['ghostsToggle','ghosts',false],['gravityToggle','gravity',false],['loopToggle','loop',false]]) {state[key]=value;$(id).checked=value;}
    rebuild();
  });
  $('timeSlider').addEventListener('input',()=>{setPlay(false);state.time=Number($('timeSlider').value);state.endTimestamp=null;draw();});
  for(const [id,delta] of [['stepBack',-.05],['stepForward',.05]]) $(id).addEventListener('click',()=>{setPlay(false);state.time=Math.max(0,Math.min(state.plan.duration,state.time+delta));state.endTimestamp=null;draw();});
  $('rateSlider').addEventListener('input',()=>{state.rate=Number($('rateSlider').value);$('rateValue').value=fixed(state.rate,1)+'×';});
  for(const [id,key] of [['trailsToggle','trails'],['ghostsToggle','ghosts'],['gravityToggle','gravity'],['loopToggle','loop']]) $(id).addEventListener('change',()=>{state[key]=$(id).checked;draw();});
  window.addEventListener('resize',draw);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlay(false);});
  icons();rebuild();
})();
