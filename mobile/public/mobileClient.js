(function(){
  const logEl = document.getElementById('log');
  const serverInput = document.getElementById('serverUrl');

  const configScreen = document.getElementById('configScreen');
  const pinScreen = document.getElementById('pinScreen');
  const deviceCodeScreen = document.getElementById('deviceCodeScreen');
  const controllerScreen = document.getElementById('controllerScreen');

  const continueBtn = document.getElementById('continueBtn');
  const connectBtn = document.getElementById('connectBtn');
  const pairBtn = document.getElementById('pairBtn');

  const pinStatus = document.getElementById('pinStatus');
  const deviceStatus = document.getElementById('deviceStatus');
  const controllerStatus = document.getElementById('controllerStatus');
  const playerInfo = document.getElementById('playerInfo');

  const pinInputs = [
    document.getElementById('pin1'),
    document.getElementById('pin2'),
    document.getElementById('pin3'),
    document.getElementById('pin4')
  ];

  const codeInputs = [
    document.getElementById('code1'),
    document.getElementById('code2'),
    document.getElementById('code3')
  ];

  let socket = null;
  let roomId = null;
  let roomPin = null;
  let playerNumber = null;
  let remoteConfig = null;
  fetch('/config.json').then(r => r.json()).then(cfg => {
    try {
      remoteConfig = cfg || {};

      if (remoteConfig.availableUrls && remoteConfig.availableUrls.length > 0) {
        const urlSelector = document.createElement('select');
        urlSelector.id = 'urlSelector';
        urlSelector.style.width = '100%';
        urlSelector.style.marginBottom = '10px';

        const detectedOption = document.createElement('option');
        detectedOption.value = remoteConfig.serverUrl;
        detectedOption.textContent = `Detected: ${remoteConfig.serverUrl}`;
        urlSelector.appendChild(detectedOption);

        remoteConfig.availableUrls.forEach(url => {
          const option = document.createElement('option');
          option.value = url;
          option.textContent = url;
          urlSelector.appendChild(option);
        });

        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom URL...';
        urlSelector.appendChild(customOption);

        serverInput.parentNode.insertBefore(urlSelector, serverInput);

        serverInput.value = remoteConfig.serverUrl;
        urlSelector.addEventListener('change', function() {
          if (this.value === 'custom') {
            serverInput.disabled = false;
            serverInput.value = '';
            serverInput.focus();
          } else {
            serverInput.value = this.value;
            serverInput.disabled = true;
          }
        });

        serverInput.style.display = 'none';

        urlSelector.addEventListener('change', function() {
          serverInput.style.display = this.value === 'custom' ? 'block' : 'none';
        });
      } else if (remoteConfig.serverUrl) {
        serverInput.value = remoteConfig.serverUrl;
        serverInput.disabled = true;
        alwaysUseServerUrl = true;
        log('Config loaded — SERVER_URL present, will use online URL by default');
      }
      if (!remoteConfig.serverUrl && !remoteConfig.availableUrls) log('Config loaded', remoteConfig);
    } catch (e) {
      log('Error loading config:', e);
    }
  }).catch(() => {
    log('No config.json available; leave Server URL empty to use this host');
  });

  function log(...args) {
    const line = document.createElement('div');
    line.textContent = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (logEl) logEl.prepend(line);
    console.log(...args);
  }


  function showScreen(screenId) {

    configScreen.classList.remove('active');
    pinScreen.classList.remove('active');
    deviceCodeScreen.classList.remove('active');
    controllerScreen.classList.remove('active');

    document.getElementById(screenId).classList.add('active');
  }

  function setupNumericInputs(inputs, onComplete) {
    inputs.forEach((input, index) => {
      if (index === 0) {
        setTimeout(() => input.focus(), 100);
      }

      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9]/g, '');

        if (input.value.length === 1) {
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        }

        const allFilled = inputs.every(inp => inp.value.length === 1);
        if (allFilled && onComplete) {
          onComplete(inputs.map(inp => inp.value).join(''));
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (input.value.length === 0 && index > 0) {
            inputs[index - 1].focus();
          }
        }
      });
    });
  }

  function connectToServer() {
    let serverUrl;
    const urlSelector = document.getElementById('urlSelector');
    if (urlSelector && urlSelector.value !== 'custom') {
      serverUrl = urlSelector.value;
    } else if (remoteConfig && remoteConfig.serverUrl) {
      serverUrl = remoteConfig.serverUrl;
    } else {
      serverUrl = (serverInput && serverInput.value && serverInput.value.trim()) || window.location.origin;
    }

    try {
      socket = io(serverUrl + '/mobile');

      socket.on('connect', () => {
        log('Connected to server:', socket.id);
        showScreen('pinScreen');
      });

      socket.on('disconnect', (reason) => {
        log('Disconnected from server:', reason);
        showScreen('configScreen');
      });

    } catch (e) {
      log('Socket connection error:', e);
    }
  }

  function joinRoomWithPin(pin) {
    if (!socket || !socket.connected) {
      pinStatus.textContent = 'Non connecté au serveur';
      return;
    }

    pinStatus.textContent = 'Connexion à la room...';

    socket.emit('join_room_by_pin', pin, (response) => {
      if (response.success) {
        log('Room joined:', response);
        roomId = response.roomId;
        roomPin = pin;

        showScreen('deviceCodeScreen');
        pinStatus.textContent = '';
      } else {
        pinStatus.textContent = 'Erreur: ' + (response.error || 'Room non trouvée');
      }
    });
  }

  function pairWithPlayer(deviceCode) {
    if (!socket || !socket.connected || !roomPin) {
      deviceStatus.textContent = 'Non connecté à une room';
      return;
    }

    deviceStatus.textContent = 'Association en cours...';

    socket.emit('pair_with_player', { roomPin, deviceCode }, (response) => {
      if (response.success) {
        log('Paired with player:', response);
        playerNumber = response.playerNumber;

        showScreen('controllerScreen');
        playerInfo.textContent = 'Joueur ' + playerNumber;
        deviceStatus.textContent = '';
      } else {
        deviceStatus.textContent = 'Erreur: ' + (response.error || 'Code invalide');
      }
    });
  }

  function sendControllerInput(action) {
    if (!socket || !socket.connected || !roomId) return;

    socket.emit('controller_input', {
      action,
      timestamp: Date.now(),
      playerNumber
    });

    log('Input sent:', action);
  }

  continueBtn.addEventListener('click', () => {
    log('Continue button clicked');
    connectToServer();
  });

  setupNumericInputs(pinInputs, (pin) => {
    connectBtn.disabled = false;
  });

  connectBtn.addEventListener('click', () => {
    const pin = pinInputs.map(input => input.value).join('');
    if (pin.length === 4) {
      joinRoomWithPin(pin);
    }
  });

  setupNumericInputs(codeInputs, (code) => {
    pairBtn.disabled = false;
  });

  pairBtn.addEventListener('click', () => {
    const code = codeInputs.map(input => input.value).join('');
    if (code.length === 3) {
      pairWithPlayer(code);
    }
  });

  document.querySelectorAll('.controller-button').forEach(button => {
    button.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const action = button.getAttribute('data-action');
      sendControllerInput(action);
    });

    button.addEventListener('mousedown', () => {
      const action = button.getAttribute('data-action');
      sendControllerInput(action);
    });
  });
})();
