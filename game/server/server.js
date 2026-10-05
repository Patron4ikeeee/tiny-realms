const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const TILE = 32;
const MAP = { width: 36, height: 24 };
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000
});

app.get('/', (_req, res) => res.json({ name: 'Tiny Realms', status: 'online' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', players: online.size }));

const ITEMS = {
  rusty_sword: { name: 'Ржавый меч', type: 'weapon', rarity: 'common', attack: 2, price: 0 },
  iron_sword: { name: 'Железный меч', type: 'weapon', rarity: 'rare', attack: 6, price: 45 },
  moon_blade: { name: 'Лунный клинок', type: 'weapon', rarity: 'epic', attack: 12, price: 180 },
  wooden_bow: { name: 'Лук следопыта', type: 'weapon', rarity: 'rare', attack: 4, price: 55 },
  cloth_armor: { name: 'Тканевая броня', type: 'armor', rarity: 'common', defense: 1, price: 0 },
  leather_armor: { name: 'Кожаная броня', type: 'armor', rarity: 'rare', defense: 4, price: 65 },
  guardian_armor: { name: 'Доспех стража', type: 'armor', rarity: 'epic', defense: 8, price: 200 },
  health_potion: { name: 'Зелье здоровья', type: 'consumable', rarity: 'common', heal: 35, price: 12 },
  strong_potion: { name: 'Большое зелье', type: 'consumable', rarity: 'rare', heal: 80, price: 32 },
  wolf_pelt: { name: 'Волчья шкура', type: 'resource', rarity: 'common', price: 0 },
  wolf_fang: { name: 'Волчий клык', type: 'resource', rarity: 'rare', price: 0 },
  herb: { name: 'Лесная трава', type: 'resource', rarity: 'common', price: 0 },
  wood: { name: 'Доски', type: 'resource', rarity: 'common', price: 5 },
  stone: { name: 'Камень', type: 'resource', rarity: 'common', price: 4 },
  apple: { name: 'Яблоко', type: 'consumable', rarity: 'common', heal: 15, price: 5 },
  copper_ring: { name: 'Медное кольцо', type: 'resource', rarity: 'rare', price: 35 },
  slime_gel: { name: 'Слизь слайма', type: 'resource', rarity: 'common', price: 0 },
  boar_tusk: { name: 'Клык кабана', type: 'resource', rarity: 'rare', price: 0 },
  blue_crystal: { name: 'Синий кристалл', type: 'resource', rarity: 'epic', price: 0 },
  cloth: { name: 'Льняная ткань', type: 'resource', rarity: 'common', price: 8 },
  floor: { name: 'Деревянный пол', type: 'building', rarity: 'common', price: 8 },
  wall: { name: 'Деревянная стена', type: 'building', rarity: 'common', price: 12 },
  door: { name: 'Дверь', type: 'building', rarity: 'common', price: 15 },
  bed: { name: 'Кровать', type: 'building', rarity: 'rare', price: 25 },
  table: { name: 'Стол', type: 'building', rarity: 'common', price: 18 },
  lamp: { name: 'Фонарь', type: 'building', rarity: 'rare', price: 20 }
};

const NPCS = [
  { id: 'runa', name: 'Руна', title: 'Староста', x: 11, y: 7, quest: 'wolves' },
  { id: 'hunter', name: 'Тор', title: 'Охотник', x: 15, y: 8, quest: 'pelts' },
  { id: 'mira', name: 'Мира', title: 'Торговка', x: 8, y: 8, shop: true },
  { id: 'sage', name: 'Элвин', title: 'Мудрец', x: 19, y: 7, quest: 'slimes' }
];
const QUESTS = {
  wolves: { name: 'Волчья угроза', text: 'Убей 10 волков', kind: 'kill', item: 'wolf', amount: 10, xp: 100, gold: 60 },
  pelts: { name: 'Тёплые плащи', text: 'Принеси 5 волчьих шкур', kind: 'collect', item: 'wolf_pelt', amount: 5, xp: 80, gold: 45 },
  slimes: { name: 'Слизистая проблема', text: 'Победи 6 слизней', kind: 'kill', item: 'slime', amount: 6, xp: 75, gold: 40 }
};
const STRUCTURES = ['floor', 'wall', 'door', 'bed', 'table', 'lamp'];
const MOB_TYPES = {
  wolf: { name: 'Волк', color: '#b5bdc6', hp: 32, attack: 5, xp: 16, gold: [3, 9], drops: [['wolf_pelt', 0.55], ['wolf_fang', 0.18]] },
  slime: { name: 'Слайм', color: '#65d6a5', hp: 24, attack: 3, xp: 12, gold: [2, 7], drops: [['slime_gel', 0.6], ['herb', 0.2]] },
  boar: { name: 'Кабан', color: '#c88356', hp: 45, attack: 7, xp: 22, gold: [5, 12], drops: [['boar_tusk', 0.35], ['wolf_pelt', 0.2]] },
  wisp: { name: 'Дух', color: '#9c8df4', hp: 38, attack: 6, xp: 25, gold: [7, 15], drops: [['blue_crystal', 0.25], ['copper_ring', 0.1]] }
};
const SPAWNS = [
  ['wolf', 5, 4], ['wolf', 7, 13], ['wolf', 23, 5],
  ['slime', 5, 18], ['slime', 25, 8], ['slime', 18, 18],
  ['boar', 29, 5], ['wisp', 29, 12]
];
const online = new Map();
const socketPlayers = new Map();
let store;

function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read ${DATA_FILE}: ${error.message}`);
    store = { players: {}, homes: {}, mobs: [] };
  }
  store.players ||= {};
  store.homes ||= {};
  store.mobs ||= [];
  if (store.mobs.length === 0) {
    store.mobs = SPAWNS.map(([type, tx, ty], index) => {
      const stats = MOB_TYPES[type];
      return { id: `mob-${index + 1}`, type, x: tx * TILE + 16, y: ty * TILE + 16, hp: stats.hp, maxHp: stats.hp, respawnAt: 0, attackAt: 0 };
    });
  }
}

function saveStore() {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, DATA_FILE);
}

function cleanName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function newPlayer(name) {
  return {
    name, x: 12 * TILE + 16, y: 11 * TILE + 16, hp: 100, maxHp: 100,
    level: 1, xp: 0, gold: 35, attack: 5, defense: 0, facing: 0,
    inventory: [{ id: 'rusty_sword', qty: 1 }, { id: 'cloth_armor', qty: 1 }, { id: 'health_potion', qty: 3 }],
    equipment: { weapon: 'rusty_sword', armor: 'cloth_armor' },
    quests: {}, plot: null, lastAttack: 0, lastMobHit: 0, input: { x: 0, y: 0 }
  };
}

function recalc(player) {
  const weapon = ITEMS[player.equipment.weapon];
  const armor = ITEMS[player.equipment.armor];
  player.attack = 5 + (weapon?.attack || 0) + Math.floor((player.level - 1) * 1.5);
  player.defense = (armor?.defense || 0) + Math.floor((player.level - 1) / 3);
  player.maxHp = 100 + (player.level - 1) * 12;
  player.hp = Math.min(player.hp, player.maxHp);
}

function playerView(player) {
  const { name, x, y, hp, maxHp, level, xp, gold, attack, defense, equipment, inventory, quests, plot } = player;
  return { name, x, y, hp, maxHp, level, xp, nextXp: level * 100, gold, attack, defense, equipment, inventory, quests, plot };
}

function snapshot() {
  return {
    players: [...online.values()].map(playerView),
    mobs: store.mobs.map(({ id, type, x, y, hp, maxHp, respawnAt }) => ({ id, type, x, y, hp, maxHp, respawnAt })),
    npcs: NPCS, map: MAP,
    items: ITEMS, quests: QUESTS, structures: STRUCTURES
  };
}

function sendNotice(socket, text, kind = 'info') {
  socket.emit('notice', { text, kind });
}

function addItem(player, id, amount = 1) {
  if (!ITEMS[id] || amount < 1) return;
  const stack = player.inventory.find(item => item.id === id);
  if (stack) stack.qty += amount;
  else player.inventory.push({ id, qty: amount });
}

function removeItem(player, id, amount = 1) {
  const stack = player.inventory.find(item => item.id === id);
  if (!stack || stack.qty < amount) return false;
  stack.qty -= amount;
  if (stack.qty === 0) player.inventory = player.inventory.filter(item => item.id !== id);
  return true;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function giveXp(player, amount) {
  player.xp += amount;
  while (player.xp >= player.level * 100) {
    player.xp -= player.level * 100;
    player.level++;
    player.maxHp += 12;
    player.hp = player.maxHp;
    recalc(player);
  }
}

function updateQuests(player, kind, target, amount = 1) {
  for (const [id, quest] of Object.entries(player.quests)) {
    const def = QUESTS[id];
    if (quest.status === 'active' && def.kind === kind && def.item === target) {
      quest.progress = Math.min(def.amount, quest.progress + amount);
    }
  }
}

function publicHome(home) {
  return home ? { owner: home.owner, origin: home.origin, tiles: home.tiles } : null;
}

io.on('connection', socket => {
  socket.emit('welcome', { map: MAP });

  socket.on('login', (payload = {}) => {
    if (socketPlayers.has(socket.id)) return;
    const name = cleanName(payload.name);
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      socket.emit('login:error', 'Ник: 3–16 символов, только латинские буквы, цифры и _.');
      return;
    }
    const key = name.toLowerCase();
    if ([...online.values()].some(player => player.name.toLowerCase() === key)) {
      socket.emit('login:error', 'Этот ник уже в игре. Выбери другой.');
      return;
    }
    const player = store.players[key] || (store.players[key] = newPlayer(name));
    player.name = name;
    player.input = { x: 0, y: 0 };
    player.lastAttack = 0;
    player.lastMobHit = 0;
    recalc(player);
    online.set(socket.id, player);
    socketPlayers.set(socket.id, key);
    socket.emit('login:ok', { self: playerView(player), state: snapshot(), homes: Object.values(store.homes).map(publicHome) });
    socket.broadcast.emit('chat:message', { system: true, text: `${name} вошёл в мир` });
    io.emit('world:state', snapshot());
  });

  socket.on('move', (input = {}) => {
    const player = online.get(socket.id);
    if (!player) return;
    let x = Number(input.x) || 0;
    let y = Number(input.y) || 0;
    const length = Math.hypot(x, y) || 1;
    player.input = { x: Math.max(-1, Math.min(1, x)) / length, y: Math.max(-1, Math.min(1, y)) / length };
  });

  socket.on('attack', (payload = {}) => {
    const player = online.get(socket.id);
    if (!player) return;
    const now = Date.now();
    if (now - player.lastAttack < 450 || player.hp <= 0) return;
    const angle = Number(payload.angle);
    if (!Number.isFinite(angle)) return;
    player.lastAttack = now;
    player.facing = angle;
    const target = store.mobs.filter(mob => mob.hp > 0 && distance(player, mob) <= 62)
      .map(mob => ({ mob, diff: Math.abs(Math.atan2(Math.sin(Math.atan2(mob.y - player.y, mob.x - player.x) - angle), Math.cos(Math.atan2(mob.y - player.y, mob.x - player.x) - angle))) }))
      .filter(candidate => candidate.diff < 1.25)
      .sort((a, b) => a.diff - b.diff)[0]?.mob;
    if (!target) return;
    target.hp = Math.max(0, target.hp - player.attack);
    io.emit('combat:hit', { x: target.x, y: target.y, damage: player.attack, mobId: target.id });
    if (target.hp === 0) {
      const mobStats = MOB_TYPES[target.type];
      giveXp(player, mobStats.xp);
      player.gold += mobStats.gold[0] + Math.floor(Math.random() * (mobStats.gold[1] - mobStats.gold[0] + 1));
      updateQuests(player, 'kill', target.type);
      for (const [id, chance] of mobStats.drops) {
        if (Math.random() < chance) {
          addItem(player, id);
          socket.emit('loot', { id, name: ITEMS[id].name });
          updateQuests(player, 'collect', id);
        }
      }
      target.respawnAt = now + 10000;
      sendNotice(socket, `Победа! +${mobStats.xp} опыта, добыча золота`, 'good');
    }
  });

  socket.on('npc:talk', payload => {
    const player = online.get(socket.id);
    const npc = NPCS.find(entry => entry.id === payload?.id);
    if (!player || !npc || distance(player, { x: npc.x * TILE + 16, y: npc.y * TILE + 16 }) > 80) {
      sendNotice(socket, 'Подойди ближе к NPC.');
      return;
    }
    socket.emit('npc:dialog', {
      npc,
      quest: npc.quest ? QUESTS[npc.quest] : null,
      questState: npc.quest ? (player.quests[npc.quest] || null) : null,
      stock: npc.shop ? Object.entries(ITEMS).filter(([, item]) => ['weapon', 'armor', 'consumable', 'building'].includes(item.type)).map(([id, item]) => ({ id, ...item })) : []
    });
  });

  socket.on('quest:accept', payload => {
    const player = online.get(socket.id);
    const npc = NPCS.find(entry => entry.id === payload?.npcId);
    if (!player || !npc?.quest || distance(player, { x: npc.x * TILE + 16, y: npc.y * TILE + 16 }) > 80) return;
    const id = npc.quest;
    if (player.quests[id]) return sendNotice(socket, 'Это задание уже принято или выполнено.');
    player.quests[id] = { status: 'active', progress: 0 };
    sendNotice(socket, `Задание принято: ${QUESTS[id].name}`, 'good');
  });

  socket.on('quest:claim', payload => {
    const player = online.get(socket.id);
    const npc = NPCS.find(entry => entry.id === payload?.npcId);
    if (!player || !npc?.quest || distance(player, { x: npc.x * TILE + 16, y: npc.y * TILE + 16 }) > 80) return;
    const id = npc.quest;
    const quest = player.quests[id];
    const def = QUESTS[id];
    if (!quest || quest.status !== 'active' || quest.progress < def.amount) return sendNotice(socket, 'Задание ещё не завершено.');
    if (def.kind === 'collect' && !removeItem(player, def.item, def.amount)) return sendNotice(socket, `Нужно принести: ${ITEMS[def.item].name} x${def.amount}.`);
    quest.status = 'done';
    player.gold += def.gold;
    giveXp(player, def.xp);
    sendNotice(socket, `Награда получена: ${def.gold} золота и ${def.xp} опыта`, 'good');
  });

  socket.on('shop:buy', payload => {
    const player = online.get(socket.id);
    const npc = NPCS.find(entry => entry.id === payload?.npcId);
    const item = ITEMS[payload?.itemId];
    if (!player || !npc?.shop || !item || !['weapon', 'armor', 'consumable', 'building'].includes(item.type)) return;
    if (distance(player, { x: npc.x * TILE + 16, y: npc.y * TILE + 16 }) > 80) return sendNotice(socket, 'Подойди к торговке ближе.');
    if (player.gold < item.price) return sendNotice(socket, 'Не хватает золота.');
    player.gold -= item.price;
    addItem(player, payload.itemId);
    sendNotice(socket, `Куплено: ${item.name}`, 'good');
  });

  socket.on('item:use', payload => {
    const player = online.get(socket.id);
    const item = ITEMS[payload?.id];
    if (!player || !item || !removeItem(player, payload.id)) return;
    if (item.type === 'consumable') {
      player.hp = Math.min(player.maxHp, player.hp + item.heal);
      sendNotice(socket, `${item.name}: восстановлено ${item.heal} HP`, 'good');
    } else if (item.type === 'weapon' || item.type === 'armor') {
      player.equipment[item.type] = payload.id;
      addItem(player, payload.id);
      recalc(player);
      sendNotice(socket, `Экипировано: ${item.name}`, 'good');
    } else {
      addItem(player, payload.id);
      sendNotice(socket, 'Этот предмет нельзя использовать отдельно.');
    }
  });

  socket.on('home:buy', () => {
    const player = online.get(socket.id);
    if (!player) return;
    if (player.plot !== null && player.plot !== undefined) return sendNotice(socket, 'У тебя уже есть участок.');
    if (player.gold < 50) return sendNotice(socket, 'Участок стоит 50 золота.');
    const occupied = new Set(Object.values(store.homes).map(home => home.slot));
    const slot = [0, 1, 2, 3, 4, 5].find(index => !occupied.has(index));
    if (slot === undefined) return sendNotice(socket, 'Свободных участков пока нет.');
    player.gold -= 50;
    player.plot = slot;
    const origin = { x: 4 + slot * 6, y: 17 };
    store.homes[player.name.toLowerCase()] = { owner: player.name, slot, origin, tiles: {} };
    socket.emit('home:update', publicHome(store.homes[player.name.toLowerCase()]));
    sendNotice(socket, 'Участок куплен! Постройка стоит у южной дороги.', 'good');
  });

  socket.on('home:build', payload => {
    const player = online.get(socket.id);
    if (!player || player.plot === null || player.plot === undefined || !STRUCTURES.includes(payload?.itemId)) return sendNotice(socket, 'Сначала купи участок и выбери постройку.');
    const home = store.homes[player.name.toLowerCase()];
    const tx = Math.floor(Number(payload.x));
    const ty = Math.floor(Number(payload.y));
    const item = ITEMS[payload.itemId];
    if (!home || !Number.isInteger(tx) || !Number.isInteger(ty) ||
        tx < home.origin.x || tx >= home.origin.x + 5 || ty < home.origin.y || ty >= home.origin.y + 5) {
      return sendNotice(socket, 'Строить можно только на своём участке 5×5.');
    }
    if (player.gold < item.price) return sendNotice(socket, `Нужно ${item.price} золота.`);
    player.gold -= item.price;
    home.tiles[`${tx},${ty}`] = payload.itemId;
    io.emit('home:update', publicHome(home));
    sendNotice(socket, `${item.name} построен(-а)`, 'good');
  });

  socket.on('chat:send', payload => {
    const player = online.get(socket.id);
    if (!player || typeof payload?.text !== 'string') return;
    const text = payload.text.trim().slice(0, 180);
    if (!text) return;
    io.emit('chat:message', { name: player.name, text, at: Date.now() });
  });

  socket.on('disconnect', () => {
    const player = online.get(socket.id);
    if (player) {
      player.input = { x: 0, y: 0 };
      socket.broadcast.emit('chat:message', { system: true, text: `${player.name} вышел из мира` });
      online.delete(socket.id);
      socketPlayers.delete(socket.id);
      io.emit('world:state', snapshot());
    }
  });
});

function gameTick() {
  const now = Date.now();
  for (const player of online.values()) {
    const speed = 145 / 20;
    player.x = Math.max(16, Math.min(MAP.width * TILE - 16, player.x + player.input.x * speed));
    player.y = Math.max(16, Math.min(MAP.height * TILE - 16, player.y + player.input.y * speed));
    if (player.hp <= 0) {
      player.hp = player.maxHp;
      player.x = 12 * TILE + 16;
      player.y = 11 * TILE + 16;
      io.to([...online.entries()].find(([, p]) => p === player)?.[0]).emit('notice', { text: 'Ты восстановился в деревне.', kind: 'info' });
    }
  }
  for (const mob of store.mobs) {
    const stats = MOB_TYPES[mob.type];
    if (mob.hp <= 0) {
      if (now >= mob.respawnAt) {
        mob.hp = mob.maxHp;
        const spawn = SPAWNS[Number(mob.id.split('-')[1]) - 1];
        mob.x = spawn[1] * TILE + 16;
        mob.y = spawn[2] * TILE + 16;
      }
      continue;
    }
    const nearby = [...online.values()].filter(player => player.hp > 0 && distance(player, mob) < 230);
    if (nearby.length) {
      const target = nearby.sort((a, b) => distance(a, mob) - distance(b, mob))[0];
      const d = distance(target, mob);
      if (d > 27) {
        mob.x += ((target.x - mob.x) / d) * 1.6;
        mob.y += ((target.y - mob.y) / d) * 1.6;
      } else if (now - (mob.attackAt || 0) > 1100) {
        mob.attackAt = now;
        target.hp = Math.max(0, target.hp - Math.max(1, stats.attack - target.defense));
        const ownerSocket = [...online.entries()].find(([, player]) => player === target)?.[0];
        if (ownerSocket) io.to(ownerSocket).emit('notice', `Получен урон: ${Math.max(1, stats.attack - target.defense)}`, 'danger');
      }
    }
  }
  io.emit('world:state', snapshot());
}

loadStore();
setInterval(gameTick, 50);
setInterval(() => {
  for (const [key, player] of store.players ? Object.entries(store.players) : []) {
    const active = [...online.values()].find(entry => entry.name.toLowerCase() === key);
    if (active) Object.assign(player, playerView(active));
  }
  try {
    saveStore();
  } catch (error) {
    console.error('Failed to save game data:', error);
  }
}, 15000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Tiny Realms server listening on ${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try {
      saveStore();
    } catch (error) {
      console.error('Failed to save game data during shutdown:', error);
    }
    httpServer.close(() => process.exit(0));
  });
}
