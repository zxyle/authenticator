(function () {
  const STORAGE_KEYS = {
    TOTP_ENTRIES: 'totpEntries',
    API_ENDPOINT: 'apiEndpoint',
    API_TOKEN: 'apiToken',
  };

  const listEl = document.getElementById('list');
  const labelEl = document.getElementById('label');
  const secretEl = document.getElementById('secret');
  const domainPatternEl = document.getElementById('domainPattern');
  const addBtn = document.getElementById('addBtn');
  const apiEndpointEl = document.getElementById('apiEndpoint');
  const apiTokenEl = document.getElementById('apiToken');
  const saveApiBtn = document.getElementById('saveApiBtn');

  function id() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function loadEntries() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.TOTP_ENTRIES], (data) => {
        resolve(data[STORAGE_KEYS.TOTP_ENTRIES] || []);
      });
    });
  }

  function saveEntries(entries) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.TOTP_ENTRIES]: entries }, resolve);
    });
  }

  function renderList(entries) {
    listEl.innerHTML = '';
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<div><div class="name">' +
        (entry.label || entry.issuer || '未命名') +
        '</div>' +
        (entry.domainPattern ? '<div class="domain">' + entry.domainPattern + '</div>' : '') +
        '</div>' +
        '<div class="actions"><button class="delete" data-id="' +
        entry.id +
        '">删除</button></div>';
      listEl.appendChild(li);
    });
    listEl.querySelectorAll('button.delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        loadEntries().then((entries) => {
          const next = entries.filter((e) => e.id !== id);
          saveEntries(next).then(() => renderList(next));
        });
      });
    });
  }

  loadEntries().then(renderList);

  addBtn.addEventListener('click', () => {
    const label = labelEl.value.trim();
    const secret = secretEl.value.trim().replace(/\s/g, '');
    const domainPattern = domainPatternEl.value.trim() || undefined;
    if (!secret) {
      alert('请填写 Secret');
      return;
    }
    loadEntries().then((entries) => {
      const newEntry = {
        id: id(),
        label: label || undefined,
        issuer: label || undefined,
        secret,
        domainPattern,
        source: 'local',
      };
      entries.push(newEntry);
      saveEntries(entries).then(() => {
        renderList(entries);
        labelEl.value = '';
        secretEl.value = '';
        domainPatternEl.value = '';
      });
    });
  });

  chrome.storage.local.get([STORAGE_KEYS.API_ENDPOINT, STORAGE_KEYS.API_TOKEN], (data) => {
    if (data[STORAGE_KEYS.API_ENDPOINT]) apiEndpointEl.value = data[STORAGE_KEYS.API_ENDPOINT];
    if (data[STORAGE_KEYS.API_TOKEN]) apiTokenEl.value = data[STORAGE_KEYS.API_TOKEN];
  });

  saveApiBtn.addEventListener('click', () => {
    chrome.storage.local.set(
      {
        [STORAGE_KEYS.API_ENDPOINT]: apiEndpointEl.value.trim() || '',
        [STORAGE_KEYS.API_TOKEN]: apiTokenEl.value.trim() || '',
      },
      () => {
        saveApiBtn.textContent = '已保存';
        setTimeout(() => (saveApiBtn.textContent = '保存 API 配置'), 1500);
      }
    );
  });
})();
