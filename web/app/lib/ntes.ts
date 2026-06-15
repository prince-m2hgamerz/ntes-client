import { build, decode } from './crypto';

const BASE_URL = 'https://enquiry.indianrail.gov.in/crisns/AppServAnd';

export async function ntesRequest(payload: string): Promise<any> {
  const encrypted = build(payload);

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'charset': 'utf-8',
      'User-Agent': 'Dalvik/2.1.0 (Linux; Android 11)',
    },
    body: JSON.stringify({ jsonIn: encrypted }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  if (!text.trim()) throw new Error('empty response');

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('invalid json response');
  }

  if (!data.jsonIn) throw new Error('missing jsonIn in response');

  const decoded = decode(data.jsonIn);

  return decoded;
}

export interface Params {
  search: { query: string };
  trainInfo: { trainNo: string };
  schedule: { trainNo: string; startDate?: string };
  stationLive: { stationCode: string; hours?: number };
  trainsBetween: { fromStation: string; toStation: string; trainType?: string };
  liveStatus: { trainNo: string; startDate: string };
  exceptions: { trainNo: string };
  pnr: { pnr: string };
}

export type Method = keyof Params;

export function buildPayload(method: Method, p: Params[Method]): string {
  switch (method) {
    case 'search':
      return `service=TrainRunningMob&subService=FindTrainJson&trainNo=${(p as Params['search']).query}`;
    case 'trainInfo':
      return `service=TrainRunningMob&subService=GetTrainInstance&trainNo=${(p as Params['trainInfo']).trainNo}`;
    case 'schedule':
      return `service=TrainRunningMob&subService=GetTrainSchedule&trainNo=${(p as Params['schedule']).trainNo}&startDate=${(p as Params['schedule']).startDate || ''}`;
    case 'stationLive':
      return `service=TrainRunningMob&subService=TrainsAtStationJson&jStation=${(p as Params['stationLive']).stationCode}&nHr=${(p as Params['stationLive']).hours || 2}&jToStation=`;
    case 'trainsBetween':
      return `service=TrainRunningMob&subService=TrainBtwStnJson&stnFrom=${(p as Params['trainsBetween']).fromStation}&stnTo=${(p as Params['trainsBetween']).toStation}&trainType=${(p as Params['trainsBetween']).trainType || 'XXX'}`;
    case 'liveStatus':
      return `service=TrainRunningMob&subService=ShowFullRunJson&trainNo=${(p as Params['liveStatus']).trainNo}&startDate=${(p as Params['liveStatus']).startDate}`;
    case 'exceptions':
      return `service=TrainRunningMob&subService=TrainExcpInfo&trainNo=${(p as Params['exceptions']).trainNo}`;
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
