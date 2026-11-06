(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('scene');
  const ctx = canvas.getContext('2d');
  const titleScreen = $('titleScreen');
  const garageScreen = $('garageScreen');
  const hud = $('hud');
  const driveControls = $('driveControls');
  const modalBg = $('modalBg');
  const modal = $('modal');
  const tasks = [
    { id: 'battery', name: 'Charge the battery', icon: '⚡', note: 'The terminals are clean and the old battery is holding charge. The starter should turn now.' },
    { id: 'tires', name: 'Check the tires', icon: '◉', note: 'A quick pump-up and a look over the sidewalls. Good enough for the gravel road.' },
    { id: 'oil', name: 'Top up the oil', icon: '⌁', note: 'Fresh oil in the engine. A little kindness goes a long way with an old car.' },
    { id: 'fuel', name: 'Add some fuel', icon: '⛽', note: 'A splash from the red can. There is enough in the tank to make it to town.' }
  ];
  const done = new Set();
  const keys = new Set();
  const controls = { left: false, right: false, gas: false, brake: false };
  let state = 'title';
  let width = innerWidth;
  let height = innerHeight;
  let pixelRatio = 1;
  let lastTime = 0;
  let speed = 0;
  let distance = 0;
  let condition = 100;
  let lane = 0;
  let steering = 0;
  let offRoadTime = 0;
  let toastTimer = 0;
  let shake = 0;
  let lastBump = -1;
  const tripLength = 1.8;

  function resize() {
    width = innerWidth;
    height = innerHeight;
    pixelRatio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function showScreen(next) {
    state = next;
    titleScreen.classList.toggle('hidden', next !== 'title');
    garageScreen.classList.toggle('hidden', next !== 'garage');
    hud.classList.toggle('hidden', next !== 'drive' && next !== 'paused');
    driveControls.style.display = next === 'drive' && width <= 900 ? 'flex' : 'none';
  }

  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = 2.4;
  }

  function buildGarage() {
    $('hotspots').innerHTML = '';
    const positions = [
      { left: '24%', top: '48%' },
      { left: '78%', top: '49%' },
      { left: '38%', top: '34%' },
      { left: '64%', top: '71%' }
    ];
    tasks.forEach((task, index) => {
      const button = document.createElement('button');
      button.className = 'hotspot' + (done.has(task.id) ? ' done' : '');
      button.style.left = positions[index].left;
      button.style.top = positions[index].top;
      button.setAttribute('aria-label', task.name);
      button.title = task.name;
      button.textContent = done.has(task.id) ? '✓' : String(index + 1);
      button.addEventListener('click', () => completeTask(task));
      $('hotspots').append(button);
    });
    $('taskList').innerHTML = tasks.map((task, index) => `<div class="task ${done.has(task.id) ? 'done' : ''}"><span class="task-icon">${done.has(task.id) ? '✓' : task.icon}</span><span>${task.name}</span></div>`).join('');
    $('garageProgress').style.width = `${done.size / tasks.length * 100}%`;
    $('taskTitle').textContent = done.size === tasks.length ? 'Ready for the road' : `${done.size ? `${done.size} of 4` : 'Four'} things to check`;
    $('taskDesc').textContent = done.size === tasks.length
      ? 'She will not win any concours, but the Satsuma is ready to make the village run.'
      : 'Your uncle\'s old Satsuma has been sitting all winter. Fix the marked parts before taking it out.';
    $('toolNote').textContent = done.size === tasks.length ? 'All checked. The village shop is waiting.' : 'Click a glowing spot on the car to work on it.';
    $('driveBtn').classList.toggle('hidden', done.size !== tasks.length);
  }

  function completeTask(task) {
    if (done.has(task.id)) return;
    done.add(task.id);
    buildGarage();
    $('toolNote').textContent = task.note;
    if (done.size === tasks.length) notify('The Satsuma is roadworthy. Time to head for town.');
  }

  function startDrive() {
    $('toast').classList.remove('show');
    toastTimer = 0;
    speed = 0;
    distance = 0;
    condition = 100;
    lane = 0;
    steering = 0;
    offRoadTime = 0;
    lastBump = -1;
    showScreen('drive');
    updateHud();
  }

  function updateHud() {
    $('speed').textContent = Math.round(speed);
    $('distance').textContent = distance.toFixed(2);
    $('conditionText').textContent = Math.max(0, Math.round(condition));
    $('conditionBar').style.width = `${Math.max(0, condition)}%`;
    $('tripBar').style.width = `${Math.min(100, distance / tripLength * 100)}%`;
    $('conditionBar').style.background = condition < 35 ? 'var(--orange)' : 'var(--lime)';
  }

  function showModal(title, text, buttons) {
    modal.innerHTML = `<div class="eyebrow">Summer Wrench</div><h2>${title}</h2><p>${text}</p><div class="modal-actions">${buttons.map((button, index) => `<button class="btn ${index ? 'secondary' : ''}" data-action="${button.action}">${button.label}</button>`).join('')}</div>`;
    modalBg.classList.remove('hidden');
  }

  function pauseGame() {
    if (state !== 'drive') return;
    state = 'paused';
    driveControls.style.display = 'none';
    showModal('Take a breather', 'The road will still be here when you are ready.', [
      { label: 'Back to driving', action: 'resume' },
      { label: 'Call it a day', action: 'quit' }
    ]);
  }

  function endGame(won) {
    state = won ? 'won' : 'wrecked';
    driveControls.style.display = 'none';
    showModal(won ? 'Town at last' : 'A long walk home', won
      ? `You rolled into the village with ${Math.max(0, Math.round(condition))}% car condition. The shop lights are on, and the rally is just getting started.`
      : 'The old Satsuma has had enough for today. At least the lake is not far away.', [
      { label: 'Drive again', action: 'restart' },
      { label: 'Back to the shed', action: 'garage' }
    ]);
  }

  modal.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    modalBg.classList.add('hidden');
    if (action === 'resume') showScreen('drive');
    if (action === 'quit') showScreen('title');
    if (action === 'restart') startDrive();
    if (action === 'garage') {
      done.clear();
      buildGarage();
      showScreen('garage');
    }
  });

  $('startBtn').addEventListener('click', () => {
    buildGarage();
    showScreen('garage');
  });
  $('driveBtn').addEventListener('click', startDrive);
  $('pauseBtn').addEventListener('click', pauseGame);
  modalBg.addEventListener('click', (event) => {
    if (event.target === modalBg && state === 'paused') {
      modalBg.classList.add('hidden');
      showScreen('drive');
    }
  });

  function setControl(name, value) { controls[name] = value; }
  document.querySelectorAll('[data-drive]').forEach((button) => {
    const name = button.dataset.drive;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setControl(name, true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => setControl(name, false));
  });
  const keyNames = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake', ' ': 'brake' };
  addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      if (state === 'drive') pauseGame();
      else if (state === 'paused') { modalBg.classList.add('hidden'); showScreen('drive'); }
    }
    keys.add(event.key);
    if (keyNames[event.key]) setControl(keyNames[event.key], true);
  });
  addEventListener('keyup', (event) => {
    keys.delete(event.key);
    if (keyNames[event.key]) setControl(keyNames[event.key], false);
  });
  addEventListener('blur', () => { keys.clear(); Object.keys(controls).forEach((name) => setControl(name, false)); });

  function update(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $('toast').classList.remove('show');
    }
    if (state !== 'drive') return;
    const gas = controls.gas || keys.has('ArrowUp') || keys.has('w') || keys.has('W');
    const brake = controls.brake || keys.has('ArrowDown') || keys.has('s') || keys.has('S') || keys.has(' ');
    const left = controls.left || keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const right = controls.right || keys.has('ArrowRight') || keys.has('d') || keys.has('D');
    if (gas) speed += 25 * dt;
    else speed -= 3.2 * dt;
    if (brake) speed -= 48 * dt;
    speed = Math.max(0, Math.min(105, speed));
    const steerInput = (right ? 1 : 0) - (left ? 1 : 0);
    steering += (steerInput - steering) * Math.min(1, dt * 5);
    lane += steering * dt * (0.18 + speed / 90);
    lane *= Math.pow(0.992, dt * 60);
    if (Math.abs(lane) > 0.88) {
      offRoadTime += dt;
      speed = Math.max(18, speed - 10 * dt);
      condition -= (4 + speed * 0.075) * dt;
      if (offRoadTime > 0.5 && offRoadTime - dt <= 0.5) notify('Easy there — the gravel shoulder is rough!');
    } else offRoadTime = 0;
    const previousDistance = distance;
    distance += speed / 3600 * dt;
    const bumpIndex = Math.floor(distance * 32);
    if (bumpIndex > lastBump && bumpIndex % 11 === 6 && speed > 30) {
      lastBump = bumpIndex;
      const hazardLane = Math.sin(bumpIndex * 12.9898) * 0.68;
      if (Math.abs(lane - hazardLane) < 0.24) {
        condition -= 8 + speed * 0.08;
        speed *= 0.72;
        shake = 0.35;
        notify('A pothole! Watch the road ahead.');
      }
    }
    shake = Math.max(0, shake - dt);
    condition = Math.max(0, condition);
    updateHud();
    if (condition <= 0) endGame(false);
    else if (distance >= tripLength) { distance = tripLength; updateHud(); endGame(true); }
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawTree(x, y, scale, hue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#604a34';
    ctx.fillRect(-3, -34, 6, 39);
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.moveTo(0, -89); ctx.lineTo(-27, -34); ctx.lineTo(-13, -38); ctx.lineTo(-34, -9);
    ctx.lineTo(0, -19); ctx.lineTo(32, -8); ctx.lineTo(12, -38); ctx.lineTo(28, -34); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawRoadScene(time) {
    const horizon = height * 0.39;
    const center = width * (0.5 - lane * 0.13);
    const farW = Math.max(5, width * 0.014);
    const nearW = width * 0.92;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#98c4bd'); sky.addColorStop(1, '#e8c891');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon + 1);
    ctx.fillStyle = '#e6b866'; ctx.beginPath(); ctx.arc(width * 0.78, height * 0.16, Math.min(width, height) * 0.055, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#728c68'; ctx.fillRect(0, horizon, width, height - horizon);
    ctx.fillStyle = '#82936a';
    for (let i = 0; i < 7; i++) {
      const x = width * i / 6;
      ctx.beginPath(); ctx.moveTo(x - width * .08, horizon); ctx.lineTo(x, horizon - height * (.05 + Math.sin(i * 5) * .025)); ctx.lineTo(x + width * .12, horizon); ctx.fill();
    }
    const period = 180;
    const travel = (distance * 1800 + time * (state === 'drive' ? speed * 0.12 : 0)) % period;
    for (let i = 0; i < 20; i++) {
      const z = ((i * 12 + travel) % period) / period;
      const perspective = z * z;
      const y = horizon + perspective * (height * 0.7);
      const spread = width * (0.055 + perspective * 0.62);
      const offset = Math.sin((distance * 0.7 + z * 2) * 1.2) * width * 0.025 * perspective;
      const side = i % 2 ? -1 : 1;
      drawTree(center + offset + side * spread, y, 0.12 + perspective * 0.9, i % 3 ? '#405d43' : '#526b48');
      drawTree(center + offset - side * spread * 1.45, y + 10, 0.11 + perspective * 0.75, i % 4 ? '#345440' : '#5a6c45');
    }
    polygon([[center - farW, horizon], [center + farW, horizon], [center + nearW / 2, height], [center - nearW / 2, height]], '#77766a');
    polygon([[center - farW, horizon], [center - farW * .65, horizon], [center - nearW / 2 + 20, height], [center - nearW / 2, height]], '#dfd0a6');
    polygon([[center + farW * .65, horizon], [center + farW, horizon], [center + nearW / 2, height], [center + nearW / 2 - 20, height]], '#dfd0a6');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center - farW, horizon); ctx.lineTo(center + farW, horizon); ctx.lineTo(center + nearW / 2, height); ctx.lineTo(center - nearW / 2, height); ctx.closePath(); ctx.clip();
    const stripeOffset = (distance * 150 + (state === 'drive' ? time * speed * 0.15 : 0)) % 1;
    for (let i = 0; i < 12; i++) {
      const z = ((i / 12 + stripeOffset) % 1);
      const y = horizon + z * z * (height - horizon);
      const dash = (4 + z * 45) * (width / 1000);
      ctx.fillStyle = '#eee3c5a6';
      ctx.fillRect(center - dash / 2, y, dash, Math.max(1, z * 10));
    }
    ctx.restore();
    // Gravel flecks and roadside flowers add scale to the moving road.
    for (let i = 0; i < 34; i++) {
      const z = ((i * .127 + distance * 1.9) % 1);
      const y = horizon + z * z * (height - horizon);
      const x = center + Math.sin(i * 78.17) * width * z * .47;
      ctx.fillStyle = i % 3 ? '#d5c7a2' : '#e8d79a';
      ctx.fillRect(x, y, 1 + z * 2, 1 + z * 2);
    }
  }

  function drawCar(time) {
    const carY = height * 0.83;
    const carX = width * (0.5 + lane * .22);
    const carW = Math.min(width * .32, 340);
    const carH = carW * .48;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * 13 * shake, (Math.random() - .5) * 10 * shake);
    ctx.translate(carX, carY);
    ctx.rotate(steering * .035);
    // Dark dashboard and sun-faded hood, viewed from the driver's seat.
    polygon([[-width, height * .21], [-carW * .76, -carH * .1], [-carW * .42, -carH * .82], [carW * .42, -carH * .82], [carW * .76, -carH * .1], [width, height * .21], [width, height], [-width, height]], '#29332b');
    polygon([[-carW * .73, -carH * .1], [-carW * .48, -carH * .67], [carW * .48, -carH * .67], [carW * .73, -carH * .1]], '#b86b3e', '#614331', 4);
    ctx.fillStyle = '#d1b27c';
    ctx.fillRect(-carW * .35, -carH * .21, carW * .7, carH * .055);
    ctx.fillStyle = '#17211c';
    ctx.beginPath(); ctx.arc(0, carH * .22, carW * .16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c9c4aa'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, carH * .22, carW * .16, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#c9c4aa'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, carH * .22); ctx.lineTo(0, carH * .08); ctx.moveTo(-carW * .13, carH * .24); ctx.lineTo(carW * .13, carH * .24); ctx.stroke();
    ctx.fillStyle = '#c2b28b'; ctx.font = `${Math.max(10, carW * .035)}px monospace`; ctx.textAlign = 'center'; ctx.fillText('SATSUMA', 0, height * .19);
    ctx.restore();
  }

  function drawGarageBg() {
    ctx.fillStyle = '#85745b'; ctx.fillRect(0, 0, width, height);
    const floor = ctx.createLinearGradient(0, height * .35, 0, height);
    floor.addColorStop(0, '#81765e'); floor.addColorStop(1, '#463f31');
    ctx.fillStyle = floor; ctx.fillRect(0, height * .35, width, height * .65);
    ctx.fillStyle = '#554a37'; ctx.fillRect(0, 0, width, height * .17);
    ctx.fillStyle = '#d0b782'; ctx.fillRect(width * .1, height * .08, width * .25, height * .025);
    ctx.fillStyle = '#9b8c68';
    for (let i = 0; i < 13; i++) ctx.fillRect(i * width / 12, height * .2, 2, height * .3);
    ctx.strokeStyle = '#ad9d76'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, height * (.48 + i * .08)); ctx.lineTo(width, height * (.48 + i * .08)); ctx.stroke(); }
  }

  function drawTitleBg(time) {
    drawRoadScene(time);
    const vignette = ctx.createLinearGradient(0, 0, width, 0);
    vignette.addColorStop(0, '#17231cf5'); vignette.addColorStop(.47, '#17231c9c'); vignette.addColorStop(.84, '#17231c00');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    drawCar(time);
  }

  function render(time) {
    const seconds = time / 1000;
    ctx.clearRect(0, 0, width, height);
    if (state === 'title') drawTitleBg(seconds);
    else if (state === 'garage') drawGarageBg();
    else { drawRoadScene(seconds); drawCar(seconds); }
  }

  function frame(time) {
    const dt = Math.min(.05, lastTime ? (time - lastTime) / 1000 : 0);
    lastTime = time;
    update(dt);
    render(time);
    requestAnimationFrame(frame);
  }
  buildGarage();
  showScreen('title');
  requestAnimationFrame(frame);
})();
