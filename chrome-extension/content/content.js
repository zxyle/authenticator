/**
 * Content script：检测 OTP 输入框、接收 Popup 的填充消息并写入
 */
(function () {
  const STORAGE_KEYS = { TOTP_ENTRIES: 'totpEntries' };

  function getOtpInputs() {
    const inputs = [];
    const oneTimeCode = document.querySelectorAll('input[autocomplete="one-time-code"]');
    oneTimeCode.forEach((el) => inputs.push(el));
    const candidates = document.querySelectorAll('input[type="text"], input[type="tel"], input:not([type])');
    const keywords =
      /otp|验证|code|totp|mfa|动态码|验证码|一次性|one-time|one_time|2fa|two.factor|google|verification|authenticator|passcode|pin|googlecode/i;
    candidates.forEach((el) => {
      if (inputs.indexOf(el) >= 0) return;
      const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
      const name = (el.getAttribute('name') || '').toLowerCase();
      const id = (el.getAttribute('id') || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const label = (el.getAttribute('data-label') || '').toLowerCase();
      const text = [placeholder, name, id, ariaLabel, label].join(' ');
      if (keywords.test(text)) inputs.push(el);
    });
    return inputs;
  }

  function fillInput(input, token) {
    if (!input || !token) return;
    input.focus();
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (proto && proto.set) {
      proto.set.call(input, token);
    } else {
      input.value = token;
    }
    try {
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: token, inputType: 'insertText' }));
    } catch (_) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function domainMatches(pattern, host) {
    if (!pattern) return false;
    const re = pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^.]*');
    return new RegExp('^' + re + '$', 'i').test(host);
  }

  function getEntriesForHost(entries, host) {
    const withPattern = entries.filter((e) => (e.domainPattern || '').trim());
    const withoutPattern = entries.filter((e) => !(e.domainPattern || '').trim());
    const matched = withPattern.filter((e) => domainMatches((e.domainPattern || '').trim(), host));
    // 规则：优先使用明确配置了域名且匹配的条目；没有命中时再回退到未配置域名的通用条目。
    if (matched.length) return matched;
    return withoutPattern;
  }

  const INJECTED_ATTR = 'data-totp-autofill-injected';

  function injectFillButtons() {
    const inputs = getOtpInputs();
    const host = window.location.hostname;
    chrome.storage.local.get([STORAGE_KEYS.TOTP_ENTRIES], (data) => {
      const entries = data[STORAGE_KEYS.TOTP_ENTRIES] || [];
      const forHost = getEntriesForHost(entries, host);
      inputs.forEach((input) => {
        if (input.getAttribute(INJECTED_ATTR)) return;
        input.setAttribute(INJECTED_ATTR, '1');
        const wrap = document.createElement('span');
        wrap.className = 'totp-autofill-wrap';
        wrap.style.cssText =
          'display:inline-flex;align-items:center;gap:6px;margin-left:6px;vertical-align:middle;';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'totp-autofill-btn';
        btn.textContent = forHost.length ? '用 Authenticator 填充' : '添加 TOTP 后填充';
        btn.style.cssText =
          'font-size:12px;padding:2px 8px;border:1px solid #1a73e8;border-radius:4px;background:#1a73e8;color:#fff;cursor:pointer;';
        btn.onmouseover = () => (btn.style.background = '#1765cc');
        btn.onmouseout = () => (btn.style.background = '#1a73e8');
        wrap.appendChild(btn);
        if (input.parentNode) {
          input.parentNode.insertBefore(wrap, input.nextSibling);
        }

        btn.addEventListener('click', () => {
          chrome.storage.local.get([STORAGE_KEYS.TOTP_ENTRIES], (d) => {
            const list = d[STORAGE_KEYS.TOTP_ENTRIES] || [];
            const forHostAgain = getEntriesForHost(list, host);
            if (!forHostAgain.length) {
              alert('请先在扩展选项中添加该站点的 TOTP 条目。');
              return;
            }
            if (forHostAgain.length === 1) {
              TOTP.getToken(forHostAgain[0].secret).then((token) => fillInput(input, token));
              return;
            }
            const picker = document.createElement('div');
            picker.className = 'totp-autofill-picker';
            picker.style.cssText =
              'position:absolute;z-index:2147483647;background:#fff;border:1px solid #dadce0;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.15);padding:6px 0;min-width:160px;';
            forHostAgain.forEach((entry) => {
              const opt = document.createElement('div');
              opt.style.cssText = 'padding:6px 12px;cursor:pointer;font-size:13px;';
              opt.textContent = entry.label || entry.issuer || '未命名';
              opt.onmouseover = () => (opt.style.background = '#f1f3f4');
              opt.onmouseout = () => (opt.style.background = '');
              opt.onclick = () => {
                TOTP.getToken(entry.secret).then((token) => fillInput(input, token));
                picker.remove();
              };
              picker.appendChild(opt);
            });
            document.body.appendChild(picker);
            const rect = btn.getBoundingClientRect();
            picker.style.top = rect.bottom + window.scrollY + 4 + 'px';
            picker.style.left = rect.left + window.scrollX + 'px';
            const close = () => picker.remove();
            setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
          });
        });
      });
    });
  }

  function scheduleInjectFillButtons() {
    if (scheduleInjectFillButtons._t) clearTimeout(scheduleInjectFillButtons._t);
    scheduleInjectFillButtons._t = setTimeout(() => {
      scheduleInjectFillButtons._t = null;
      injectFillButtons();
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectFillButtons();
      scheduleInjectFillButtons();
    });
  } else {
    injectFillButtons();
    scheduleInjectFillButtons();
  }

  const obsRoot = document.documentElement;
  if (obsRoot) {
    const mo = new MutationObserver(() => scheduleInjectFillButtons());
    mo.observe(obsRoot, { childList: true, subtree: true });
  }

  let spaPolls = 0;
  const spaTimer = setInterval(() => {
    injectFillButtons();
    if (++spaPolls >= 30) clearInterval(spaTimer);
  }, 1000);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'FILL_OTP') {
      const inputs = getOtpInputs();
      if (inputs.length) fillInput(inputs[0], message.token);
      sendResponse({ ok: true, filled: inputs.length > 0 });
      return;
    }
    if (message.type === 'FILL_OTP_FROM_CONTEXT') {
      const inputs = getOtpInputs();
      if (!inputs.length) {
        sendResponse({ ok: true, filled: false });
        return;
      }
      chrome.storage.local.get([STORAGE_KEYS.TOTP_ENTRIES], (data) => {
        const entries = data[STORAGE_KEYS.TOTP_ENTRIES] || [];
        const host = window.location.hostname;
        const forHost = getEntriesForHost(entries, host);
        const entry = forHost[0];
        if (!entry) {
          sendResponse({ ok: true, filled: false });
          return;
        }
        TOTP.getToken(entry.secret).then((token) => {
          fillInput(inputs[0], token);
          sendResponse({ ok: true, filled: true });
        });
      });
      return true;
    }
    sendResponse({ ok: false });
  });
})();
