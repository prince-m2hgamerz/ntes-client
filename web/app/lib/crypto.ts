import crypto from 'node:crypto';

const KEY = Buffer.from('8EA4DB2CC1EB3DC5');
const IV = Buffer.from('7DC5EB3BB4DB6EA8');
const SCKEY = '645fbc1e56e23365f2f3c204ae0899f6';

export function encrypt(data: string): string {
  const cipher = crypto.createCipheriv('aes-128-cbc', KEY, IV);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const b64 = encrypted.toString('base64');
  return Buffer.from(b64).toString('hex').toUpperCase();
}

function decodeLayers(enc: string): Buffer {
  return Buffer.from(Buffer.from(enc, 'hex').toString('utf8'), 'base64');
}

export function decode(enc: string): any {
  if (enc.includes('#')) {
    enc = enc.split('#')[1];
  }
  const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
  const decrypted = Buffer.concat([decipher.update(decodeLayers(enc)), decipher.final()]);
  const text = decrypted.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function hash(data: string): string {
  return crypto.createHash('md5').update(data + SCKEY).digest('hex').toUpperCase();
}

export function build(data: string): string {
  return `${hash(data)}#${encrypt(data)}`;
}
