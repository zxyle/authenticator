(function () {
  const STORAGE_KEYS = {
    TOTP_ENTRIES: 'totpEntries',
  };

  const PAGE_SIZE = 10;

  const tableBodyEl = document.getElementById('tableBody');
  const emptyHintEl = document.getElementById('emptyHint');
  const paginationEl = document.getElementById('pagination');
  const pagePrevEl = document.getElementById('pagePrev');
  const pageNextEl = document.getElementById('pageNext');
  const pageInfoEl = document.getElementById('pageInfo');

  const openAddDialogBtn = document.getElementById('openAddDialogBtn');
  const openQrAddDialogBtn = document.getElementById('openQrAddDialogBtn');
  const openImportDialogBtn = document.getElementById('openImportDialogBtn');
  const addDialog = document.getElementById('addDialog');
  const addForm = document.getElementById('addForm');
  const addCancelBtn = document.getElementById('addCancelBtn');
  const labelEl = document.getElementById('label');
  const secretEl = document.getElementById('secret');
  const domainPatternEl = document.getElementById('domainPattern');

  const editDialog = document.getElementById('editDialog');
  const editCancelBtn = document.getElementById('editCancelBtn');
  const editSaveBtn = document.getElementById('editSaveBtn');
  const editLabelEl = document.getElementById('editLabel');
  const editDomainPatternEl = document.getElementById('editDomainPattern');
  const editSecretEl = document.getElementById('editSecret');
  let editingEntryId = null;

  const qrAddDialog = document.getElementById('qrAddDialog');
  const qrAddImageEl = document.getElementById('qrAddImage');
  const qrAddDomainPatternEl = document.getElementById('qrAddDomainPattern');
  const qrAddStatusEl = document.getElementById('qrAddStatus');
  const qrAddCancelBtn = document.getElementById('qrAddCancelBtn');
  const qrAddSubmitBtn = document.getElementById('qrAddSubmitBtn');

  const importDialog = document.getElementById('importDialog');
  const importCloseBtn = document.getElementById('importCloseBtn');
  const migrationImageEl = document.getElementById('migrationImage');
  const previewImportBtn = document.getElementById('previewImportBtn');
  const runImportBtn = document.getElementById('runImportBtn');
  const rollbackImportBtn = document.getElementById('rollbackImportBtn');
  const importStatusEl = document.getElementById('importStatus');
  const importPreviewEl = document.getElementById('importPreview');

  let cachedEntries = [];
  let currentPage = 1;
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

  function totalPages(n) {
    return Math.max(1, Math.ceil(n / PAGE_SIZE));
  }

  function clampPage(entriesLength) {
    const tp = totalPages(entriesLength);
    if (currentPage > tp) currentPage = tp;
    if (currentPage < 1) currentPage = 1;
  }

  function updatePaginationUi(entriesLength) {
    if (entriesLength === 0) {
      paginationEl.hidden = true;
      return;
    }
    paginationEl.hidden = false;
    const tp = totalPages(entriesLength);
    pageInfoEl.textContent = '第 ' + currentPage + ' / ' + tp + ' 页，共 ' + entriesLength + ' 条';
    pagePrevEl.disabled = currentPage <= 1;
    pageNextEl.disabled = currentPage >= tp;
  }

  function renderTable(entries) {
    cachedEntries = entries;
    clampPage(entries.length);

    const empty = entries.length === 0;
    emptyHintEl.hidden = !empty;
    tableBodyEl.closest('.table-wrap').hidden = empty;
    updatePaginationUi(entries.length);

    tableBodyEl.innerHTML = '';
    if (empty) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = entries.slice(start, start + PAGE_SIZE);

    slice.forEach((entry, i) => {
      const tr = document.createElement('tr');

      const tdIndex = document.createElement('td');
      tdIndex.className = 'cell-index';
      tdIndex.textContent = String(start + i + 1);

      const tdName = document.createElement('td');
      tdName.className = 'cell-name';
      tdName.textContent = entry.label || entry.issuer || '未命名';

      const tdDomain = document.createElement('td');
      tdDomain.className = 'cell-domain' + (entry.domainPattern ? '' : ' is-empty');
      tdDomain.textContent = entry.domainPattern || '—';

      const tdActions = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-icon edit';
      editBtn.setAttribute('aria-label', '编辑');
      editBtn.title = '编辑';
      editBtn.innerHTML =
        '<svg class="btn-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon delete';
      delBtn.setAttribute('aria-label', '删除');
      delBtn.title = '删除';
      delBtn.innerHTML =
        '<svg class="btn-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      tdActions.appendChild(actions);

      editBtn.addEventListener('click', () => openEditDialog(entry));
      delBtn.addEventListener('click', () => {
        loadEntries().then((list) => {
          const next = list.filter((e) => e.id !== entry.id);
          saveEntries(next).then(() => {
            clampPage(next.length);
            renderTable(next);
          });
        });
      });

      tr.appendChild(tdIndex);
      tr.appendChild(tdName);
      tr.appendChild(tdDomain);
      tr.appendChild(tdActions);
      tableBodyEl.appendChild(tr);
    });
  }

  function openEditDialog(entry) {
    editingEntryId = entry.id;
    editLabelEl.value = entry.label || entry.issuer || '';
    editDomainPatternEl.value = entry.domainPattern || '';
    editSecretEl.value = entry.secret || '';
    editDialog.showModal();
  }

  function closeEditDialog() {
    editDialog.close();
  }

  function normalizeSecret(secret) {
    return (secret || '').replace(/\s/g, '').toUpperCase();
  }

  function buildDedupKey(entry) {
    return normalizeSecret(entry.secret);
  }

  function setImportStatus(text, type) {
    importStatusEl.textContent = text || '';
    importStatusEl.classList.remove('error', 'success');
    if (type) importStatusEl.classList.add(type);
  }

  function setQrAddStatus(text, type) {
    qrAddStatusEl.textContent = text || '';
    qrAddStatusEl.classList.remove('error', 'success');
    if (type) qrAddStatusEl.classList.add(type);
  }

  function resetQrAddDialog() {
    qrAddImageEl.value = '';
    qrAddDomainPatternEl.value = '';
    setQrAddStatus('', '');
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
    const entries = totpEntries.map((entry) => ({
      ...entry,
      secret: normalizeSecret(entry.secret),
    }));
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
    currentPage = totalPages(next.length);
    renderTable(next);
    lastImportedIds = importedIds;
    return {
      imported: importedIds.length,
      skipped,
      total: preview.entries.length,
    };
  }

  function resetAddForm() {
    labelEl.value = '';
    secretEl.value = '';
    domainPatternEl.value = '';
  }

  openAddDialogBtn.addEventListener('click', () => {
    resetAddForm();
    addDialog.showModal();
  });
  addCancelBtn.addEventListener('click', () => addDialog.close());
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
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
        currentPage = totalPages(entries.length);
        renderTable(entries);
        addDialog.close();
        resetAddForm();
      });
    });
  });

  editDialog.addEventListener('close', () => {
    editingEntryId = null;
  });
  editCancelBtn.addEventListener('click', () => closeEditDialog());
  editSaveBtn.addEventListener('click', () => {
    if (!editingEntryId) return;
    const newLabel = editLabelEl.value.trim();
    const newDomain = editDomainPatternEl.value.trim() || undefined;
    loadEntries().then((list) => {
      const idx = list.findIndex((e) => e.id === editingEntryId);
      if (idx === -1) {
        closeEditDialog();
        return;
      }
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
      saveEntries(next).then(() => {
        renderTable(next);
        closeEditDialog();
      });
    });
  });

  openQrAddDialogBtn.addEventListener('click', () => {
    resetQrAddDialog();
    qrAddDialog.showModal();
  });
  qrAddCancelBtn.addEventListener('click', () => qrAddDialog.close());
  qrAddDialog.addEventListener('close', () => resetQrAddDialog());
  qrAddSubmitBtn.addEventListener('click', async () => {
    const file = qrAddImageEl.files && qrAddImageEl.files[0];
    if (!file) {
      setQrAddStatus('请先选择二维码图片', 'error');
      return;
    }
    setQrAddStatus('正在识别…', '');
    try {
      const raw = await window.GoogleAuthImport.decodeQrFromImageBlob(file);
      const entries = window.GoogleAuthImport.entriesFromQrPayload(raw);
      if (entries.length > 1) {
        setQrAddStatus('该二维码包含多个账号，请使用工具栏「导入」批量添加', 'error');
        return;
      }
      const domainPattern = qrAddDomainPatternEl.value.trim() || undefined;
      const entry = { ...entries[0], domainPattern };
      const list = await loadEntries();
      const key = buildDedupKey(entry);
      if (list.some((e) => buildDedupKey(e) === key)) {
        setQrAddStatus('该密钥已存在，未添加重复条目', 'error');
        return;
      }
      list.push(entry);
      await saveEntries(list);
      currentPage = totalPages(list.length);
      renderTable(list);
      qrAddDialog.close();
    } catch (err) {
      setQrAddStatus(err && err.message ? err.message : '识别失败', 'error');
    }
  });

  openImportDialogBtn.addEventListener('click', () => {
    importDialog.showModal();
  });
  importCloseBtn.addEventListener('click', () => importDialog.close());

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
      clampPage(next.length);
      renderTable(next);
      setImportStatus('已撤销最近一次导入，共移除 ' + (entries.length - next.length) + ' 条', 'success');
      lastImportedIds = [];
    } catch (err) {
      setImportStatus(err && err.message ? err.message : '撤销失败', 'error');
    }
  });

  pagePrevEl.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable(cachedEntries);
    }
  });
  pageNextEl.addEventListener('click', () => {
    if (currentPage < totalPages(cachedEntries.length)) {
      currentPage += 1;
      renderTable(cachedEntries);
    }
  });

  loadEntries().then((entries) => {
    renderTable(entries);
  });
})();
