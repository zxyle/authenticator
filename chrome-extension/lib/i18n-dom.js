/**
 * Apply chrome.i18n to elements marked with data-i18n, data-i18n-html, data-i18n-title, data-i18n-placeholder.
 * @param {ParentNode} [root=document]
 */
function applyI18nAttributes(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.textContent = msg;
  });
  scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.innerHTML = msg;
  });
  scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.title = msg;
  });
  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.placeholder = msg;
  });
  scope.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (!key) return;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.setAttribute('aria-label', msg);
  });
}
