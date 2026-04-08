/**
 * Service worker: context menu, message forwarding (reserved)
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'fillOtp',
      title: chrome.i18n.getMessage('contextMenuFillTotp'),
      contexts: ['editable'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'fillOtp' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'FILL_OTP_FROM_CONTEXT' });
  }
});
