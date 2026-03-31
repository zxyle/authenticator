(function () {
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function toBase32(bytes) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  function base64ToBytes(base64Text) {
    const normalized = base64Text.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const raw = atob(padded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function bytesToString(bytes) {
    return new TextDecoder().decode(bytes);
  }

  function readVarint(bytes, start) {
    let shift = 0;
    let value = 0;
    let index = start;
    while (index < bytes.length) {
      const b = bytes[index++];
      value |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return { value, next: index };
      shift += 7;
      if (shift > 35) throw new Error('VARINT 过长，无法解析');
    }
    throw new Error('VARINT 提前结束');
  }

  function readLengthDelimited(bytes, start) {
    const lenInfo = readVarint(bytes, start);
    const begin = lenInfo.next;
    const end = begin + lenInfo.value;
    if (end > bytes.length) throw new Error('Length-delimited 字段越界');
    return { value: bytes.slice(begin, end), next: end };
  }

  function skipField(bytes, wireType, start) {
    if (wireType === 0) return readVarint(bytes, start).next;
    if (wireType === 2) return readLengthDelimited(bytes, start).next;
    throw new Error('不支持的 protobuf wire type: ' + wireType);
  }

  function parseOtpParameters(bytes) {
    const result = {
      secretBytes: new Uint8Array(0),
      name: '',
      issuer: '',
      algorithm: 0,
      digits: 0,
      type: 0,
      counter: 0,
    };
    let index = 0;
    while (index < bytes.length) {
      const keyInfo = readVarint(bytes, index);
      index = keyInfo.next;
      const field = keyInfo.value >>> 3;
      const wireType = keyInfo.value & 0x7;
      if (field === 1 && wireType === 2) {
        const s = readLengthDelimited(bytes, index);
        result.secretBytes = s.value;
        index = s.next;
        continue;
      }
      if (field === 2 && wireType === 2) {
        const s = readLengthDelimited(bytes, index);
        result.name = bytesToString(s.value);
        index = s.next;
        continue;
      }
      if (field === 3 && wireType === 2) {
        const s = readLengthDelimited(bytes, index);
        result.issuer = bytesToString(s.value);
        index = s.next;
        continue;
      }
      if (field === 4 && wireType === 0) {
        const v = readVarint(bytes, index);
        result.algorithm = v.value;
        index = v.next;
        continue;
      }
      if (field === 5 && wireType === 0) {
        const v = readVarint(bytes, index);
        result.digits = v.value;
        index = v.next;
        continue;
      }
      if (field === 6 && wireType === 0) {
        const v = readVarint(bytes, index);
        result.type = v.value;
        index = v.next;
        continue;
      }
      if (field === 7 && wireType === 0) {
        const v = readVarint(bytes, index);
        result.counter = v.value;
        index = v.next;
        continue;
      }
      index = skipField(bytes, wireType, index);
    }
    return result;
  }

  function parseMigrationPayload(bytes) {
    const payload = {
      otpParameters: [],
      version: 0,
      batchSize: 0,
      batchIndex: 0,
      batchId: 0,
    };
    let index = 0;
    while (index < bytes.length) {
      const keyInfo = readVarint(bytes, index);
      index = keyInfo.next;
      const field = keyInfo.value >>> 3;
      const wireType = keyInfo.value & 0x7;
      if (field === 1 && wireType === 2) {
        const nested = readLengthDelimited(bytes, index);
        payload.otpParameters.push(parseOtpParameters(nested.value));
        index = nested.next;
        continue;
      }
      if (field === 2 && wireType === 0) {
        const v = readVarint(bytes, index);
        payload.version = v.value;
        index = v.next;
        continue;
      }
      if (field === 3 && wireType === 0) {
        const v = readVarint(bytes, index);
        payload.batchSize = v.value;
        index = v.next;
        continue;
      }
      if (field === 4 && wireType === 0) {
        const v = readVarint(bytes, index);
        payload.batchIndex = v.value;
        index = v.next;
        continue;
      }
      if (field === 5 && wireType === 0) {
        const v = readVarint(bytes, index);
        payload.batchId = v.value;
        index = v.next;
        continue;
      }
      index = skipField(bytes, wireType, index);
    }
    return payload;
  }

  /** 展示名称：issuer 与 protobuf name 拼接（与 Google 导出字段一致） */
  function formatImportDisplayLabel(issuer, name) {
    const i = (issuer || '').trim();
    const n = (name || '').trim();
    if (i && n) return i + ':' + n;
    return i || n || '未命名';
  }

  function toEntry(otp, nowMs) {
    const secret = toBase32(otp.secretBytes);
    if (!secret) return null;
    const issuer = (otp.issuer || '').trim();
    const label = formatImportDisplayLabel(otp.issuer, otp.name);
    return {
      id: 'id_' + nowMs + '_' + Math.random().toString(36).slice(2, 9),
      label: label || undefined,
      issuer: issuer || undefined,
      secret,
      source: 'ga-import',
      importMeta: {
        type: otp.type || 0,
        algorithm: otp.algorithm || 0,
        digits: otp.digits || 0,
      },
    };
  }

  function decodeFromMigrationUri(uriText) {
    if (!uriText || typeof uriText !== 'string') throw new Error('二维码内容为空');
    const trimmed = uriText.trim();
    if (!trimmed.startsWith('otpauth-migration://offline?')) {
      throw new Error('二维码不是 Google Authenticator 导出链接');
    }
    const url = new URL(trimmed);
    const data = url.searchParams.get('data');
    if (!data) throw new Error('未找到 migration data 参数');
    const payload = parseMigrationPayload(base64ToBytes(data));
    const nowMs = Date.now();
    const entries = payload.otpParameters.map((otp) => toEntry(otp, nowMs)).filter(Boolean);
    if (!entries.length) throw new Error('未解析到可用 TOTP 条目');
    return {
      entries,
      meta: {
        version: payload.version,
        batchSize: payload.batchSize,
        batchIndex: payload.batchIndex,
        batchId: payload.batchId,
      },
    };
  }

  async function readQrTextFromFile(file) {
    if (!file) throw new Error('请先选择二维码图片');
    if (typeof BarcodeDetector === 'undefined') {
      throw new Error('当前浏览器不支持 BarcodeDetector，建议升级 Chrome 后重试');
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const bitmap = await createImageBitmap(file);
    const barcodes = await detector.detect(bitmap);
    if (!barcodes || !barcodes.length) {
      throw new Error('未识别到二维码，请更换更清晰的图片');
    }
    const rawValue = barcodes[0].rawValue || '';
    if (!rawValue.trim()) throw new Error('二维码内容为空');
    return rawValue;
  }

  async function decodeFromImageFile(file) {
    const rawValue = await readQrTextFromFile(file);
    return decodeFromMigrationUri(rawValue);
  }

  window.GoogleAuthImport = {
    decodeFromImageFile,
    decodeFromMigrationUri,
  };
})();
