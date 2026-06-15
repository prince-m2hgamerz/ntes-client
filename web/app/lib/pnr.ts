import { PNG } from 'pngjs';

const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const KNOWN_TEMPLATES: Record<string, string> = {
  "111111111111111111000000111000000110000000110000001100000001100000011000000011000000110000000110000001110000": "7",
  "0000110000000011000000001100000000110000111111111111111111110000110000000011000000001100000000110000": "+",
  "011111001111111010000111000000110000001100000111000011100001110000111000011100001111111111111111": "2",
  "001111100011111110011000110110000011110000011110000011110000011110000011110000011011000110011111110001111100": "0",
  "111111111111111111110000000000000000000011111111111111111111": "=",
  "011111011111111000011000001100001110001110001110000110000000000001100000110000011000": "?",
  "000111100011111110011000010110000000111111100111111110111000111110000011110000011011000111011111110001111100": "6",
  "011111110111111111110000011110000011011111110011111110111000111110000011110000011111000111011111110001111100": "8",
  "1111111111": "-",
  "011111100111111111100000011000000011001111110001111110000000111000000011000000011100000111111111110011111100": "3",
  "011110001111100011011000000110000001100000011000000110000001100000011000000110001111111111111111": "1",
  "000011110000001111000001101100001110110000110011000111001100011000110011000011001111111111111111111100000011000000001100": "4",
  "001111100011111110111000110110000011110000011111000111011111111001111111000000011010000110011111110001111000": "9",
  "111111110111111110110000000110000000111111100111111110100000111000000011000000011100000111111111110011111100": "5",
};

function otsuThreshold(grayValues: number[], bins = 256): number {
  const hist = new Uint32Array(bins);
  const total = grayValues.length;
  let sumTotal = 0;
  for (let i = 0; i < total; i++) {
    const v = Math.round(grayValues[i]);
    if (v >= 0 && v < bins) {
      hist[v]++;
      sumTotal += v;
    }
  }
  let sumB = 0, wB = 0, maxVar = 0, threshold = 0;
  for (let t = 0; t < bins; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumTotal - sumB) / wF;
    const diff = mB - mF;
    const variance = wB * wF * diff * diff;
    if (variance > maxVar) { maxVar = variance; threshold = t; }
  }
  return threshold;
}

function removeIsolatedPixels(mat: number[][], threshold = 1): number[][] {
  const h = mat.length, w = mat[0].length;
  const result = mat.map(r => [...r]);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mat[y][x] === 0) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (!(dy === 0 && dx === 0) && mat[y + dy][x + dx] > 0) count++;
      if (count <= threshold) result[y][x] = 0;
    }
  }
  return result;
}

function parseImage(buffer: Buffer): number[][] {
  const img = PNG.sync.read(buffer);
  const { width, height, data } = img;
  const grayValues: number[] = [];
  const matrix: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const gray = (r + g + b) / 3;
      grayValues.push(gray);
      const pixel = gray < 128 ? 1 : 0;
      row.push(pixel);
    }
    matrix.push(row);
  }

  const cleaned = removeIsolatedPixels(matrix);
  return cleaned;
}

function parseImageWithThresholds(buffer: Buffer): number[][][] {
  const img = PNG.sync.read(buffer);
  const { width, height, data } = img;

  const grayValues: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grayValues.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }

  const otsu = otsuThreshold(grayValues);
  const thresholds = [otsu, 128, 200];

  return thresholds.map(threshold => {
    const matrix: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x);
        const gray = grayValues[idx];
        const pixel = gray < threshold ? 1 : 0;
        row.push(pixel);
      }
      matrix.push(row);
    }
    return removeIsolatedPixels(matrix);
  });
}

function trimEmptyRows(mat: number[][]): number[][] {
  if (!mat.length) return [];
  let top = 0, bottom = mat.length - 1;
  while (top < mat.length && mat[top].reduce((a, b) => a + b, 0) === 0) top++;
  while (bottom >= 0 && mat[bottom].reduce((a, b) => a + b, 0) === 0) bottom--;
  return top <= bottom ? mat.slice(top, bottom + 1) : [];
}

function trimEmptyCols(mat: number[][]): number[][] {
  if (!mat.length || !mat[0].length) return [];
  const h = mat.length, w = mat[0].length;
  let left = 0, right = w - 1;
  while (left < w) {
    let empty = true;
    for (let y = 0; y < h; y++) { if (mat[y][left] > 0) { empty = false; break; } }
    if (!empty) break;
    left++;
  }
  while (right >= left) {
    let empty = true;
    for (let y = 0; y < h; y++) { if (mat[y][right] > 0) { empty = false; break; } }
    if (!empty) break;
    right--;
  }
  if (left > right) return [];
  return mat.map(row => row.slice(left, right + 1));
}

function matrixToString(mat: number[][]): string {
  return mat.map(row => row.join('')).join('');
}

function extractChars(matrix: number[][], minColSum = 2): number[][][] {
  const height = matrix.length;
  const width = matrix[0].length;

  const colSums: number[] = [];
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += matrix[y][x];
    colSums.push(sum);
  }

  const chars: number[][][] = [];
  let inChar = false;
  let startX = 0;

  for (let x = 0; x < width; x++) {
    if (colSums[x] >= minColSum && !inChar) {
      inChar = true;
      startX = x;
    } else if (colSums[x] < minColSum && inChar) {
      inChar = false;
      const charMat = matrix.map(row => row.slice(startX, x));
      const trimmed = trimEmptyRows(charMat);
      const trimmedCols = trimEmptyCols(trimmed);
      if (trimmedCols.length && trimmedCols[0].length) chars.push(trimmedCols);
    }
  }
  if (inChar) {
    const charMat = matrix.map(row => row.slice(startX, width));
    const trimmed = trimEmptyRows(charMat);
    const trimmedCols = trimEmptyCols(trimmed);
    if (trimmedCols.length && trimmedCols[0].length) chars.push(trimmedCols);
  }

  return chars;
}

function solveCaptcha(matrix: number[][]): { success: boolean; answer?: number; text?: string; error?: string } {
  const height = matrix.length;
  const width = matrix[0].length;
  if (height === 0 || width === 0) return { success: false, error: 'empty matrix' };

  const chars = extractChars(matrix);
  if (!chars.length) return { success: false, error: 'no characters found' };

  let equation = '';
  for (const charMat of chars) {
    const hash = matrixToString(charMat);
    const digit = KNOWN_TEMPLATES[hash];
    if (!digit) {
      return { success: false, error: `Unknown template: ${hash}` };
    }
    equation += digit;
  }

  const clean = equation.replace(/[=?]/g, '').trim();
  let answer: number;
  if (clean.includes('+')) {
    const parts = clean.split('+');
    answer = parseInt(parts[0], 10) + parseInt(parts[1], 10);
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    answer = parseInt(parts[0], 10) - parseInt(parts[1], 10);
  } else {
    return { success: false, error: 'No math operator found' };
  }

  if (isNaN(answer)) return { success: false, error: 'Invalid equation' };

  return { success: true, answer, text: equation };
}

export async function pnrStatus(pnr: string): Promise<any> {
  const cookieJar: string[] = [];

  async function get(url: string, opts: any = {}): Promise<{ buffer?: Buffer; text?: string; json?: any; headers: Headers }> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': AGENT,
        ...(opts.headers || {}),
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookieJar.push(setCookie);

    if (opts.responseType === 'buffer') {
      return { buffer: Buffer.from(await res.arrayBuffer()), headers: res.headers };
    }
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { text, json, headers: res.headers };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await get('https://indianrail.gov.in/enquiry/CaptchaConfig', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        referer: 'https://indianrail.gov.in/enquiry/PNR/PnrEnquiry.html',
      });

      const ts = Date.now();
      const imgRes = await get(`https://indianrail.gov.in/enquiry/captchaDraw.png?${ts}`, {
        responseType: 'buffer',
        headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
        referer: 'https://indianrail.gov.in/enquiry/PNR/PnrEnquiry.html',
      });

      if (!imgRes.buffer) continue;

      const matrices = parseImageWithThresholds(imgRes.buffer);
      let answer: number | undefined;
      for (const mat of matrices) {
        const r = solveCaptcha(mat);
        if (r.success) { answer = r.answer; break; }
      }
      if (answer === undefined) continue;

      const captchaVal = String(answer);

      const commonHeaders = {
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieJar.join('; '),
      };

      const resp = await fetch(
        `https://indianrail.gov.in/enquiry/CommonCaptcha?inputCaptcha=${captchaVal}&inputPnrNo=${pnr}&inputPage=PNR&language=en`,
        {
          headers: {
            ...commonHeaders,
            'User-Agent': 'Mozilla/5.0',
            Accept: '*/*',
            Referer: 'https://indianrail.gov.in/enquiry/PNR/PnrEnquiry.html',
          },
        }
      );

      if (!resp.ok) continue;
      const respText = await resp.text();
      if (!respText.trim()) continue;

      let respData: any;
      try { respData = JSON.parse(respText); } catch { continue; }

      if (respData.errorMessage === 'Captcha not matched') continue;

      return respData;
    } catch {
      continue;
    }
  }

  throw new Error('PNR check failed after retries');
}
