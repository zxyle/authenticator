/**
 * TOTP 生成（纯 JS，依赖 crypto.subtle，适用于 Chrome 扩展）
 * 基于 RFC 6238，30 秒窗口，6 位数字
 */
const TOTP = (function () {
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Decode(str) {
    str = str.replace(/\s/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const output = [];
    for (let i = 0; i < str.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(str[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(output);
  }

  function uint8ToArrayBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  /**
   * 生成当前 TOTP 码（6 位数字字符串）
   * @param {string} secret - Base32 编码的密钥
   * @returns {Promise<string>}
   */
  async function getToken(secret) {
    const keyBytes = base32Decode(secret);
    const keyBuffer = uint8ToArrayBuffer(keyBytes);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setUint32(4, counter, false);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
    const sigArray = new Uint8Array(signature);
    const offset = sigArray[sigArray.length - 1] & 0x0f;
    const code =
      ((sigArray[offset] & 0x7f) << 24) |
      (sigArray[offset + 1] << 16) |
      (sigArray[offset + 2] << 8) |
      sigArray[offset + 3];
    const token = (code % 1000000).toString().padStart(6, '0');
    return token;
  }

  /**
   * 当前 30 秒窗口剩余秒数（1–30）
   * @returns {number}
   */
  function getRemainingSeconds() {
    const elapsed = Math.floor(Date.now() / 1000) % 30;
    return elapsed === 0 ? 30 : 30 - elapsed;
  }

  return { getToken, getRemainingSeconds };
})();

// 兼容在 popup/options 中通过 script 引入（挂到 window）
if (typeof window !== 'undefined') {
  window.TOTP = TOTP;
}
// Service Worker / content 中通过 importScripts 时挂到 self
if (typeof self !== 'undefined' && typeof self.TOTP === 'undefined') {
  self.TOTP = TOTP;
}
