(function(){
  const connectBtn = document.getElementById('connectBtn');
  const sendBtn = document.getElementById('sendBtn');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');
  const serverInput = document.getElementById('serverUrl');
  const roomInput = document.getElementById('room');

  let socket = null;

  let remoteConfig = null;
  let alwaysUseServerUrl = false;
  fetch('/config.json').then(r => r.json()).then(cfg => {
    try {
      remoteConfig = cfg || {};
      if (remoteConfig.serverUrl) {
        serverInput.value = remoteConfig.serverUrl;
        serverInput.disabled = true;
        alwaysUseServerUrl = true;
        log('Config loaded — SERVER_URL present, will use online URL by default');
      }
      if (remoteConfig.defaultRoom) roomInput.value = remoteConfig.defaultRoom;
      if (!remoteConfig.serverUrl) log('Config loaded', remoteConfig);
    } catch (e) {
      log('Error loading config:', e);
    }
  }).catch(() => {
    log('No config.json available; leave Server URL empty to use this host');
  });

  function log(...args) {
    const line = document.createElement('div');
    line.textContent = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logEl.prepend(line);
  }

  function setStatus(s) {
    statusEl.textContent = s;
  }

  connectBtn.addEventListener('click', () => {
    if (socket && socket.connected) {
      socket.disconnect();
      setStatus('Disconnected');
      sendBtn.disabled = true;
      connectBtn.textContent = 'Connect';
      return;
    }

    const room = (roomInput && roomInput.value && roomInput.value.trim()) || 'test-room';

    const base = (alwaysUseServerUrl && remoteConfig && remoteConfig.serverUrl)
      ? remoteConfig.serverUrl
      : ((serverInput && serverInput.value && serverInput.value.trim()) || window.location.origin);
    const url = base;

    try {
      socket = io(url + '/game');
    } catch (e) {
      log('io init error', e.message || e);
      setStatus('Init error');
      return;
    }

    setStatus('Connecting...');
    connectBtn.textContent = 'Disconnect';

    socket.on('connect', () => {
      setStatus('Connected: ' + socket.id);
      sendBtn.disabled = false;
      log('connected', socket.id);
      socket.emit('join', room, (ack) => log('joined', ack));
    });

    socket.on('disconnect', (reason) => {
      setStatus('Disconnected (' + reason + ')');
      sendBtn.disabled = true;
      log('disconnected', reason);
      connectBtn.textContent = 'Connect';
    });

    socket.on('message', (m) => log('message', m));
    socket.on('system', (m) => log('system', m));
    socket.on('front_clicked', (m) => log('front_clicked', m));
  });

  sendBtn.addEventListener('click', () => {
    if (!socket || !socket.connected) return log('not connected');
    const room = (roomInput && roomInput.value && roomInput.value.trim()) || 'test-room';
    const payload = { room, data: { cmd: 'mobile_button', ts: Date.now() } };
    socket.emit('message', payload);
    log('sent', payload);
  });

  log('Tip: leave Server URL empty to use this host, or paste a public URL like an ngrok address.');
  log('Tip: keep a local backend/.env (copy .env.example) with SERVER_URL or DEFAULT_ROOM to prefill these fields.');
})();
