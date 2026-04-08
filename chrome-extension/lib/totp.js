/**
 * TOTP generation (pure JS, uses crypto.subtle; suitable for Chrome extensions).
 * RFC 6238, 30-second step, 6-digit codes.
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
   * Compute the current TOTP (six-digit string).
   * @param {string} secret - Base32-encoded shared secret
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
   * Seconds remaining in the current 30-second window (1–30).
   * @returns {number}
   */
  function getRemainingSeconds() {
    const elapsed = Math.floor(Date.now() / 1000) % 30;
    return elapsed === 0 ? 30 : 30 - elapsed;
  }

  return { getToken, getRemainingSeconds };
})();

// Expose on window when loaded via <script> in popup/options.
if (typeof window !== 'undefined') {
  window.TOTP = TOTP;
}
// Expose on self when loaded via importScripts in service worker / content script.
if (typeof self !== 'undefined' && typeof self.TOTP === 'undefined') {
  self.TOTP = TOTP;
}
