/**
 * Service Worker：预留消息转发、右键菜单等
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fillOtp',
    title: '用 Authenticator 填充 TOTP',
    contexts: ['editable'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fillOtp' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'FILL_OTP_FROM_CONTEXT' });
  }
});
