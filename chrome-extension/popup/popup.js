(function () {
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
      entriesEl.innerHTML = '<div class="empty">暂无 TOTP 条目，请先在选项中添加</div>';
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
      label.textContent = entry.label || entry.issuer || '未命名';
      const codeEl = document.createElement('div');
      codeEl.className = 'entry-code';
      codeEl.title = '点击复制';
      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      left.appendChild(label);
      left.appendChild(codeEl);
      left.appendChild(meta);
      const fillBtn = document.createElement('button');
      fillBtn.type = 'button';
      fillBtn.className = 'btn-fill';
      fillBtn.textContent = '填充';
      fillBtn.title = '填充到当前页面 OTP 输入框';
      div.appendChild(left);
      div.appendChild(fillBtn);
      entriesEl.appendChild(div);

      function updateCode() {
        TOTP.getToken(entry.secret)
          .then((token) => {
            codeEl.textContent = token;
            meta.textContent = TOTP.getRemainingSeconds() + 's 后更新';
          })
          .catch(() => {
            codeEl.textContent = '---';
            meta.textContent = '密钥无效';
          });
      }
      updateCode();
      const timer = setInterval(updateCode, 1000);
      codeEl.addEventListener('click', () => {
        TOTP.getToken(entry.secret).then((token) => {
          navigator.clipboard.writeText(token);
          codeEl.textContent = '已复制';
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
