import { writeFile } from 'node:fs/promises';

const authKey = process.env.KMA_AUTH_KEY;
if (!authKey) throw new Error('KMA_AUTH_KEY secret is not configured.');

const url = new URL('https://apihub.kma.go.kr/api/typ01/url/sea_obs.php');
url.searchParams.set('stn', '0');
url.searchParams.set('help', '1');
url.searchParams.set('authKey', authKey);

const response = await fetch(url, {
  headers: {
    'User-Agent': 'Busan-Beach-School-Project/1.0',
    'Referer': 'https://apihub.kma.go.kr/'
  }
});
const source = await response.text();
if (!response.ok) throw new Error(`KMA request failed: ${response.status}`);
if (/ERROR|인증|AUTH/i.test(source)) throw new Error('KMA returned an authentication or service error.');

const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const headerLine = lines.find(line => /\bTM\b/.test(line) && /\b(STN|STN_ID)\b/.test(line) && /\b(WH|WH_SIG)\b/.test(line));
if (!headerLine) throw new Error('Could not find a KMA observation header in the response.');

const fields = headerLine.replace(/^#+\s*/, '').trim().split(/\s+/);
const start = lines.indexOf(headerLine) + 1;
const rows = [];
for (const line of lines.slice(start)) {
  if (line.startsWith('#')) continue;
  const values = line.split(/\s+/);
  if (values.length < fields.length || !/^\d{10,12}$/.test(values[0])) continue;
  rows.push(Object.fromEntries(fields.map((field, index) => [field, values[index] ?? null])));
}
if (!rows.length) throw new Error('KMA response contained no usable observation rows.');

await writeFile('data/kma-marine.json', JSON.stringify({
  fetchedAt: new Date().toISOString(),
  source: 'KMA API Hub sea_obs.php',
  rows
}, null, 2) + '\n');

console.log(`Saved ${rows.length} KMA observation rows.`);
