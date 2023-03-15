import {load} from 'npm:cheerio@1.0.0-rc.12';

async function scrape(url: string){
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  const kv: [string, string][] = $('main li').toArray().map((el) => [
    $(el).find('span:first-of-type').text(),
    $(el).find('span:last-of-type').text(),
  ])
  return new Map(kv);
}

const year = new Date().getUTCFullYear();
const date = new Date().toISOString();

const [ado, nordnes] = await Promise.all([
  scrape('https://adoarena.no/sanntid/'),
  scrape('https://nordnessjobad.no/sanntid/'),
]);

await Promise.all([
  Deno.mkdir('data/ado/', {recursive: true}),
  Deno.mkdir('data/nordnes/', {recursive: true}),
]);

await(Promise.all([
  writeResult(`data/ado/${year}.tsv`, [
    ['date', date],
    ['visitors_now', num(ado.get('Besøkende nå'))],
    ['visitors_today', num(ado.get('Besøkende i dag'))],
    ['visitors_ytd', num(ado.get('Besøkende i år'))],
    ['temp_main', temperature(ado.get('Hovedbasseng'))],
    ['temp_dive', temperature(ado.get('Stupebasseng'))],
    ['temp_hot_tub', temperature(ado.get('Kulp'))],
    ['temp_kids', temperature(ado.get('Barnebasseng'))],
    ['temp_teaching', temperature(ado.get('Opplæringsbasseng'))],
    ['temp_slides', temperature(ado.get('Vannsklier'))],
  ]),

  writeResult(`data/nordnes/${year}.tsv`, [
    ['date', date],
    ['visitors_now', num(nordnes.get('Besøkende nå'))],
    ['visitors_today', num(nordnes.get('Besøkende i dag'))],
    ['visitors_ytd', num(nordnes.get('Besøkende i år'))],
    ['temp_air', temperature(nordnes.get('Utetemperatur'))],
    ['temp_pool', temperature(nordnes.get('Hovedbasseng'))],
    ['temp_sea', temperature(nordnes.get('Sjøvann'))],
  ]),
]))

async function writeResult(path: string, kv: [string, string | undefined][]) {
  const rows = toRows(new Map(kv), !(await exists(path)));
  const tsv = toTsv(rows);
  await Deno.writeTextFile(path, tsv, {append: true});
}

async function exists(path: string | URL): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.size > 0;
  } catch (err) {
    if (err.name !== 'NotFound') throw err;
    return false;
  }
}

function toRows(map: Map<string | undefined, string | undefined>, includeHeaders = false): (string | undefined)[][] {
  const out = [
    [...map.values()],
  ];
  if (includeHeaders) {
    out.unshift([...map.keys()]);
  }
  return out;
}

function toTsv(rows: (string | undefined)[][]) {
  return rows.map(row => row.join('\t')).join('\n') + '\n';
}

function temperature(val: string | undefined): string | undefined {
  if (val === undefined) return val;
  return val.replace('°C', '').trim().replace(',', '.');
}

function num(val: string | undefined): string | undefined {
  if (val === undefined) return val;
  if (val === '-') return '0';

  let factor = 1;
  if (val.toLowerCase().endsWith('k')) factor = 1000;
  else if (val.toLowerCase().endsWith('m')) factor = 1e6;
  const n = parseFloat(val.replace(',', '.'));
  return (n * factor).toString();
}