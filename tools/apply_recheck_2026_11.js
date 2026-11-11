// Applies the November 2026 open-item and recheck findings to data.js, position_corrections.json and twins.json.
// Usage: node apply.js <site dir> <agents dir>
const fs = require('fs'), path = require('path');
const R = process.argv[2], AG = process.argv[3];
global.window = {}; eval(fs.readFileSync(path.join(R, 'data.js'), 'utf8'));
const Z = window.ZAG, E = Object.fromEntries(Z.entries.map(e => [e.id, e]));
const CP = path.join(R, 'tools/position_corrections.json'), C = JSON.parse(fs.readFileSync(CP, 'utf8'));
const TP = path.join(R, 'data/twins.json'), TW = JSON.parse(fs.readFileSync(TP, 'utf8')), T = TW.objects;
const log = [];
const must = (c, m) => { if (!c) throw new Error('apply: ' + m); };
const fact = (e, label, value) => { e.facts = e.facts || []; const r = e.facts.find(f => f[0] === label); if (r) r[1] = value; else e.facts.push([label, value]); };
const delFact = (e, label) => { e.facts = (e.facts || []).filter(f => f[0] !== label); };
const src = (key, o) => { must(!Z.src[key], 'source key exists ' + key); Z.src[key] = Object.assign({ k: 'web', a: null, y: null, t: null, c: null, d: null, doi: null, u: null }, o); };
const addSrc = (e, ...keys) => { for (const k of keys) { must(Z.src[k], 'no source ' + k); if (!e.src.includes(k)) e.src.push(k); } };
const swap = (e, field, from, to) => { must(typeof e[field] === 'string' && e[field].includes(from), e.id + '.' + field + ' lacks "' + from + '"'); e[field] = e[field].replace(from, to); };

// ---------- new sources ----------
src('zag_lp005', { k: 'report', a: 'Slovenska akreditacija', y: 2014, t: 'Priloga k akreditacijski listini LP-005, Zavod za gradbeništvo Slovenije (23 May 2014)', u: 'https://www.zag.si/wp-content/uploads/2022/03/Priloga-k-akreditacijski-listini-Preskusevalni-laboratoriji-min.pdf' });
src('eles_lokacije', { k: 'inst', a: 'ELES', t: 'Lokacije, RTP Gorica 110/20 kV', u: 'https://www.eles.si/kontakt-in-lokacije/lokacije' });
src('acroni_tlakovci', { k: 'news', a: 'SIJ Acroni', y: 2024, t: 'SIJ Acronijeva žlindra v trajnostnih tlakovcih (25 April 2024)', u: 'https://www.acroni.si/news/sij-acronijeva-zlindra-v-trajnostnih-tlakovcih' });
src('imsafe_vransko', { k: 'web', a: 'Liljefors, F. (NTNU), IM-SAFE Knowledge Base', t: 'Vransko bridge (case study)', u: 'https://imsafe.wikixl.nl/index.php/Vransko_bridge_(case_study)' });
src('arches_d15', { k: 'report', a: 'ARCHES consortium', y: 2009, t: 'ARCHES Final Activity Report, Deliverable D 15 (30 November 2009)', u: 'https://cordis.europa.eu/docs/results/31/31272/123652731-6_en.pdf' });
src('ucd_critical', { k: 'conference', a: 'González, A., OBrien, E. J., Cantero, D., Li, Y., Dowling, J. and Žnidarič, A.', t: 'Critical speed for the dynamics of truck events on bridges with a smooth road surface', u: 'https://researchrepository.ucd.ie/rest/bitstreams/4855/retrieve' });
src('zag_crna_2024', { k: 'news', a: 'Zavod za gradbeništvo Slovenije', y: 2024, t: 'ZAG bo zgradil recikliran most v Črni na Koroškem (26 April 2024)', u: 'https://www.zag.si/zag-bo-zgradil-recikliran-most-v-crni-na-koroskem/' });
src('circuit_pilot4', { k: 'web', a: 'CIRCUIT project', t: 'Pilot 4, Črna na Koroškem', u: 'https://www.circuitproject.eu/pilot-4/' });
src('visitcrna_circuit', { k: 'news', a: 'TIC Črna na Koroškem', y: 2025, t: 'Projekt CIRCUIT (1 October 2025)', u: 'https://www.visit-crna.si/dogodek/1169328' });
src('govsi_crna_2025', { k: 'news', a: 'Vlada Republike Slovenije', y: 2025, t: 'Državni sekretar na slovesnem odprtju mostu čez reko Mežo v Črni na Koroškem (7 September 2025)', u: 'https://www.gov.si/novice/2025-09-07-drzavni-sekretar-na-slovesnem-odprtju-mostu-cez-reko-mezo-v-crni-na-koroskem/' });

// ---------- Gameljne ----------
{ const e = E.zag_gameljne;
  e.loc = 'Srednje Gameljne, Ljubljana'; e.prec = 'address'; e.addr = 'Srednje Gameljne 41, 1211 Ljubljana-Šmartno';
  e.note = 'Address from the annex to accreditation certificate LP-005 of 23 May 2014, section 3.2.7. The point is the building with that address in OpenStreetMap, which carries no name there.';
  fact(e, 'Address', 'Srednje Gameljne 41, 1211 Ljubljana-Šmartno, as listed in the 2014 accreditation annex');
  addSrc(e, 'zag_lp005');
  C.zag_gameljne = { lat: 46.1299082, lon: 14.4992037, confidence: 'medium', status: 'improved', precision: 'address', addr: e.addr,
    sources: [Z.src.zag_lp005.u, 'https://www.openstreetmap.org/way/316700919'],
    note: 'Accreditation annex LP-005 (23 May 2014) lists "Požarni laboratorij in požarno inženirstvo, Srednje Gameljne 41, 1211 Ljubljana-Šmartno". OpenStreetMap way 316700919 carries that address (tagged as a residential building, no name), so the map confirms the address, not the laboratory. The old point was the settlement of Zgornje Gameljne, about 1.1 km away.' };
  log.push('zag_gameljne: address Srednje Gameljne 41, point moved about 1.1 km'); }

// ---------- RTP Gorica ----------
{ const e = E.rtp_gorica;
  e.prec = 'address'; e.addr = 'Ulica Vinka Vodopivca 13, Kromberk, 5000 Nova Gorica';
  e.note = 'ELES lists RTP Gorica 110/20 kV at Ulica Vinka Vodopivca 13. The point is the building with that address. The outline of the switchyard is not confirmed.';
  fact(e, 'Position', 'street address listed by ELES'); addSrc(e, 'eles_lokacije');
  C.rtp_gorica = { lat: 45.9589527, lon: 13.6604928, confidence: 'medium', status: 'improved', precision: 'address', addr: e.addr,
    sources: [Z.src.eles_lokacije.u, 'https://www.openstreetmap.org/way/853682719'],
    note: 'ELES locations page lists "RTP Gorica 110/20 kV, Ulica Vinka Vodopivca 13, Kromberk, 5000 Nova Gorica". OpenStreetMap way 853682719 (building named ELES) carries that address. The switchyard outline itself was not checked. The old point was the centre of Kromberk, about 620 m east.' };
  log.push('rtp_gorica: address Ulica Vinka Vodopivca 13, point moved about 620 m'); }

// ---------- SIJ Acroni ----------
{ const e = E.sij_acroni_pavers;
  e.detail += ' SIJ Acroni reported on 25 April 2024 that the bicycle area in front of the steelworks building was paved with these blocks.';
  e.note = 'SIJ Acroni places the paved bicycle area in front of the steelworks building. No source gives its exact spot, so the position stays on the plant site.';
  addSrc(e, 'acroni_tlakovci'); log.push('sij_acroni_pavers: location wording and source added'); }

// ---------- Vransko ----------
{ const e = E.vransko;
  e.loc = 'Brode, Vransko'; e.prec = 'surveyed'; e.crosses = null; e.carries = 'A1 motorway';
  e.note = 'Coordinate published in the IM-SAFE case study of the bridge. It lies on an A1 motorway bridge at Brode in OpenStreetMap. Which of the two decks carried the SiWIM system is not stated in any source.';
  swap(e, 'hist', 'The bridge near Vransko is a simply supported beam and slab structure', 'The bridge near Vransko carries the A1 motorway at Brode and has two independent superstructures, one for each travel direction. Each is a simply supported beam and slab structure');
  fact(e, 'Road', 'A1 motorway at Brode near Vransko');
  fact(e, 'Structure', 'two independent superstructures, one per travel direction, each with five precast prestressed I girders 1.4 m high and a 0.24 m deck slab');
  fact(e, 'Truck traffic', '3,300 trucks per day in one direction, as used in the ARCHES simulations');
  addSrc(e, 'imsafe_vransko', 'arches_d15', 'ucd_critical');
  const d1 = [[14.9688302, 46.2484318], [14.9686064, 46.2482456]], d2 = [[14.9687206, 46.2481811], [14.9689429, 46.2483631]];
  C.vransko = { lat: 46.248389, lon: 14.968806, confidence: 'high', status: 'improved', precision: 'surveyed',
    sources: [Z.src.imsafe_vransko.u, 'https://www.openstreetmap.org/way/202466220', 'https://www.openstreetmap.org/way/202466216'],
    note: 'IM-SAFE case study gives 46° 14\' 54.20" N, 14° 58\' 7.70" E and describes a highway bridge with two independent superstructures, one per travel direction. The point lies on OpenStreetMap way 202466220 (A1 motorway, bridge, one way, 2 lanes, about 27 m long) with the twin deck way 202466216 beside it. The old point was the settlement of Vransko, about 1.9 km west.',
    line: d1, lines: [d1, d2], line_labels: ['north-west deck', 'south-east deck'] };
  const TVN = { summary: 'A1 motorway bridge at Brode near Vransko, two independent simply supported superstructures, one per travel direction', kind: 'Bridge',
    specs: [
      { label: 'Span between supports', value: '24.8', unit: 'm', source: Z.src.ucd2009.u },
      { label: 'Total length', value: '26', unit: 'm', source: Z.src.ucd2009.u },
      { label: 'Width', value: '12', unit: 'm', source: Z.src.ucd2009.u },
      { label: 'Skew', value: 'none', unit: '', source: Z.src.ucd2009.u },
      { label: 'Girders per superstructure', value: '5 precast prestressed I girders, 1.4 m high', unit: '', source: Z.src.imsafe_vransko.u },
      { label: 'Deck slab', value: '0.24', unit: 'm', source: Z.src.imsafe_vransko.u },
      { label: 'Truck traffic, one direction', value: '3,300', unit: 'per day', source: Z.src.arches_d15.u },
      { label: 'Mapped geometry', value: 'two one way decks, about 27 m each', unit: '', source: 'https://www.openstreetmap.org/way/202466220' }],
    anchors: [
      { label: 'published coordinate', lat: 46.248389, lon: 14.968806, source: Z.src.imsafe_vransko.u },
      { label: 'deck 1 end A', lat: 46.2484318, lon: 14.9688302, source: 'https://www.openstreetmap.org/way/202466220' },
      { label: 'deck 1 end B', lat: 46.2482456, lon: 14.9686064, source: 'https://www.openstreetmap.org/way/202466220' },
      { label: 'deck 2 end A', lat: 46.2481811, lon: 14.9687206, source: 'https://www.openstreetmap.org/way/202466216' },
      { label: 'deck 2 end B', lat: 46.2483631, lon: 14.9689429, source: 'https://www.openstreetmap.org/way/202466216' }],
    differences: [
      'Traffic layout: González et al. write "a two-lane simply supported structure with traffic in opposite directions", while the IM-SAFE case study describes two independent superstructures, one for each travel direction, and OpenStreetMap maps two one way decks.',
      'Span: 25 m in the IM-SAFE case study against 24.8 m between supports and 26 m in total in O\'Brien et al.'],
    open: 'Which of the two decks carried the SiWIM system. Year of construction (González et al. call it a 10 year old bridge at the time of the 2006 measurements).' };
  { const t = T.vransko; must(t && t.specs.length >= 8, 'vransko twin');
    t.summary = 'A1 motorway bridge at Brode near Vransko with two independent simply supported beam and slab superstructures, one per travel direction. SiWIM test site from 25 September to 21 November 2006.';
    t.kind = 'Bridge'; const have = new Set(t.specs.map(x => x.label));
    for (const x of TVN.specs) if (!['Span between supports', 'Total length', 'Width', 'Skew'].includes(x.label) && !have.has(x.label)) t.specs.push(x);
    t.anchors = TVN.anchors;
    const n0 = t.differences.length; t.differences = t.differences.filter(x => !/Unsourced\.$/.test(x)); must(t.differences.length === n0 - 1, 'vransko diff');
    t.differences.push(...TVN.differences); t.open = TVN.open; }
  log.push('vransko: identified as the A1 bridge at Brode, point moved about 1.9 km, both decks drawn, twin sheet updated'); }

// ---------- Črna ----------
{ const e = E.crna;
  e.built = null; e.partners = ['Občina Črna na Koroškem']; e.years = '2024-'; e.typ = 'Reused girders from the flood damaged bridge on reinforced soil abutments, planned';
  e.detail = 'Demonstration pilot of the CIRCUIT project, planned by the Municipality of Črna na Koroškem with ZAG. A new bridge over the Meža is to reuse the girders of the bridge damaged in the August 2023 floods, with abutments of reinforced soil made from flood deposits, a modular superstructure designed for dismantling and a digitally fabricated safety railing. On 1 October 2025 the bridge was still announced as a future structure.';
  e.hist = 'ZAG reported on 26 April 2024 that the bridge will be built in cooperation between the Municipality of Črna na Koroškem and ZAG, after the CIRCUIT consortium visited the site. The local tourist office wrote on 1 October 2025 that the municipality will set up the bridge to link the buildings Center 2 to 4 with the regional road, and presented the project on the Meža bridge at Center 4 on 7 October 2025. The bridge over the Meža opened on 7 September 2025 is a different structure, since the CIRCUIT bridge was still planned after that date.';
  e.facts = [['Approach', 'reuse of the girders of the flood damaged bridge'], ['Status', 'planned, as reported on 1 October 2025'], ['Programme', 'CIRCUIT, Horizon Europe'], ['Pilot leader', 'Municipality of Črna na Koroškem'], ['Site', 'by the buildings Center 2 to 4, over the Meža']];
  e.zagn = 'Documented by ZAG. CIRCUIT lists ZAG as a support partner of the pilot.';
  e.note = 'Coordinate is the settlement centre, not the bridge. The map marker on the CIRCUIT pilot page (46.47286, 14.85117) and the address Center 4 do not clearly agree, so the exact spot is left open.';
  addSrc(e, 'zag_crna_2024', 'circuit_pilot4', 'visitcrna_circuit', 'govsi_crna_2025');
  log.push('crna: client corrected to the Municipality, status planned, built year removed'); }


// ---------- twin sheets of the records settled above ----------
{ const t = T.crna; must(t && t.differences.length === 4, 'crna twin');
  t.summary = 'Planned pilot bridge of the EU CIRCUIT project over the Meža in Črna na Koroškem, with reused girders and a reinforced soil abutment (ZAG with the Municipality of Črna na Koroškem). It is not the bridge opened on 7 September 2025, because the pilot was still announced as a future structure on 1 October 2025.';
  t.specs = t.specs.filter(x => x.label !== 'Candidate opening');
  t.specs.push({ label: 'Status', value: 'planned, the municipality "bo postavila most" (1 October 2025)', unit: '', source: Z.src.visitcrna_circuit.u });
  t.specs.push({ label: 'Site', value: 'to link the buildings Center 2 to 4 with the regional road, project presented on the Meža bridge at Center 4', unit: '', source: Z.src.visitcrna_circuit.u });
  t.specs.push({ label: 'Pilot leader', value: 'Municipality of Črna na Koroškem, support partners ZAG, Beton Lučko and InfraPlan', unit: '', source: Z.src.circuit_pilot4.u });
  t.specs.push({ label: 'Map marker on the pilot page', value: '46.47286, 14.85117', unit: '', source: Z.src.circuit_pilot4.u });
  t.differences = [t.differences[3],
    'Site: the map marker on the CIRCUIT pilot page (46.47286, 14.85117) lies about 350 m from the street Center in OpenStreetMap, while the tourist office places the bridge by the buildings Center 2 to 4.',
    'Girders: ZAG wrote in April 2024 that the girders of the flood damaged bridge will be reused, while the 2024 ZAG book speaks of girders recovered from a bridge for demolition.'];
  t.open = 'the exact site of the bridge and whether it has been built since October 2025.'; }
{ const t = T.rtp_gorica; const n0 = t.differences.length; t.differences = t.differences.filter(x => !/Kromberk/.test(x)); must(t.differences.length === n0 - 1, 'rtp twin');
  t.specs.push({ label: 'Address', value: 'Ulica Vinka Vodopivca 13, Kromberk, 5000 Nova Gorica', unit: '', source: Z.src.eles_lokacije.u });
  t.open = 'the outline of the switchyard is not confirmed on the map, the point is the ELES building at the listed address.'; }
{ const t = T.zag_gameljne; must(t.differences.length === 1, 'gameljne twin'); t.differences = [];
  t.specs.push({ label: 'Address in 2014', value: 'Srednje Gameljne 41, 1211 Ljubljana-Šmartno', unit: '', source: Z.src.zag_lp005.u });
  t.open = 'OpenStreetMap tags the building at this address as residential and gives it no name, so the map confirms the address and not the laboratory.'; }
{ const t = T.sij_acroni_pavers; const n0 = t.differences.length; t.differences = t.differences.filter(x => !/Record current point/.test(x)); must(t.differences.length === n0 - 1, 'acroni twin'); }

// ---------- text errors found by the recheck ----------
{ const e = E.soca_quake; must(C.soca_quake.note.includes('12 April 1998'), 'soca note');
  C.soca_quake.note = C.soca_quake.note.replace('12 April 1998', '12 July 2004');
  fact(e, 'Position', 'provisional epicentre published by ARSO');
  e.note = 'The pin marks the provisional epicentre of the 12 July 2004 earthquake published by ARSO. The work covered many buildings across the area.';
  log.push('soca_quake: epicentre note corrected to the 12 July 2004 earthquake'); }
{ const e = E.stoze; swap(e, 'hist', ' The position shown is the village, not the source area on the Stože slope.', '');
  e.note = 'The position is on the landslide, matched to the mapped slide area.';
  const t = T.stoze; const n0 = t.differences.length; t.differences = t.differences.filter(x => !/Current point/i.test(x)); if (t.open && /not mapped|village/i.test(t.open)) t.open = null;
  log.push('stoze: outdated "position is the village" wording removed (' + (n0 - t.differences.length) + ' twin line)'); }
for (const id of ['ss_kocevje', 'os_stara_cerkev', 'fibran_sodrazica']) { delFact(E[id], 'Position'); log.push(id + ': stale "Position: the settlement centre" row removed'); }
{ let t = JSON.stringify(Z), n = 0; for (const [a, b] of [['Kidriceva', 'Kidričeva'], ['Spruha', 'Špruha'], ['Sitarjevska', 'Sitarjevška']]) { n += t.split(a).length - 1; t = t.split(a).join(b); }
  const Z2 = JSON.parse(t); for (const k of Object.keys(Z)) Z[k] = Z2[k]; for (const e of Z.entries) E[e.id] = e;
  let tt = JSON.stringify(TW), m = 0; for (const [a, b] of [['Kidriceva', 'Kidričeva'], ['Sitarjevska', 'Sitarjevška']]) { m += tt.split(a).length - 1; tt = tt.split(a).join(b); }
  const T2 = JSON.parse(tt); for (const k of Object.keys(T)) T[k] = T2.objects[k];
  log.push('spelling: Kidričeva, Špruha, Sitarjevška corrected in ' + (n + m) + ' places'); }
{ for (const s of Z.stories) if (s.entry === 'zag') { s.lon = 14.513951; s.lat = 46.070442; } log.push('zag: three timeline stories moved onto the verified ZAG point (they were 535 m south)'); }
{ const e = E.catez_bridge; swap(e, 'detail', 'of seven bridges in the Sava reach below the Brežice hydropower plant', 'of seven bridges studied, two of them in Slovenia near the Brežice hydropower plant and the others near Zagreb');
  log.push('catez_bridge: "seven bridges" wording aligned with the paper'); }

// ---------- sourced additions ----------
src('iswim_hekic', { k: 'conference', a: 'Hekič, D.', y: 2025, t: 'Using Bridge WIM for Structural Health Monitoring of Bridges (ISWIM presentation)', u: 'https://www.is-wim.net/wp-content/uploads/2025/09/Doron-Hekic-Using-Bridge-WIM-for-Structural-Health-Monitoring-of-Bridges.pdf' });
{ const e = E.tomacevo; e.len_m = 204; addSrc(e, 'iswim_hekic'); T.tomacevo.specs.unshift({ label: 'Length', value: '204', unit: 'm', source: Z.src.iswim_hekic.u }); log.push('tomacevo: length 204 m added with source'); }
src('prvagim_rakusch', { k: 'report', a: 'I. gimnazija v Celju', t: 'Rakuschev mlin (research paper)', u: 'https://www.prvagim.si/wp-content/uploads/2020/05/Rakuschev_mlin_mali_popravljen_pdf.pdf' });
src('n24ur_rakusch', { k: 'news', a: '24ur.com', t: 'Gradbeni inšpektor naročil odstranitev celjskega Rakuševega mlina', u: 'https://www.24ur.com/novice/slovenija/gradbeni-inspektor-narocil-odstranitev-celjskega-rakusevega-mlina.html' });
{ const e = E.rakuschev_mlin; e.loc = 'Gaberje, Celje'; e.built = 1903;
  e.hist = 'The mill in Gaberje, also known as Prvi mestni mlin Celje, was built in 1903 and was a cultural monument of local importance. Fire damaged it in October 2014, and demolition began on 4 April 2015, so the building no longer stands.';
  fact(e, 'Built', '1903'); fact(e, 'Status', 'demolished from 4 April 2015'); addSrc(e, 'prvagim_rakusch', 'n24ur_rakusch'); log.push('rakuschev_mlin: built 1903, demolished 2015, locality Gaberje added with sources'); }
src('domzalec_vzideh', { k: 'news', a: 'Domžalec.si', y: 2021, t: 'Z osebnim vozilom trčil v steno predora', u: 'https://domzalec.si/kronika/z-osebnim-vozilom-trcil-v-steno-predora/' });
src('siol_vzideh', { k: 'news', a: 'Siol.net', y: 2026, t: 'Nesreča zaprla cesto v predoru pri Trojanah', u: 'https://siol.net/novice/slovenija/nesreca-zaprla-cesto-v-predoru-pri-trojanah-705974' });
{ const e = E.vzideh; e.carries = 'Regional road Trojane to Izlake';
  e.note = 'Press reports name the tunnel "predor V Zideh" on the regional road Trojane to Izlake in the Municipality of Lukovica. The mapped tunnel on that road is unnamed in OpenStreetMap. The location plan describes it as a single tube on the relocated regional road, built with the motorway contract.';
  addSrc(e, 'domzalec_vzideh', 'siol_vzideh');
  C.vzideh.note = 'Named in press as "predor V Zideh" on the regional road Trojane to Izlake, Municipality of Lukovica (domzalec.si 2021, siol.net 2026). The 284 m tunnel on road 221 is the mapped tunnel on that road and is unnamed in OpenStreetMap (the 1996 location plan gives 260 m, Lotsberg 296 m under A1).';
  C.vzideh.sources = [...new Set([...C.vzideh.sources, Z.src.domzalec_vzideh.u, Z.src.siol_vzideh.u])];
  log.push('vzideh: name and road now sourced from press reports'); }


// ---------- cableways and towers ----------
{ must(C.grad_vzpenjaca.note.includes('The point is the valley station.'), 'funicular note');
  C.grad_vzpenjaca.note = C.grad_vzpenjaca.note.replace('The point is the valley station.', 'The point is the upper station at the castle. The valley station at Krekov trg is the other end of the drawn line.');
  log.push('grad_vzpenjaca: label corrected, the point is the upper (castle) station'); }
{ must(C.livarna_crnomelj.note.includes('Ulica heroja Stariha 17'), 'livarna note'); C.livarna_crnomelj.note = C.livarna_crnomelj.note.replace('Ulica heroja Stariha 17', 'Ulica heroja Starihe 17'); log.push('livarna_crnomelj: street name spelling corrected to Ulica heroja Starihe'); }
{ const t = T.ratece_cable; const n0 = t.differences.length;
  t.summary = 'Not confirmed which installation. The client Smuk is named as lift operator and concession holder of the Macesnovc ski area in Rateče, which has a two seat chairlift and two short tows.';
  t.differences = t.differences.filter(x => !/not found in any source/.test(x)); must(t.differences.length === n0 - 1, 'ratece diff');
  t.specs.push({ label: 'Operator of Macesnovc', value: 'SMUK, Teslova ulica 30, Ljubljana', unit: '', source: 'https://www.skiresort.com/en/ski-resort/macesnovc-ratece/lift-operator/' });
  t.specs.push({ label: 'Concession for Macesnovc', value: 'Smuk, Ljubljana, as reported on 12 March 2016', unit: '', source: 'https://arhiv.gorenjskiglas.si/article/20160312/C/160319932/spet-smuka-na-macesnovcu' });
  t.open = 'No ZAG document names the lift. Macesnovc was reported closed for eight years before February 2016, which covers the 2012 inspection year.';
  log.push('ratece_cable: client Smuk now linked to the Macesnovc lifts by two sources, lift still not confirmed'); }

// ---------- source differences collected by the recheck (listed, not resolved) ----------
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return null; } };
const clean = s => String(s).replace(/[–—]/g, '-').replace(/;/g, ',').replace(/\s+/g, ' ').trim();
const SKIP = new Set(['crna', 'vransko']); let nd = 0;
for (const f of fs.readdirSync(AG).filter(f => f.endsWith('.json'))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(AG, f), 'utf8'))) {
    if (SKIP.has(r.id) || !T[r.id]) continue;
    for (const d of r.source_differences || []) {
      const ha = host(d.a_url), hb = host(d.b_url); if (!ha || !hb || !d.what || !d.a || !d.b) continue;
      if (/in-project|not re-?opened|record field|record \(|\(record\)|fetch summary|search (listing|results)|twin sheet|not fetchable|earlier check|already listed|opened now|stored|same (page|document|article)|third-party|mirror|inventory|cadastral|uncited|meta description/i.test(d.what + d.a + d.b)) continue;
      const line = clean(`${d.what}: ${d.a} (${ha}) against ${d.b} (${hb})`); if (line.length > 420) continue;
      T[r.id].differences = T[r.id].differences || []; if (T[r.id].differences.includes(line)) continue;
      T[r.id].differences.push(line); nd++;
    }
  }
}
for (const id of ['sitarjevec', 'zag_maribor']) T[id].differences = (T[id].differences || []).filter(x => !/spell/i.test(x));
log.push('twin sheets: ' + nd + ' source differences added from the recheck');
TW.meta.checked += '. Rechecked in November 2026 by five independent passes against outside sources: no record found on a wrong structure, source differences added';

// ---------- write ----------
Z.meta.n_src = Object.keys(Z.src).length;
fs.writeFileSync(path.join(R, 'data.js'), 'window.ZAG=' + JSON.stringify(Z) + ';');
fs.writeFileSync(CP, JSON.stringify(C, null, 2));
fs.writeFileSync(TP, JSON.stringify(TW));
console.log(log.join('\n'));
