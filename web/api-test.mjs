import crypto from 'node:crypto';

const KEY = Buffer.from('8EA4DB2CC1EB3DC5');
const IV = Buffer.from('7DC5EB3BB4DB6EA8');
const SCKEY = '645fbc1e56e23365f2f3c204ae0899f6';

function encrypt(data) {
  const cipher = crypto.createCipheriv('aes-128-cbc', KEY, IV);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const b64 = encrypted.toString('base64');
  return Buffer.from(b64).toString('hex').toUpperCase();
}

function decodeLayers(enc) {
  return Buffer.from(Buffer.from(enc, 'hex').toString('utf8'), 'base64');
}

function decode(enc) {
  if (enc.includes('#')) enc = enc.split('#')[1];
  const decipher = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
  const decrypted = Buffer.concat([decipher.update(decodeLayers(enc)), decipher.final()]);
  const text = decrypted.toString('utf8');
  try { return JSON.parse(text); } catch { return text; }
}

function hash(data) {
  return crypto.createHash('md5').update(data + SCKEY).digest('hex').toUpperCase();
}

function build(data) {
  return `${hash(data)}#${encrypt(data)}`;
}

const BASE_URL = 'https://enquiry.indianrail.gov.in/crisns/AppServAnd';

async function test(method, payload) {
  const encrypted = build(payload);
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'charset': 'utf-8', 'User-Agent': 'Dalvik/2.1.0 (Linux; Android 11)' },
    body: JSON.stringify({ jsonIn: encrypted }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('empty response');
  const data = JSON.parse(text);
  if (!data.jsonIn) throw new Error('missing jsonIn');
  const decoded = decode(data.jsonIn);
  const errorMsg = decoded?.AlertMsg || decoded?.alertMsg || decoded?.AlertMsgHindi || decoded?.alertMsgHindi;
  if (errorMsg) throw new Error(errorMsg);
  return decoded;
}

const trainNo = '02563';
const date = '15-Jun-2026';

const tests = [
  { name: 'search', payload: `service=TrainRunningMob&subService=FindTrainJson&trainNo=${trainNo}` },
  { name: 'trainInfo', payload: `service=TrainRunningMob&subService=GetTrainInstance&trainNo=${trainNo}` },
  { name: 'schedule', payload: `service=TrainRunningMob&subService=GetTrainSchedule&trainNo=${trainNo}&startDate=${date}` },
  { name: 'liveStatus', payload: `service=TrainRunningMob&subService=ShowFullRunJson&trainNo=${trainNo}&startDate=${date}` },
  { name: 'exceptions', payload: `service=TrainRunningMob&subService=TrainExcpInfo&trainNo=${trainNo}` },
  { name: 'stationLive', payload: `service=TrainRunningMob&subService=TrainsAtStationJson&jStation=NDLS&nHr=2&jToStation=` },
  { name: 'trainsBetween', payload: `service=TrainRunningMob&subService=TrainBtwStnJson&stnFrom=NDLS&stnTo=BCT&trainType=XXX` },
];

for (const t of tests) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`>> ${t.name} <<`);
  console.log(`${'='.repeat(60)}`);
  try {
    const data = await test(t.name, t.payload);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}
