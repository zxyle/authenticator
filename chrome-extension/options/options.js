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
  const migrationImageEl = document.getElementById('migrationImage');
  const importDomainPatternEl = document.getElementById('importDomainPattern');
  const previewImportBtn = document.getElementById('previewImportBtn');
  const runImportBtn = document.getElementById('runImportBtn');
  const rollbackImportBtn = document.getElementById('rollbackImportBtn');
  const importStatusEl = document.getElementById('importStatus');
  const importPreviewEl = document.getElementById('importPreview');
  let pendingPreview = null;
  let lastImportedIds = [];

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

      const viewWrap = document.createElement('div');
      viewWrap.className = 'list-row-view';
      const infoCol = document.createElement('div');
      const nameEl = document.createElement('div');
      nameEl.className = 'name';
      nameEl.textContent = entry.label || entry.issuer || '未命名';
      infoCol.appendChild(nameEl);
      if (entry.domainPattern) {
        const domainEl = document.createElement('div');
        domainEl.className = 'domain';
        domainEl.textContent = entry.domainPattern;
        infoCol.appendChild(domainEl);
      }
      const actionsView = document.createElement('div');
      actionsView.className = 'actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'edit';
      editBtn.dataset.id = entry.id;
      editBtn.textContent = '编辑';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete';
      delBtn.dataset.id = entry.id;
      delBtn.textContent = '删除';
      actionsView.appendChild(editBtn);
      actionsView.appendChild(delBtn);
      viewWrap.appendChild(infoCol);
      viewWrap.appendChild(actionsView);

      const editWrap = document.createElement('div');
      editWrap.className = 'list-row-edit';
      editWrap.hidden = true;
      const editFields = document.createElement('div');
      editFields.className = 'edit-fields';
      const labelWrap = document.createElement('label');
      labelWrap.className = 'edit-label';
      labelWrap.textContent = '名称 ';
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = entry.label || entry.issuer || '';
      labelInput.placeholder = '显示名称';
      labelWrap.appendChild(labelInput);
      const domainWrap = document.createElement('label');
      domainWrap.className = 'edit-label';
      domainWrap.textContent = '域名匹配 ';
      const domainInput = document.createElement('input');
      domainInput.type = 'text';
      domainInput.value = entry.domainPattern || '';
      domainInput.placeholder = '可选，如 *.github.com';
      domainWrap.appendChild(domainInput);
      const secretWrap = document.createElement('label');
      secretWrap.className = 'edit-label';
      secretWrap.textContent = 'Secret（只读） ';
      const secretInput = document.createElement('input');
      secretInput.type = 'text';
      secretInput.className = 'secret-readonly';
      secretInput.readOnly = true;
      secretInput.value = entry.secret || '';
      secretWrap.appendChild(secretInput);
      editFields.appendChild(labelWrap);
      editFields.appendChild(domainWrap);
      editFields.appendChild(secretWrap);
      const actionsEdit = document.createElement('div');
      actionsEdit.className = 'actions edit-actions';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'save';
      saveBtn.textContent = '保存';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'cancel-edit';
      cancelBtn.textContent = '取消';
      actionsEdit.appendChild(saveBtn);
      actionsEdit.appendChild(cancelBtn);
      editWrap.appendChild(editFields);
      editWrap.appendChild(actionsEdit);

      li.appendChild(viewWrap);
      li.appendChild(editWrap);

      function showView() {
        viewWrap.hidden = false;
        editWrap.hidden = true;
      }
      function showEdit() {
        viewWrap.hidden = true;
        editWrap.hidden = false;
        labelInput.value = entry.label || entry.issuer || '';
        domainInput.value = entry.domainPattern || '';
        secretInput.value = entry.secret || '';
      }

      editBtn.addEventListener('click', () => showEdit());
      cancelBtn.addEventListener('click', () => showView());
      saveBtn.addEventListener('click', () => {
        const newLabel = labelInput.value.trim();
        const newDomain = domainInput.value.trim() || undefined;
        loadEntries().then((list) => {
          const idx = list.findIndex((e) => e.id === entry.id);
          if (idx === -1) return;
          const prev = list[idx];
          const updated = { ...prev };
          updated.label = newLabel || undefined;
          updated.domainPattern = newDomain;
          if (prev.source === 'ga-import') {
            updated.issuer = prev.issuer;
          } else {
            updated.issuer = newLabel || undefined;
          }
          const next = list.slice();
          next[idx] = updated;
          saveEntries(next).then(() => renderList(next));
        });
      });
      delBtn.addEventListener('click', () => {
        loadEntries().then((list) => {
          const next = list.filter((e) => e.id !== entry.id);
          saveEntries(next).then(() => renderList(next));
        });
      });

      listEl.appendChild(li);
    });
  }

  function normalizeSecret(secret) {
    return (secret || '').replace(/\s/g, '').toUpperCase();
  }

  /** 同一 Secret 只保留一条，避免用户改名后重复导入 */
  function buildDedupKey(entry) {
    return normalizeSecret(entry.secret);
  }

  function setImportStatus(text, type) {
    importStatusEl.textContent = text || '';
    importStatusEl.classList.remove('error', 'success');
    if (type) importStatusEl.classList.add(type);
  }

  function renderPreview(preview) {
    if (!preview) {
      importPreviewEl.classList.remove('visible');
      importPreviewEl.innerHTML = '';
      return;
    }
    const sample = preview.entries.slice(0, 6);
    const sampleHtml = sample
      .map(
        (entry) =>
          '<li>' + (entry.label || entry.issuer || '未命名') + ' <span class="meta">(' + entry.secret.slice(0, 4) + '...)</span></li>'
      )
      .join('');
    importPreviewEl.innerHTML =
      '<div>待导入 <strong>' +
      preview.entries.length +
      '</strong> 条；其中 <strong>' +
      preview.totpCount +
      '</strong> 条为 TOTP，<strong>' +
      preview.hotpCount +
      '</strong> 条为 HOTP（将跳过）。</div>' +
      '<ul>' +
      sampleHtml +
      '</ul>' +
      (preview.entries.length > 6 ? '<div class="meta">仅展示前 6 条...</div>' : '');
    importPreviewEl.classList.add('visible');
  }

  async function buildImportPreview() {
    const file = migrationImageEl.files && migrationImageEl.files[0];
    if (!file) throw new Error('请先选择二维码图片');
    const decoded = await window.GoogleAuthImport.decodeFromImageFile(file);
    const totpEntries = decoded.entries.filter((e) => (e.importMeta?.type || 2) !== 1);
    const hotpCount = decoded.entries.length - totpEntries.length;
    if (!totpEntries.length) throw new Error('二维码中没有可导入的 TOTP 条目');
    const domainPattern = importDomainPatternEl.value.trim() || undefined;
    const entries = totpEntries.map((entry) => {
      const normalized = { ...entry, secret: normalizeSecret(entry.secret) };
      if (domainPattern) normalized.domainPattern = domainPattern;
      return normalized;
    });
    return {
      entries,
      hotpCount,
      totpCount: entries.length,
      meta: decoded.meta,
    };
  }

  async function applyImport(preview) {
    const existing = await loadEntries();
    const seen = new Set(existing.map(buildDedupKey));
    const next = existing.slice();
    const importedIds = [];
    let skipped = 0;
    preview.entries.forEach((entry) => {
      const key = buildDedupKey(entry);
      if (seen.has(key)) {
        skipped += 1;
        return;
      }
      seen.add(key);
      next.push(entry);
      importedIds.push(entry.id);
    });
    await saveEntries(next);
    renderList(next);
    lastImportedIds = importedIds;
    return {
      imported: importedIds.length,
      skipped,
      total: preview.entries.length,
    };
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

  previewImportBtn.addEventListener('click', async () => {
    try {
      setImportStatus('正在解析二维码...', '');
      pendingPreview = await buildImportPreview();
      renderPreview(pendingPreview);
      setImportStatus(
        '解析成功：可导入 ' + pendingPreview.entries.length + ' 条（HOTP 跳过 ' + pendingPreview.hotpCount + ' 条）',
        'success'
      );
    } catch (err) {
      pendingPreview = null;
      renderPreview(null);
      setImportStatus(err && err.message ? err.message : '解析失败', 'error');
    }
  });

  runImportBtn.addEventListener('click', async () => {
    try {
      if (!pendingPreview) pendingPreview = await buildImportPreview();
      const result = await applyImport(pendingPreview);
      setImportStatus(
        '导入完成：新增 ' + result.imported + ' 条，重复跳过 ' + result.skipped + ' 条，共处理 ' + result.total + ' 条',
        'success'
      );
      pendingPreview = null;
      renderPreview(null);
    } catch (err) {
      setImportStatus(err && err.message ? err.message : '导入失败', 'error');
    }
  });

  rollbackImportBtn.addEventListener('click', async () => {
    try {
      if (!lastImportedIds.length) {
        setImportStatus('没有可撤销的导入记录（仅支持本次页面会话中的最近一次导入）', 'error');
        return;
      }
      const entries = await loadEntries();
      const idSet = new Set(lastImportedIds);
      const next = entries.filter((item) => !idSet.has(item.id));
      await saveEntries(next);
      renderList(next);
      setImportStatus('已撤销最近一次导入，共移除 ' + (entries.length - next.length) + ' 条', 'success');
      lastImportedIds = [];
    } catch (err) {
      setImportStatus(err && err.message ? err.message : '撤销失败', 'error');
    }
  });
})();
