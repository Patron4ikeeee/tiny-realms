/* Paste your Render URL into this line after deploying the server. */
const SERVER_URL = 'https://YOUR-SERVICE.onrender.com';
const TILE = 32;
const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 10 });
const state = { self: null, players: [], mobs: [], npcs: [], map: { width: 36, height: 24 }, items: {}, quests: {}, homes: [], currentNpc: null, selectedBuild: 'floor', keys: {}, noticeTimer: null, cameraX: 0, cameraY: 0 };
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const dialog = document.getElementById('npc-dialog');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

socket.on('connect', () => setStatus('Сервер доступен. Можно входить.', true));
socket.on('disconnect', () => setStatus('Связь потеряна. Переподключаемся…', false));
socket.on('connect_error', () => setStatus('Не удалось подключиться. Проверь URL Render.', false));
socket.on('login:error', message => setStatus(message, false));
socket.on('login:ok', data => {
  state.self = data.self;
  state.homes = data.homes || [];
  applySnapshot(data.state);
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.getElementById('player-name').textContent = state.self.name;
  renderPanels();
  requestAnimationFrame(draw);
});
socket.on('world:state', applySnapshot);
socket.on('home:update', home => {
  state.homes = state.homes.filter(entry => entry.owner.toLowerCase() !== home.owner.toLowerCase());
  state.homes.push(home);
  const ownHome = home.owner.toLowerCase() === state.self?.name.toLowerCase();
  if (ownHome) state.self.plot = home.slot;
  renderPanels();
});
socket.on('notice', value => showNotice(typeof value === 'string' ? value : value.text));
socket.on('loot', value => showNotice(`Добыча: ${value.name}`));
socket.on('chat:message', message => addChat(message));
socket.on('combat:hit', hit => {
  state.floaters ||= [];
  state.floaters.push({ x: hit.x, y: hit.y, text: `-${hit.damage}`, until: Date.now() + 600 });
});
socket.on('npc:dialog', showNpcDialog);

function setStatus(message, good) {
  const el = document.getElementById('connection-status');
  el.textContent = message;
  el.style.color = good ? '#78c690' : '#db776d';
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  state.players = snapshot.players || [];
  state.mobs = snapshot.mobs || [];
  state.npcs = snapshot.npcs || [];
  state.map = snapshot.map || state.map;
  state.items = snapshot.items || state.items;
  state.quests = snapshot.quests || state.quests;
  if (state.self) {
    const fresh = state.players.find(player => player.name.toLowerCase() === state.self.name.toLowerCase());
    if (fresh) state.self = fresh;
    updateHud();
    renderPanels();
  }
  document.getElementById('online-count').textContent = state.players.length;
}

function updateHud() {
  const p = state.self;
  if (!p) return;
  document.getElementById('level').textContent = `Ур. ${p.level}`;
  document.getElementById('hp-text').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  document.getElementById('hp-bar').style.width = `${Math.max(0, p.hp / p.maxHp * 100)}%`;
  document.getElementById('gold').textContent = p.gold;
  document.getElementById('attack').textContent = p.attack;
  document.getElementById('defense').textContent = p.defense;
  document.getElementById('xp-text').textContent = `${p.xp} / ${p.nextXp}`;
  document.getElementById('xp-bar').style.width = `${Math.min(100, p.xp / p.nextXp * 100)}%`;
}

document.getElementById('login-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!socket.connected) return setStatus('Сервер недоступен — дождись подключения.', false);
  socket.emit('login', { name: document.getElementById('nickname').value });
});
document.getElementById('logout').addEventListener('click', () => location.reload());

function inventoryHtml() {
  const p = state.self;
  if (!p) return '';
  const equipped = p.equipment || {};
  const rows = p.inventory.map(entry => {
    const item = state.items[entry.id];
    if (!item) return '';
    const isEquipped = equipped[item.type] === entry.id && ['weapon', 'armor'].includes(item.type);
    const action = item.type === 'consumable' ? 'Использовать' : ['weapon', 'armor'].includes(item.type) ? (isEquipped ? 'Надето' : 'Надеть') : '—';
    const button = action === '—' || isEquipped ? '' : `<button data-action="use" data-id="${entry.id}">${action}</button>`;
    return `<div class="item-row"><span class="item-name rarity-${item.rarity}">${escapeHtml(item.name)} <span class="item-meta">×${entry.qty}</span></span>${button}<span class="item-meta">${escapeHtml(item.type)} · ${escapeHtml(item.rarity)}${item.attack ? ` · ⚔ +${item.attack}` : ''}${item.defense ? ` · 🛡 +${item.defense}` : ''}${item.heal ? ` · +${item.heal} HP` : ''}</span></div>`;
  }).join('');
  return `<h2>Рюкзак</h2><p class="subheading">Оружие: ${escapeHtml(state.items[equipped.weapon]?.name || '—')} · Броня: ${escapeHtml(state.items[equipped.armor]?.name || '—')}</p><div class="item-list">${rows || '<p class="subheading">Пока пусто. Побеждай монстров и собирай добычу!</p>'}</div>`;
}

function questsHtml() {
  const p = state.self;
  if (!p) return '';
  const quests = Object.entries(state.quests).map(([id, def]) => {
    const progress = p.quests?.[id];
    const status = progress?.status === 'done' ? 'Выполнено' : progress?.status === 'active' ? `${progress.progress}/${def.amount}` : 'Не начато';
    return `<article class="quest-card"><strong>${escapeHtml(def.name)}</strong><p>${escapeHtml(def.text)} · Награда: ${def.gold} 🪙, ${def.xp} опыта</p><span class="item-meta">${status}</span></article>`;
  }).join('');
  return `<h2>Задания</h2><p class="subheading">Поговори с NPC в деревне, чтобы взять или сдать задание.</p><div class="quest-list">${quests}</div>`;
}

function homeHtml() {
  const home = state.homes.find(entry => entry.owner.toLowerCase() === state.self?.name.toLowerCase());
  if (!home) return `<h2>Свой дом</h2><p class="subheading">Купи участок за 50 золота. Строить можно на своём участке у южной дороги.</p><button class="primary" data-action="buy-home">Купить участок · 50 🪙</button>`;
  const builds = ['floor', 'wall', 'door', 'bed', 'table', 'lamp'];
  return `<h2>Мой участок</h2><p class="subheading">Выбери постройку, затем щёлкни по клетке своего участка.</p><div class="build-options">${builds.map(id => `<button class="small-button ${state.selectedBuild === id ? 'selected' : ''}" data-action="select-build" data-id="${id}">${escapeHtml(state.items[id].name)} · ${state.items[id].price}🪙</button>`).join('')}</div><p class="item-meta">Участок отмечен золотой рамкой на карте.</p>`;
}

function renderPanels() {
  if (!state.self) return;
  document.getElementById('panel-inventory').innerHTML = inventoryHtml();
  document.getElementById('panel-quests').innerHTML = questsHtml();
  document.getElementById('panel-home').innerHTML = homeHtml();
}

document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `panel-${button.dataset.tab}`));
}));
document.querySelector('.sidebar').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'use') socket.emit('item:use', { id: button.dataset.id });
  if (button.dataset.action === 'buy-home') socket.emit('home:buy');
  if (button.dataset.action === 'select-build') {
    state.selectedBuild = button.dataset.id;
    renderPanels();
  }
});

function showNpcDialog(data) {
  state.currentNpc = data.npc;
  const npc = data.npc;
  let html = `<h2>${escapeHtml(npc.name)} <span class="item-meta">· ${escapeHtml(npc.title)}</span></h2>`;
  if (data.quest) {
    const progress = data.questState;
    html += `<p><b>${escapeHtml(data.quest.name)}</b><br>${escapeHtml(data.quest.text)}<br><span class="item-meta">Награда: ${data.quest.gold} золота, ${data.quest.xp} опыта</span></p>`;
    if (!progress) html += `<button class="primary" data-dialog-action="accept" data-npc="${npc.id}">Взять задание</button>`;
    else if (progress.status === 'done') html += `<p>Это задание уже выполнено. Спасибо!</p>`;
    else if (progress.progress >= data.quest.amount) html += `<button class="primary" data-dialog-action="claim" data-npc="${npc.id}">Сдать и получить награду</button>`;
    else html += `<p class="item-meta">Прогресс: ${progress.progress}/${data.quest.amount}</p>`;
  }
  if (data.stock) {
    html += `<h3>Лавка</h3><div class="shop-grid">${data.stock.map(item => `<div class="shop-item"><span class="rarity-${item.rarity}">${escapeHtml(item.name)}</span><span class="item-meta">${item.attack ? `Атака +${item.attack} · ` : ''}${item.defense ? `Защита +${item.defense} · ` : ''}${item.heal ? `Лечение ${item.heal} HP · ` : ''}${item.price} золота</span><button data-dialog-action="buy" data-npc="${npc.id}" data-id="${item.id}">Купить</button></div>`).join('')}</div>`;
  }
  document.getElementById('npc-content').innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

document.getElementById('npc-content').addEventListener('click', event => {
  const button = event.target.closest('[data-dialog-action]');
  if (!button) return;
  if (button.dataset.dialogAction === 'accept') socket.emit('quest:accept', { npcId: button.dataset.npc });
  if (button.dataset.dialogAction === 'claim') socket.emit('quest:claim', { npcId: button.dataset.npc });
  if (button.dataset.dialogAction === 'buy') socket.emit('shop:buy', { npcId: button.dataset.npc, itemId: button.dataset.id });
  dialog.close();
});

document.getElementById('chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  if (input.value.trim()) socket.emit('chat:send', { text: input.value });
  input.value = '';
});
function addChat(message) {
  const line = document.createElement('div');
  line.className = `chat-line${message.system ? ' system' : ''}`;
  line.innerHTML = message.system ? escapeHtml(message.text) : `<span class="chat-name">${escapeHtml(message.name)}:</span> ${escapeHtml(message.text)}`;
  const area = document.getElementById('chat-messages');
  area.appendChild(line);
  while (area.children.length > 60) area.firstChild.remove();
  area.scrollTop = area.scrollHeight;
}
function showNotice(message) {
  const el = document.getElementById('notice');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(state.noticeTimer);
  state.noticeTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

window.addEventListener('keydown', event => {
  if (event.target.matches('input')) return;
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    event.preventDefault();
    state.keys[key] = true;
  }
  if (key === 'e' && state.self) talkToNearestNpc();
});
window.addEventListener('keyup', event => { state.keys[event.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { state.keys = {}; socket.emit('move', { x: 0, y: 0 }); });
setInterval(() => {
  if (!state.self) return;
  const x = (state.keys.d || state.keys.arrowright ? 1 : 0) - (state.keys.a || state.keys.arrowleft ? 1 : 0);
  const y = (state.keys.s || state.keys.arrowdown ? 1 : 0) - (state.keys.w || state.keys.arrowup ? 1 : 0);
  socket.emit('move', { x, y });
}, 50);

function worldPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return { x: event.offsetX * sx + state.cameraX, y: event.offsetY * sy + state.cameraY };
}
canvas.addEventListener('click', event => {
  if (!state.self) return;
  const point = worldPoint(event);
  const tx = Math.floor(point.x / TILE);
  const ty = Math.floor(point.y / TILE);
  const ownHome = state.homes.find(home => home.owner.toLowerCase() === state.self.name.toLowerCase());
  if (ownHome && tx >= ownHome.origin.x && tx < ownHome.origin.x + 5 && ty >= ownHome.origin.y && ty < ownHome.origin.y + 5) {
    socket.emit('home:build', { x: tx, y: ty, itemId: state.selectedBuild });
    return;
  }
  socket.emit('attack', { angle: Math.atan2(point.y - state.self.y, point.x - state.self.x) });
});

function talkToNearestNpc() {
  const p = state.self;
  const npc = state.npcs.map(entry => ({ entry, d: Math.hypot(p.x - (entry.x * TILE + 16), p.y - (entry.y * TILE + 16)) })).sort((a, b) => a.d - b.d)[0];
  if (npc && npc.d < 90) socket.emit('npc:talk', { id: npc.entry.id });
  else showNotice('Подойди поближе к NPC в деревне.');
}

function draw() {
  if (!state.self) return;
  const p = state.self;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.cameraX = Math.max(0, Math.min(state.map.width * TILE - canvas.width, p.x - canvas.width / 2));
  state.cameraY = Math.max(0, Math.min(state.map.height * TILE - canvas.height, p.y - canvas.height / 2));
  ctx.save();
  ctx.translate(-state.cameraX, -state.cameraY);
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const road = (x > 9 && x < 22 && y > 8 && y < 12) || (x > 14 && x < 18 && y > 4 && y < 18);
      ctx.fillStyle = road ? ((x + y) % 2 ? '#bca878' : '#c7b487') : ((x + y) % 2 ? '#638255' : '#68895a');
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (!road && (x * 7 + y * 13) % 29 === 0) {
        ctx.fillStyle = '#829967';
        ctx.fillRect(x * TILE + 6, y * TILE + 8, 3, 3);
        ctx.fillRect(x * TILE + 20, y * TILE + 22, 2, 2);
      }
    }
  }
  drawVillage();
  for (const home of state.homes) drawHome(home);
  for (const npc of state.npcs) drawNpc(npc);
  for (const mob of state.mobs) if (mob.hp > 0) drawMob(mob);
  for (const player of state.players) drawPlayer(player, player.name === p.name);
  state.floaters = (state.floaters || []).filter(floater => floater.until > Date.now());
  for (const floater of state.floaters) {
    ctx.fillStyle = '#ffe39c';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(floater.text, floater.x, floater.y - 15 - (floater.until - Date.now()) / 40);
  }
  ctx.restore();
  requestAnimationFrame(draw);
}

function drawVillage() {
  const buildings = [{ x: 7, y: 5, w: 4, h: 3, color: '#a65d46', label: 'ЛАВКА' }, { x: 11, y: 4, w: 4, h: 3, color: '#d2b36f', label: 'РАДА' }, { x: 16, y: 5, w: 4, h: 3, color: '#7f7797', label: 'ЗАЛ' }];
  for (const building of buildings) {
    ctx.fillStyle = '#604a3b';
    ctx.fillRect(building.x * TILE, building.y * TILE + 14, building.w * TILE, building.h * TILE);
    ctx.fillStyle = building.color;
    ctx.fillRect(building.x * TILE + 4, building.y * TILE + 4, building.w * TILE - 8, building.h * TILE - 8);
    ctx.fillStyle = '#49392f';
    ctx.beginPath();
    ctx.moveTo(building.x * TILE - 5, building.y * TILE + 7);
    ctx.lineTo(building.x * TILE + building.w * TILE / 2, building.y * TILE - 16);
    ctx.lineTo((building.x + building.w) * TILE + 5, building.y * TILE + 7);
    ctx.fill();
    ctx.fillStyle = '#e9dfc1';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(building.label, (building.x + building.w / 2) * TILE, (building.y + 2) * TILE);
  }
  for (const [x, y] of [[4, 5], [22, 4], [24, 18], [3, 17], [31, 8], [33, 19]]) drawTree(x, y);
}

function drawTree(tx, ty) {
  const x = tx * TILE + 16, y = ty * TILE + 19;
  ctx.fillStyle = '#69472f';
  ctx.fillRect(x - 4, y - 3, 8, 15);
  ctx.fillStyle = '#315b3c';
  ctx.beginPath(); ctx.arc(x, y - 10, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#46734b';
  ctx.beginPath(); ctx.arc(x - 6, y - 15, 9, 0, Math.PI * 2); ctx.fill();
}

function drawNpc(npc) {
  const x = npc.x * TILE + 16, y = npc.y * TILE + 16;
  const colors = { runa: '#e3b77f', hunter: '#88a9bd', mira: '#e58e9f', sage: '#b39be5' };
  ctx.fillStyle = colors[npc.id] || '#eee';
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff0d9';
  ctx.beginPath(); ctx.arc(x, y - 3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#152119';
  ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(npc.name, x, y - 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif'; ctx.fillText(npc.quest ? '!' : '$', x + 9, y - 8);
}

function drawMob(mob) {
  const def = { wolf: ['#b5bdc6', '🐺'], slime: ['#65d6a5', ''], boar: ['#c88356', ''], wisp: ['#9c8df4', ''] }[mob.type];
  ctx.fillStyle = '#10171355';
  ctx.beginPath(); ctx.ellipse(mob.x, mob.y + 7, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = def[0];
  ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.type === 'boar' ? 13 : 10, 0, Math.PI * 2); ctx.fill();
  if (mob.type === 'wolf') {
    ctx.beginPath(); ctx.moveTo(mob.x - 8, mob.y - 5); ctx.lineTo(mob.x - 7, mob.y - 15); ctx.lineTo(mob.x, mob.y - 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(mob.x + 8, mob.y - 5); ctx.lineTo(mob.x + 7, mob.y - 15); ctx.lineTo(mob.x, mob.y - 7); ctx.fill();
  }
  ctx.fillStyle = '#18201a';
  ctx.beginPath(); ctx.arc(mob.x - 3, mob.y - 1, 1.3, 0, Math.PI * 2); ctx.arc(mob.x + 3, mob.y - 1, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1d19'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(MOB_LABELS[mob.type], mob.x, mob.y - 18);
  if (mob.hp < mob.maxHp) {
    ctx.fillStyle = '#301c1b'; ctx.fillRect(mob.x - 12, mob.y + 13, 24, 3);
    ctx.fillStyle = '#df7268'; ctx.fillRect(mob.x - 12, mob.y + 13, 24 * mob.hp / mob.maxHp, 3);
  }
}
const MOB_LABELS = { wolf: 'Волк', slime: 'Слайм', boar: 'Кабан', wisp: 'Дух' };

function drawPlayer(player, isSelf) {
  ctx.fillStyle = '#10171355';
  ctx.beginPath(); ctx.ellipse(player.x, player.y + 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isSelf ? '#f2ca75' : '#84c8df';
  ctx.beginPath(); ctx.arc(player.x, player.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe8cd';
  ctx.beginPath(); ctx.arc(player.x, player.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#19231d';
  ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(player.name, player.x, player.y - 15);
}

function drawHome(home) {
  const { x, y } = home.origin;
  ctx.strokeStyle = home.owner.toLowerCase() === state.self?.name.toLowerCase() ? '#f2ce77' : '#d5d9b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x * TILE + 1, y * TILE + 1, 5 * TILE - 2, 5 * TILE - 2);
  ctx.fillStyle = '#201c18';
  ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(home.owner, (x + 2.5) * TILE, y * TILE - 3);
  for (const [coord, id] of Object.entries(home.tiles)) {
    const [tx, ty] = coord.split(',').map(Number);
    const item = id;
    const px = tx * TILE, py = ty * TILE;
    const colors = { floor: '#a77a4b', wall: '#806144', door: '#563c2c', bed: '#c4777c', table: '#805c3b', lamp: '#f2cf71' };
    ctx.fillStyle = colors[item] || '#888';
    ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
    if (item === 'lamp') {
      ctx.fillStyle = '#fff2b7'; ctx.beginPath(); ctx.arc(px + 16, py + 16, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.lineWidth = 1;
}

socket.on('connect_error', error => console.error('Socket.IO connection error:', error.message));
