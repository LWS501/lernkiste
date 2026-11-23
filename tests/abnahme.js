// Abnahmetests der Lernkiste im Test-Browser (jsdom).
// Aufruf: JSDOM_PATH=/pfad/node_modules/jsdom node tests/abnahme.js index.html
const fs = require('fs');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const HTML = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const DECK = 'gesch-9-2026-11';
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(storage = {}, { blockStorage = false } = {}) {
  const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://lws501.github.io/lernkiste/' });
  const w = dom.window, d = w.document, errs = [];
  w.addEventListener('error', e => errs.push(e.message));
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  if (blockStorage) w.Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
  const main = [...d.querySelectorAll('script:not([type])')].pop();
  try { w.eval(main.textContent); } catch (e) { errs.push('Start: ' + e.message); }
  const q = s => d.querySelector(s);
  const click = s => { const el = typeof s === 'string' ? q(s) : s; if (!el) throw new Error('fehlt: ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const closeModals = () => { let n = 0; while (q('.modal') && n++ < 30) click('[data-act=closemodal]'); };
  const state = () => JSON.parse(w.localStorage.getItem('lernkiste-v1') || '{}');
  const dump = () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
  const input = (sel, val, type = 'input') => { const el = q(sel); el.value = val; el.dispatchEvent(new w.Event(type, { bubbles: true })); };
  const file = async (sel, text) => { const el = q(sel); Object.defineProperty(el, 'files', { value: [new w.File([text], 'x.json', { type: 'application/json' })], configurable: true }); el.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(60); };
  const deck = JSON.parse(d.querySelector('script.lk-deck').textContent.replace(/<\\\//g, '</'));
  const curId = () => { const h = q('h2.q'); const c = h && deck.cards.find(c => c.q === h.textContent.trim()); return c ? c.id : null; };
  return { w, d, q, click, closeModals, state, dump, input, file, errs, curId };
}
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); }

(async () => {
  // 1) Fehlerhafter Import und anschließender Neustart
  {
    const a = boot();
    a.click('[data-act=nav][data-v=more]');
    await a.file('#deckfile', '{"id":"neu-stapel","title":"Neu","topics":[{"id":"t","n":"T"}],"cards":[{"id":"x","t":"zz","q":"Q?"}]}');
    const msg = a.q('.zbox.nob') ? a.q('.zbox.nob').textContent : '';
    check('Import ungültig → abgelehnt mit Meldung', /nicht übernommen/.test(msg) && /Thema unbekannt/.test(msg), msg.slice(0, 120));
    await a.file('#deckfile', JSON.stringify({ id: DECK, title: 'Kopie', topics: [{ id: 't', n: 'T' }], cards: [1, 2, 3, 4, 5].map(i => ({ id: 'c' + i, t: 't', q: 'Q' + i, a: 'A' })) }));
    check('Import mit eingebauter id → abgelehnt', /fest eingebaut/.test(a.q('.zbox.nob').textContent));
    await a.file('#deckfile', 'kein json');
    check('Import ohne JSON → abgelehnt', /kein JSON/.test(a.q('.zbox.nob').textContent));
    a.click('[data-act=nav][data-v=home]');
    check('Bisheriger Stapel bleibt aktiv', /Geschichte/.test(a.q('.hk').textContent));
    const b = boot({ 'lernkiste-decks': JSON.stringify([{ id: 'kaputt', title: 'x', topics: 5, cards: [1] }]), 'lernkiste-v1': JSON.stringify({ deck: 'kaputt' }) });
    check('Neustart mit beschädigtem Stapel → gültiger Stapel offen', b.q('.hk') && /Geschichte/.test(b.q('.hk').textContent) && !b.errs.length, b.errs.join(';'));
    check('Hinweis auf ausgeblendeten Stapel', /ausgeblendet/.test(b.q('#notice').textContent));
    const c = boot({ 'lernkiste-v1': '{kaputt' });
    const keys = Object.keys(c.dump());
    check('Unlesbare Daten → Hinweis + Kopie aufgehoben', /beschädigt/.test(c.q('#notice').textContent) && keys.some(k => k.startsWith('lernkiste-v1-defekt-')), keys.join(','));
  }
  // 2) Blockierter Speicher
  {
    const a = boot({}, { blockStorage: true });
    check('Blockierter Speicher → Warnung sichtbar', /Speichern klappt gerade nicht/.test(a.q('#notice').textContent));
    a.click('[data-act=nav][data-v=more]'); a.click('[data-act=exmode][data-v=none]');
    check('Keine falsche „gespeichert“-Meldung', /nicht geklappt/.test(a.q('.toast').textContent), a.q('.toast').textContent);
    check('App läuft ohne Fehler', !a.errs.length, a.errs.join(';'));
  }
  // 3) Laden eines bestehenden Lernstands (Format von Version 2)
  {
    const old = { points: 120, days: [], tro: { start: '2026-11-23' }, set: { tts: true, rate: 1, v: 2 }, deck: DECK, stats: { ok: 3, calib: 1, ex: 1 },
      p: { [DECK]: { c: { i1: { lv: 3, n: 4, due: 0, ok: 3, bad: 1, over: 0 } }, tests: [{ d: Date.now() - 3600e3, s: 8, n: 12, by: {} }], exam: '2026-11-24' } } };
    const a = boot({ 'lernkiste-v1': JSON.stringify(old) });
    a.click('[data-act=nav][data-v=prog]');
    check('Alter Lernstand lesbar (Punkte, Test, Stufe)', /120/.test(a.q('#pills').textContent) && /8\/12/.test(a.q('#view').textContent) && a.state().p[DECK].c.i1.lv === 3 && !a.errs.length, a.errs.join(';'));
    a.click('[data-act=nav][data-v=more]');
    check('Altes eigenes Datum wird als „Eigenes Datum“ erkannt', a.q('[data-act=exmode][data-v=own]').getAttribute('aria-pressed') === 'true');
  }
  // 4) Schnelle Wiederholung ohne Stufenaufstieg + freiwillig vorgezogene Karten
  {
    const a = boot();
    a.click('[data-act=learn]');
    const firstId = () => a.curId();
    const id0 = firstId();
    a.click('[data-act=flip][data-v="1"]'); a.click('[data-act=rate][data-v="0"]'); a.closeModals();
    let practiceShown = false;
    for (let i = 0; i < 40 && a.q('[data-act=flip]'); i++) {
      const id = firstId();
      a.click('[data-act=flip][data-v="2"]');
      if (id === id0) practiceShown = /Übung \(Wiederholung in dieser Runde\)/.test(a.q('#view').textContent);
      a.click('[data-act=rate][data-v="2"]'); a.closeModals();
    }
    const st = a.state().p[DECK].c;
    check('Wiederholung in derselben Runde → keine Stufe', st[id0].lv === 0 && practiceShown, 'lv=' + st[id0].lv);
    const other = Object.keys(st).find(k => k !== id0 && st[k].lv === 1);
    check('Neue Karte selbstständig gewusst → Stufe 1', !!other);
    a.click('[data-act=learn]');
    for (let i = 0; i < 40 && a.q('[data-act=flip]'); i++) { a.click('[data-act=flip][data-v="2"]'); a.click('[data-act=rate][data-v="2"]'); a.closeModals(); }
    check('Vorgezogene Karte (nicht fällig) → Stufe bleibt 1', a.state().p[DECK].c[other].lv === 1, 'lv=' + a.state().p[DECK].c[other].lv);
  }
  // 5) Fälliger Abruf ohne Hilfe (und mit Hinweis)
  {
    const now = Date.now();
    const st = { deck: DECK, p: { [DECK]: { c: { i1: { lv: 1, n: 1, due: now - 7200e3, ok: 1, bad: 0, over: 0 }, i3: { lv: 1, n: 1, due: now - 3600e3, ok: 1, bad: 0, over: 0 } }, tests: [] } } };
    const a = boot({ 'lernkiste-v1': JSON.stringify(st) });
    a.click('[data-act=learn]');
    check('Fällige Karte kommt zuerst', a.curId() === 'i1');
    a.click('[data-act=flip][data-v="2"]'); a.click('[data-act=rate][data-v="2"]'); a.closeModals();
    check('Fälliger Abruf ohne Hilfe → Stufe 2', a.state().p[DECK].c.i1.lv === 2);
    for (let i = 0; i < 12 && a.curId() !== 'i3'; i++) { a.click('[data-act=flip][data-v="1"]'); a.click('[data-act=rate][data-v="1"]'); a.closeModals(); }
    check('Zweite fällige Karte i3 in derselben Runde (gemischt mit anderen Themen)', a.curId() === 'i3');
    a.click('[data-act=hint]'); a.click('[data-act=flip][data-v="2"]'); a.click('[data-act=rate][data-v="2"]'); a.closeModals();
    const k = a.state().p[DECK].c.i3;
    check('Fälliger Abruf mit Hinweis → Stufe bleibt, kommt bald wieder', k.lv === 1 && k.due - Date.now() < 3 * 60e3, 'lv=' + k.lv);
  }
  // 6) Quizfeedback zu i2
  {
    let ok = false, txt = '';
    for (let t = 0; t < 40 && !ok; t++) {
      const a = boot({ 'lernkiste-v1': JSON.stringify({ filter: ['imp'] }) });
      a.click('[data-act=quiz]');
      for (let i = 0; i < 12 && a.q('[data-act=pick]'); i++) {
        if (/NICHT in deiner Tabelle/.test(a.q('h2.q').textContent)) { a.click('[data-act=pick][data-v="0"]'); txt = a.q('.fb').textContent; ok = true; break; }
        a.click('[data-act=pick][data-v="0"]'); a.click('[data-act=qnext]'); a.closeModals();
      }
    }
    check('Quizfeedback i2 nennt „ökologisch“', ok && /Richtige Antwort: ökologisch/.test(txt) && !/wirtschaftlich, gesellschaftlich/.test(txt), txt.slice(0, 100));
  }
  // 7) Lernstand-Test genau einmal speichern
  {
    const a = boot();
    a.click('[data-act=test]');
    for (let i = 0; i < 14 && a.q('[data-act=pick]'); i++) { a.click('[data-act=pick][data-v="0"]'); a.click('[data-act=qnext]'); a.closeModals(); }
    const n1 = a.state().p[DECK].tests.length;
    a.click('[data-act=nav][data-v=prog]'); a.click('[data-act=nav][data-v=home]');
    check('Test genau einmal gespeichert (auch bei erneutem Anzeigen)', n1 === 1 && a.state().p[DECK].tests.length === 1, `${n1}/${a.state().p[DECK].tests.length}`);
  }
  // 8) Wiederaufnahme eines Klausurentwurfs
  {
    const a = boot();
    a.click('[data-act=exam]');
    a.input('#etxt', 'Imperialismus ist die Ausweitung von Macht.');
    await sleep(500);
    const b = boot(a.dump());
    b.click('[data-act=exam]');
    const offer = !!b.q('[data-act=exresume]');
    b.click('[data-act=exresume]');
    const restored = b.q('#etxt') && b.q('#etxt').value === 'Imperialismus ist die Ausweitung von Macht.';
    check('Klausurentwurf: „Fortsetzen“ nach Neustart, Text wieder da', offer && restored);
    b.input('#etxt', 'Imperialismus ist die Ausweitung von Macht.');
    b.click('[data-act=eshow]');
    check('Antwort beim Aufdecken festgehalten (kein Eingabefeld mehr)', !b.q('#etxt') && /Ausweitung von Macht/.test(b.q('.zbox.mine').textContent));
    for (let i = 0; i < 6 && b.q('[data-act=enext]'); i++) { b.click('[data-act=tick][data-v="0"]'); b.click('[data-act=enext]'); b.closeModals(); if (b.q('[data-act=eshow]')) b.click('[data-act=eshow]'); }
    const s = b.state();
    check('Abgeschlossen ≠ bestanden (6/25 = 24 % < 50 %)', s.stats.ex === 1 && !s.stats.exPass && /Noch nicht bestanden/.test(b.q('#view').textContent) && !(s.tro || {}).peng);
    check('Entwurf nach Abschluss gelöscht', !s.p[DECK].examDraft);
  }
  // 9) Löschen des Prüfungstermins
  {
    const a = boot();
    a.click('[data-act=nav][data-v=more]');
    a.click('[data-act=exmode][data-v=own]');
    a.input('#exdate', '2026-12-01', 'change');
    const set = /01\.12\.2026/.test(a.q('#view').textContent);
    a.input('#exdate', '', 'change');
    const s = a.state().p[DECK];
    check('Termin löschen → „Ohne Termin“, keine Fehler', set && s.examMode === 'none' && /kein Termin/.test(a.q('#view').textContent) && !a.errs.length);
    a.click('[data-act=nav][data-v=home]');
    check('Startseite ohne Terminanzeige', !/Arbeit (heute|morgen|in)/.test(a.q('.hs').textContent));
  }
  // 10) VoiceOver-Grundlagen
  {
    const a = boot();
    check('Aktiver Tab mit aria-current', a.q('#nav [aria-current=page]') && a.q('#nav [aria-current=page]').dataset.v === 'home');
    check('Ungeübt → „Noch keine Einschätzung“', /Noch keine Einschätzung/.test(a.q('.hs').textContent));
    a.click('[data-act=learn]'); a.click('[data-act=flip][data-v="2"]'); a.click('[data-act=rate][data-v="2"]');
    const m = a.q('.modal');
    check('Trophäendialog bekommt Fokus', m && a.d.activeElement === m.querySelector('button'));
    a.closeModals();
    check('Fokus nach dem Schließen im Inhalt', a.q('#view').contains(a.d.activeElement) || a.d.activeElement === a.q('#view'));
  }
  // 11) Sicherung erstellen und wiederherstellen
  {
    const a = boot();
    a.click('[data-act=learn]'); a.click('[data-act=flip][data-v="2"]'); a.click('[data-act=rate][data-v="2"]'); a.closeModals();
    const pts = a.state().points;
    a.click('[data-act=nav][data-v=more]'); a.click('[data-act=bkcopy]');
    await sleep(30);
    const txt = a.q('#bkout textarea') ? a.q('#bkout textarea').value : '';
    const b = boot();
    b.click('[data-act=nav][data-v=more]');
    await b.file('#backupfile', txt);
    const asked = !!b.q('[data-act=rsok]');
    b.click('[data-act=rsok]');
    check('Sicherung → Wiederherstellen mit Rückfrage, Punkte zurück', txt.length > 100 && asked && b.state().points === pts && pts > 0 && !b.errs.length, `pts ${pts}/${b.state().points}`);
    b.click('[data-act=nav][data-v=more]');
    await b.file('#backupfile', '{"foo":1}');
    check('Fremde Datei als Sicherung → abgelehnt', /keine Lernkiste-Sicherung/.test(b.q('.toast').textContent));
  }
  // Ausgabe
  const w = Math.max(...results.map(r => r.name.length));
  results.forEach(r => console.log((r.ok ? '✅ ' : '❌ ') + r.name.padEnd(w) + (r.ok || !r.detail ? '' : '  → ' + r.detail)));
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} bestanden`);
  process.exit(bad ? 1 : 0);
})();
