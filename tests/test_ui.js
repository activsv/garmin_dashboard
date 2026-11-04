#!/usr/bin/env node
/* Test de l'IHM du dashboard.html sous jsdom (canvas stubbé).
   Nécessite : npm install jsdom   (dans ce dossier tests/)
   Usage : node tests/test_ui.js
   Charge les fixtures (tests/fixtures/*.fit) + les .fit de la racine du dépôt,
   importe via l'input file, puis parcourt les onglets et vérifie les nouvelles
   fonctionnalités (sparklines, calendrier, dernière activité, zones FC, laps,
   GPX, période libre, zoom). Exit code 0 si aucune erreur JS et tous les checks OK.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) { console.error('jsdom absent : exécutez "npm install jsdom" dans tests/'); process.exit(2); }

let pass = 0, fail = 0;
const errors = [];
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  PASS', label); }
  else { fail++; console.log('  FAIL', label, extra !== undefined ? '-> ' + String(extra).slice(0, 200) : ''); }
}

(async () => {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf-8');
  const dom = new JSDOM(html, {
    url: 'file://' + path.join(ROOT, 'dashboard.html'),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { document } = window;
  window.devicePixelRatio = 1;
  window.HTMLCanvasElement.prototype.getContext = function () {
    const noop = () => {};
    return new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : noop), set: () => true });
  };
  window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    return { width: 800, height: 340, left: 0, top: 0, right: 800, bottom: 340 };
  };
  window.addEventListener('error', e => errors.push('window error: ' + e.message));
  window.indexedDB = undefined;
  window.showDirectoryPicker = undefined;
  window.URL.createObjectURL = () => 'blob:x';
  window.URL.revokeObjectURL = () => {};

  await new Promise(r => setTimeout(r, 300));
  ok(document.querySelector('.tab.actif').dataset.vue === 'accueil', 'démarrage sur Tableau de bord');

  // fichiers à importer : fixtures + .fit de la racine
  const files = [];
  const fx = path.join(ROOT, 'tests/fixtures');
  for (const f of fs.readdirSync(fx).filter(f => f.endsWith('.fit')))
    files.push(new window.File([fs.readFileSync(path.join(fx, f))], f));
  for (const f of fs.readdirSync(ROOT).filter(f => f.toLowerCase().endsWith('.fit')))
    files.push(new window.File([fs.readFileSync(path.join(ROOT, f))], f));
  const input = document.getElementById('fileInput');
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3000));

  const statut = document.getElementById('statut').textContent;
  console.log('  statut:', statut.slice(0, 160));
  ok(/\d+ décodé\(s\)/.test(statut) && /erreur/.test(statut), 'statut : fichiers décodés + 1 erreur (bad.fit)');
  ok(document.querySelector('.tab.actif').dataset.vue === 'accueil', 'bascule auto sur accueil après import');
  ok(document.getElementById('bandeauVide').style.display === 'none', 'bandeau vide masqué');

  // accueil : KPI + sparklines + dernière activité
  const kpis = [...document.querySelectorAll('#kpiAccueil .kpi')];
  ok(kpis.length === 8, '8 cartes KPI', kpis.length);
  const sparks = document.querySelectorAll('#kpiAccueil .kpi .spark').length;
  ok(sparks >= 6, 'sparklines présentes dans les cartes KPI', sparks);
  ok(document.getElementById('carteDerniere').style.display === 'block', 'carte Dernière activité visible');
  const dern = document.getElementById('derniereActivite').textContent;
  console.log('  dernière activité:', dern.replace(/\s+/g, ' ').slice(0, 120));
  ok(/Course à pied|Vélo|Natation/.test(dern), 'dernière activité affichée');
  ok(document.getElementById('sparkDerniere') !== null, 'sparkline FC de la dernière activité');

  // période libre
  const d = document.getElementById('dateDu');
  d.value = '2026-10-25'; d.dispatchEvent(new window.Event('change', { bubbles: true }));
  const a = document.getElementById('dateAu');
  a.value = '2026-10-29'; a.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  ok(/du 25\/10\/2026 au 29\/10\/2026/.test(document.getElementById('titreGraphAccueil').textContent),
    'période libre appliquée', document.getElementById('titreGraphAccueil').textContent);
  a.value = ''; a.dispatchEvent(new window.Event('change', { bubbles: true }));
  d.value = ''; d.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));

  // onglet activités : calendrier + liste + détail (zones FC, laps, GPS)
  document.querySelector('.tab[data-vue="activites"]').click();
  await new Promise(r => setTimeout(r, 400));
  const cases = document.querySelectorAll('#calendrier .case.has').length;
  ok(cases >= 2, 'calendrier : jours avec activité cliquables', cases);
  const seances = document.querySelectorAll('#listeSeances .item');
  ok(seances.length >= 2, 'liste des séances', seances.length);
  // filtre par jour via le calendrier
  let c0 = document.querySelector('#calendrier .case.has');
  c0.click();
  await new Promise(r => setTimeout(r, 300));
  ok(document.getElementById('calFiltre').textContent.includes('Filtré sur le'), 'filtre jour actif', document.getElementById('calFiltre').textContent);
  c0 = document.querySelector('#calendrier .case.has.sel') || document.querySelector('#calendrier .case.has');
  c0.click();
  await new Promise(r => setTimeout(r, 300));
  ok(!document.getElementById('calFiltre').textContent.includes('Filtré'), 'filtre jour retiré');
  // détail séance (la 1ère = la plus récente)
  const items = document.querySelectorAll('#listeSeances .item');
  items[0].click();
  await new Promise(r => setTimeout(r, 400));
  const titre = document.getElementById('titreSeance').textContent;
  console.log('  séance ouverte:', titre);
  ok(document.getElementById('detailSeance').style.display === 'block', 'détail séance ouvert');
  ok(document.getElementById('kpiSeance').textContent.includes('Durée'), 'KPIs séance');
  // zones FC si métrique = FC (défaut)
  ok(document.getElementById('legendeSeance').innerHTML.includes('Z1') || document.getElementById('selMetriqueSeance').value === 'heart_rate',
    'zones FC en légende (métrique FC)', document.getElementById('legendeSeance').textContent.slice(0, 120));
  // laps
  const lapsVisible = document.getElementById('carteLaps').style.display === 'block';
  ok(lapsVisible, 'tableau des laps visible', document.getElementById('carteLaps').style.display);
  // GPS + GPX sur la séance ouverte (la plus récente = vélo avec trace GPS)
  ok(/Vélo/.test(titre), 'séance ouverte = vélo (avec GPS)', titre);
  ok(document.getElementById('carteCarteGps').style.display === 'block', 'carte GPS affichée pour la séance avec positions',
    document.getElementById('carteCarteGps').style.display);
  let gpxClicked = false;
  const origClick = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () { gpxClicked = true; };
  document.getElementById('btnExportGpx').click();
  window.HTMLAnchorElement.prototype.click = origClick;
  ok(gpxClicked, 'export GPX déclenché');

  // santé : métriques + zoom
  document.querySelector('.tab[data-vue="sante"]').click();
  await new Promise(r => setTimeout(r, 400));
  ok(document.getElementById('contenuSante').style.display === 'block', 'vue santé avec données');
  const selM = document.getElementById('selMetrique');
  selM.value = 'stress'; selM.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  ok(/Stress/.test(document.getElementById('titreGraphSante').textContent), 'métrique stress', document.getElementById('titreGraphSante').textContent);
  const cv = document.getElementById('chartSante');
  cv.onclick && cv.onclick({ clientX: 400, clientY: 150 });
  await new Promise(r => setTimeout(r, 300));
  ok(document.getElementById('zoomCarteSante').style.display === 'block', 'zoom jour visible');
  ok(/points/.test(document.getElementById('titreZoomSante').textContent), 'zoom avec nb de points', document.getElementById('titreZoomSante').textContent);
  document.getElementById('btnVueGlobale').click();
  await new Promise(r => setTimeout(r, 200));
  ok(document.getElementById('zoomCarteSante').style.display === 'none', 'vue globale restaure');

  // sommeil
  document.querySelector('.tab[data-vue="sommeil"]').click();
  await new Promise(r => setTimeout(r, 400));
  ok(document.getElementById('contenuSommeil').style.display === 'block', 'vue sommeil avec données');
  ok(document.querySelectorAll('#tableSommeil tbody tr').length >= 2, 'nuits listées', document.querySelectorAll('#tableSommeil tbody tr').length);

  // fichiers
  document.querySelector('.tab[data-vue="fichiers"]').click();
  await new Promise(r => setTimeout(r, 400));
  const itemsF = document.querySelectorAll('#listeFichiers .item');
  ok(itemsF.length === files.length, 'tous les fichiers listés', itemsF.length + '/' + files.length);
  ok([...itemsF].some(i => i.textContent.includes('ERREUR')), 'fichier corrompu affiché en erreur');
  itemsF[0].click();
  await new Promise(r => setTimeout(r, 300));
  ok(document.getElementById('detailFichier').style.display === 'block', 'détail fichier ouvert');
  ok(document.querySelectorAll('#tableMessages tbody tr').length >= 1, 'table des messages remplie');

  // export JSON
  document.getElementById('btnExport').click();
  await new Promise(r => setTimeout(r, 300));
  ok(/exporté en JSON/.test(document.getElementById('statut').textContent), 'export JSON ok');

  console.log('\n===== ERREURS JS =====');
  console.log(errors.length ? errors.join('\n') : '  aucune');
  ok(errors.length === 0, 'aucune erreur JS');
  console.log('\n===== ' + pass + ' PASS, ' + fail + ' FAIL =====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ECHEC TEST:', e); process.exit(1); });
