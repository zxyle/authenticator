(function () {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  applyI18nAttributes();

  const t = chrome.i18n.getMessage.bind(chrome.i18n);

  function displayLabel(entry) {
    return entry.label || entry.issuer || t('unnamed');
  }

  const entriesEl = document.getElementById('entries');
  const fillCurrentBtn = document.getElementById('fillCurrent');
  const openOptionsEl = document.getElementById('openOptions');

  openOptionsEl.href = chrome.runtime.getURL('options/options.html');
  openOptionsEl.target = '_blank';

  const STORAGE_KEYS = { TOTP_ENTRIES: 'totpEntries' };

  function loadEntries() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.TOTP_ENTRIES], (data) => {
        resolve(data[STORAGE_KEYS.TOTP_ENTRIES] || []);
      });
    });
  }

  function renderEntries(entries) {
    if (!entries.length) {
      entriesEl.innerHTML = '<div class="empty">' + t('popupEmpty') + '</div>';
      fillCurrentBtn.disabled = true;
      return;
    }
    fillCurrentBtn.disabled = false;
    entriesEl.innerHTML = '';
    entries.forEach((entry) => {
      const div = document.createElement('div');
      div.className = 'entry';
      div.dataset.id = entry.id;
      const left = document.createElement('div');
      left.className = 'entry-left';
      const label = document.createElement('div');
      label.className = 'entry-label';
      label.textContent = displayLabel(entry);
      const codeEl = document.createElement('div');
      codeEl.className = 'entry-code';
      codeEl.title = t('clickToCopy');
      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      left.appendChild(label);
      left.appendChild(codeEl);
      left.appendChild(meta);
      const fillBtn = document.createElement('button');
      fillBtn.type = 'button';
      fillBtn.className = 'btn-fill';
      fillBtn.textContent = t('fill');
      fillBtn.title = t('fillOtpTooltip');
      div.appendChild(left);
      div.appendChild(fillBtn);
      entriesEl.appendChild(div);

      function updateCode() {
        TOTP.getToken(entry.secret)
          .then((token) => {
            codeEl.textContent = token;
            meta.textContent = t('secondsUntilRefresh', String(TOTP.getRemainingSeconds()));
          })
          .catch(() => {
            codeEl.textContent = '---';
            meta.textContent = t('invalidSecret');
          });
      }
      updateCode();
      const timer = setInterval(updateCode, 1000);
      codeEl.addEventListener('click', () => {
        TOTP.getToken(entry.secret).then((token) => {
          navigator.clipboard.writeText(token);
          codeEl.textContent = t('copied');
          setTimeout(updateCode, 800);
        });
      });
      fillBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          if (!tab?.id) return;
          TOTP.getToken(entry.secret).then((token) => {
            chrome.tabs.sendMessage(tab.id, { type: 'FILL_OTP', token });
          });
        });
      });
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        clearInterval(timer);
      });
    });
  }

  loadEntries().then(renderEntries);

  fillCurrentBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;
      loadEntries().then((entries) => {
        if (!entries.length) return;
        const first = entries[0];
        TOTP.getToken(first.secret).then((token) => {
          chrome.tabs.sendMessage(tab.id, { type: 'FILL_OTP', token });
        });
      });
    });
  });
})();
