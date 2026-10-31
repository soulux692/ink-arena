const dgram = require('dgram');
const net = require('net');
const os = require('os');

module.exports = function registerLan(ipcMain, getWindow, app) {
  const DISCOVERY_PORT = 47831;
  const GAME_PORT = 47832;
  const instance = Math.random().toString(36).slice(2);
  const rooms = new Map();
  let udp = null;
  let server = null;
  let socket = null;
  let hostingCode = '';
  let advertiseTimer = null;
  let buffer = '';

  const emit = (payload) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('lan:event', payload);
  };
  const write = (sock, payload) => {
    if (sock && !sock.destroyed) sock.write(JSON.stringify(payload) + '\n');
  };
  const bindSocket = (sock, isHost, code) => {
    socket = sock;
    buffer = '';
    let authorized = !isHost;
    if (!isHost) write(sock, { __join: code });
    sock.setNoDelay(true);
    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.length > 2 * 1024 * 1024) { sock.destroy(); return; }
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (isHost && !authorized) {
          if (msg.__join !== code) { sock.destroy(); return; }
          authorized = true;
          emit({ kind: 'connected' });
          continue;
        }
        if (msg && typeof msg === 'object') emit({ kind: 'message', data: msg });
      }
    });
    if (!isHost) emit({ kind: 'connected' });
    sock.on('close', () => {
      if (socket === sock) socket = null;
      emit({ kind: 'closed' });
    });
    sock.on('error', (error) => emit({ kind: 'error', message: error.message }));
  };

  const startDiscovery = () => {
    if (udp) return;
    udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    udp.on('message', (msg, rinfo) => {
      try {
        const packet = JSON.parse(msg.toString('utf8'));
        if (packet.app !== 'ink-arena' || packet.kind !== 'room' || packet.instance === instance) return;
        if (typeof packet.code !== 'string' || !/^[A-Z0-9]{4,8}$/.test(packet.code)) return;
        rooms.set(packet.code, {
          code: packet.code,
          host: String(packet.host || 'Игрок').slice(0, 32),
          address: rinfo.address,
          port: Number(packet.port) || GAME_PORT,
          version: String(packet.version || ''),
          seen: Date.now()
        });
        emit({ kind: 'rooms', rooms: getRooms() });
      } catch { /* ignore unrelated LAN traffic */ }
    });
    udp.on('error', () => {});
    udp.bind(DISCOVERY_PORT, '0.0.0.0', () => {
      try { udp.setBroadcast(true); } catch {}
    });
  };
  const getRooms = () => [...rooms.values()]
    .filter((r) => Date.now() - r.seen < 5500)
    .map(({ seen, ...r }) => r);

  const stopHost = () => {
    if (advertiseTimer) clearInterval(advertiseTimer);
    advertiseTimer = null;
    hostingCode = '';
    if (server) { try { server.close(); } catch {} server = null; }
  };
  const advertise = () => {
    if (!udp || !hostingCode) return;
    const packet = Buffer.from(JSON.stringify({
      app: 'ink-arena', kind: 'room', code: hostingCode,
      host: os.hostname(), port: GAME_PORT, version: app.getVersion(), instance
    }));
    try { udp.send(packet, DISCOVERY_PORT, '255.255.255.255'); } catch {}
  };

  ipcMain.handle('lan:rooms', () => getRooms());
  ipcMain.handle('lan:host', async (_event, code) => {
    if (typeof code !== 'string' || !/^[A-Z0-9]{4,8}$/.test(code)) return { ok: false, message: 'Некорректный код комнаты.' };
    stopHost();
    startDiscovery();
    hostingCode = code;
    return new Promise((resolve) => {
      server = net.createServer((sock) => {
        if (socket && !socket.destroyed) { sock.destroy(); return; }
        bindSocket(sock, true, code);
      });
      server.once('error', (error) => { stopHost(); resolve({ ok: false, message: error.message }); });
      server.listen(GAME_PORT, '0.0.0.0', () => {
        advertise();
        advertiseTimer = setInterval(advertise, 1200);
        resolve({ ok: true });
      });
    });
  });
  ipcMain.handle('lan:join', async (_event, code) => {
    if (typeof code !== 'string') return { ok: false, message: 'Некорректный код комнаты.' };
    startDiscovery();
    const deadline = Date.now() + 4500;
    let room = rooms.get(code.toUpperCase());
    while (!room && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      room = rooms.get(code.toUpperCase());
    }
    if (!room || Date.now() - room.seen > 5500) return { ok: false, message: 'Комната не найдена в локальной сети.' };
    if (socket && !socket.destroyed) { try { socket.destroy(); } catch {} }
    const client = net.createConnection({ host: room.address, port: room.port });
    return new Promise((resolve) => {
      const timeout = setTimeout(() => { client.destroy(); resolve({ ok: false, message: 'Истекло время подключения к локальной комнате.' }); }, 5000);
      client.once('connect', () => {
        clearTimeout(timeout);
        bindSocket(client, false, code.toUpperCase());
        resolve({ ok: true, host: room.host });
      });
      client.once('error', (error) => {
        clearTimeout(timeout);
        resolve({ ok: false, message: error.message });
      });
    });
  });
  ipcMain.on('lan:send', (_event, payload) => {
    if (payload && typeof payload === 'object') write(socket, payload);
  });
  ipcMain.handle('lan:leave', () => {
    stopHost();
    if (socket) { try { socket.destroy(); } catch {} socket = null; }
    return true;
  });

  startDiscovery();
  const prune = setInterval(() => {
    const before = rooms.size;
    for (const [code, room] of rooms) if (Date.now() - room.seen > 5500) rooms.delete(code);
    if (rooms.size !== before) emit({ kind: 'rooms', rooms: getRooms() });
  }, 2000);
  app.on('before-quit', () => {
    clearInterval(prune);
    stopHost();
    if (socket) { try { socket.destroy(); } catch {} }
    if (udp) { try { udp.close(); } catch {} udp = null; }
  });
};
