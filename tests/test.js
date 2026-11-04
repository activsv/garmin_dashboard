#!/usr/bin/env node
/* Tests du dashboard.html (couche parseur + modèle + calculs), sans dépendance.
   Extrait le <script> du fichier HTML, l'évalue comme module CommonJS, puis
   vérifie le décodage des fixtures (tests/fixtures/*.fit, générées par
   tests/make_fixtures.py) et des vrais fichiers .fit déposés à la racine.
   Usage : node tests/test.js   (exit code 0 si tout passe)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf-8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('FAIL: balise <script> introuvable'); process.exit(1); }
const tmp = path.join(os.tmpdir(), 'dashboard-test-' + process.pid + '.js');
fs.writeFileSync(tmp, m[1]);
const M = require(tmp);

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  PASS', label); }
  else { fail++; console.log('  FAIL', label, extra !== undefined ? '-> ' + JSON.stringify(extra) : ''); }
}
function parseFile(p) {
  const buf = fs.readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new M.FitParser().parse(ab);
}
function loadStore(files) {
  const store = new M.DataStore();
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    try { store.addFile(path.basename(p), buf.length, parseFile(p), null); }
    catch (e) { store.addFile(path.basename(p), buf.length, null, e.message); }
  }
  return store;
}

console.log('== Fixtures synthétiques ==');
const fixtures = ['tests/fixtures/activity_run.fit', 'tests/fixtures/activity_ride_gps.fit',
  'tests/fixtures/monitoring_5days.fit', 'tests/fixtures/sleep_2nights.fit', 'tests/fixtures/bad.fit'];

let store = loadStore(fixtures);
ok(store.files.length === 5, '5 fichiers chargés');
ok(store.errCount === 1 && /corrompu|invalide|pas un|\.FIT/i.test(store.files.find(f => f.error).error),
  'bad.fit signalé en erreur avec message clair', store.files.find(f => f.error) && store.files.find(f => f.error).error);
ok(store.okCount === 4, '4 fichiers décodés');
ok(store.records.size === 1800 + 720, 'records = 1800 + 720', store.records.size);
ok(store.sessions.length === 2, '2 séances', store.sessions.length);
const run = store.sessions.find(s => s.sport === 1);
ok(!!run, 'séance course trouvée');
ok(run && Math.abs(run.total_distance - 5760) < 5, 'distance course ~5760 m', run && run.total_distance);
ok(run && run.avg_heart_rate === 145 && run.max_heart_rate === 172, 'FC séance 145/172', run && [run.avg_heart_rate, run.max_heart_rate]);
ok(store.gps.length === 720, '720 points GPS (vélo)', store.gps.length);
const ride = store.sessions.find(s => s.sport === 2);
ok(!!ride && ride.total_calories === 650, 'séance vélo trouvée (650 kcal)');
const recs = store.recordsSorted();
ok(recs.some(r => typeof r.power === 'number'), 'puissance présente sur le vélo');
ok(recs.every(r => r.t > 1700000000000 && r.t < 2000000000000), 'timestamps cohérents (2026)');

console.log('== Monitoring 5 jours (agrégats journaliers) ==');
const agg = M.dailyAgg(store);
ok(agg.size === 5, '5 jours agrégés', agg.size);
let allSteps = true, hrOk = true, stressOk = true, restOk = true;
for (const v of agg.values()) {
  if (!(typeof v.steps === 'number' && v.steps > 5000)) allSteps = false;      // cumulatif -> max du jour
  if (!(typeof v.hr_avg === 'number' && v.hr_avg > 50 && v.hr_avg < 90)) hrOk = false;
  if (!(typeof v.stress_avg === 'number' && v.stress_avg >= 0)) stressOk = false;
  if (!(typeof v.hr_rest === 'number' && v.hr_rest >= 50)) restOk = false;
}
ok(allSteps, 'pas journaliers cumulatifs (max) > 5000', [...agg.values()].map(v => v.steps));
ok(hrOk, 'FC moyenne journalière dans 50-90', [...agg.values()].map(v => v.hr_avg && +v.hr_avg.toFixed(1)));
ok(stressOk, 'stress moyen calculé');
ok(restOk, 'FC au repos journalière', [...agg.values()].map(v => v.hr_rest));

console.log('== KPIs / séries / tendances ==');
const kSteps = M.computeKPIs(store, 'steps', 'tout', 'tout');
ok(kSteps.series.length === 5, 'série pas = 5 jours', kSteps.series.length);
ok(kSteps.moy > 5000 && kSteps.min > 0 && kSteps.max >= kSteps.min, 'KPI pas moy/min/max', { moy: kSteps.moy, min: kSteps.min, max: kSteps.max });
ok(kSteps.seances === 2, '2 séances sur "tout"', kSteps.seances);
const kHr = M.computeKPIs(store, 'heart_rate', 'tout', 'tout');
ok(kHr.series.length === 2, 'série FC record agrégée par jour = 2 jours', kHr.series.length);
const kStress = M.computeKPIs(store, 'stress', 'tout', 'tout');
ok(kStress.series.length === 5, 'série stress = 5 jours');
ok(typeof kStress.tendance === 'number' || kStress.tendance === null, 'tendance calculée sans erreur', kStress.tendance);

console.log('== Zones de FC (temps par zone) ==');
const zt = M.zoneTimeByDay(store, 0, Date.now());
ok(zt.zones.length === 5, '5 zones de FC (fallback % FCmax)', zt.zones.length);
ok(zt.series.length === 2, 'temps par zone agrégé sur 2 jours de séances', zt.series.length);
const totSec = zt.series.reduce((a, s) => a + Object.values(s.z).reduce((x, y) => x + y, 0), 0);
ok(totSec > 1500 && totSec < 6000, 'total ~durée des séances (1800s + 3600s)', totSec);

console.log('== Sommeil ==');
const nuits = M.sleepNights(store);
ok(nuits.length === 2, '2 nuits détectées', nuits.length);
ok(nuits.every(n => n.duree_s > 5 * 3600), 'durées > 5 h', nuits.map(n => n.duree_s / 3600));

console.log('== LTTB (sous-échantillonnage) ==');
const big = Array.from({ length: 100000 }, (_, i) => ({ x: i, y: Math.sin(i / 100) }));
ok(M.lttb(big, 1200).length <= 1200, '100k points -> <= 1200', M.lttb(big, 1200).length);
ok(M.lttb([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1200).length === 2, 'petit tableau inchangé');

console.log('== Dédoublonnage + JSON ==');
const before = store.records.size;
store.addFile('activity_run.fit', fs.statSync(path.join(ROOT, 'tests/fixtures/activity_run.fit')).size,
  parseFile(path.join(ROOT, 'tests/fixtures/activity_run.fit')), null);
ok(store.records.size === before && store.files[store.files.length - 1].doublon === true, 'réimport du même fichier = doublon ignoré');
const json = store.exportJSON();
const st2 = M.DataStore.fromJSON(json);
ok(st2.records.size === store.records.size && st2.sessions.length === store.sessions.length && st2.monitoring.length === store.monitoring.length,
  'round-trip export/import JSON', { r: st2.records.size, s: st2.sessions.length, m: st2.monitoring.length });

console.log('== Fichiers corrompus divers ==');
function expectErr(buf, label) {
  try { new M.FitParser().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)); ok(false, label, 'aucune erreur levée'); }
  catch (e) { ok(typeof e.message === 'string' && e.message.length > 5, label, e.message); }
}
expectErr(Buffer.from([1, 2, 3]), 'fichier trop petit -> erreur');
expectErr(Buffer.from('pas un fit, juste du texte........'), 'texte -> erreur');
const trunc = fs.readFileSync(path.join(ROOT, 'tests/fixtures/activity_run.fit')).slice(0, 500);
expectErr(trunc, 'fichier tronqué -> erreur');

console.log('== Vrais fichiers du dépôt (racine) ==');
const rootFits = fs.readdirSync(ROOT).filter(f => f.toLowerCase().endsWith('.fit'));
if (rootFits.length) {
  const st3 = loadStore(rootFits);
  ok(st3.okCount >= 1, rootFits.length + ' fichier(s) racine décodé(s)', st3.okCount);
  console.log('  -> records:', st3.records.size, 'séances:', st3.sessions.length, 'monitoring:', st3.monitoring.length, 'stress:', st3.stress.length);
} else {
  console.log('  (aucun .fit à la racine sur cette branche — ignoré)');
}

fs.unlinkSync(tmp);
console.log('\n===== ' + pass + ' PASS, ' + fail + ' FAIL =====');
process.exit(fail ? 1 : 0);
