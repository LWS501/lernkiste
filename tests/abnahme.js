// Abnahmetests der Lernkiste im Test-Browser (jsdom).
// Aufruf: JSDOM_PATH=/pfad/node_modules/jsdom node tests/abnahme.js index.html
const fs = require('fs');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const HTML = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const DECK = 'gesch-9-2026-11';
const VER = (HTML.match(/APP_VERSION="([^"]+)"/) || [])[1];
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(storage = {}, { blockStorage = false } = {}) {
  // Tests beziehen sich auf den Geschichte-Stapel: ihn fest auswählen, falls der Zustand keinen Stapel nennt
  if (!('lernkiste-v1' in storage)) storage = Object.assign({ 'lernkiste-v1': JSON.stringify({ deck: DECK }) }, storage);
  else { try { const o = JSON.parse(storage['lernkiste-v1']); if (o && typeof o === 'object' && !('deck' in o)) storage = Object.assign({}, storage, { 'lernkiste-v1': JSON.stringify(Object.assign({ deck: DECK }, o)) }); } catch (e) { /* absichtlich kaputt */ } }
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
    check('Neustart mit beschädigtem Stapel → gültiger Stapel offen', b.q('.hk') && b.q('.hk').textContent.trim().length > 0 && !/kaputt/.test(b.q('.hk').textContent) && !b.errs.length, b.errs.join(';'));
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
      for (let i = 0; i < 12 && (a.q('[data-act=pick]') || a.q('[data-act=qreveal]')); i++) {
        if (a.q('[data-act=qreveal]')) a.click('[data-act=qreveal]');
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
  // 12) Lernidee 1: Quiz verdeckt
  {
    const a = boot();
    a.click('[data-act=quiz]');
    const veiled = !!a.q('#qfree') && !a.q('[data-act=pick]');
    a.input('#qfree', 'meine Idee');
    a.click('[data-act=qreveal]');
    const opts = a.q('[data-act=pick]');
    a.click('[data-act=pick][data-v="0"]');
    check('Quiz verdeckt: erst frei antworten, dann Auswahl; freie Antwort im Feedback', veiled && !!opts && /meine Idee/.test(a.q('#view').textContent));
    a.click('[data-act=nav][data-v=more]'); a.click('[data-act=hidetog]');
    a.click('[data-act=nav][data-v=home]'); a.click('[data-act=quiz]');
    check('Verdecken abschaltbar', !!a.q('[data-act=pick]') && !a.q('#qfree'));
    const b = boot(); b.click('[data-act=test]');
    check('Lernstand-Test immer offen (nicht verdeckt)', !!b.q('[data-act=pick]'));
  }
  // 13) Lernidee 3: Fehler-Revanche – Quizfehler am Folgetag ohne Auswahl
  {
    const a = boot();
    a.click('[data-act=nav][data-v=more]'); a.click('[data-act=hidetog]');
    a.click('[data-act=nav][data-v=home]'); a.click('[data-act=quiz]');
    let wrongId = null;
    for (let i = 0; i < 10 && a.q('[data-act=pick]'); i++) {
      const id = a.d.querySelector('h2.q').textContent; const btns = [...a.d.querySelectorAll('[data-act=pick]')];
      const deckCard = JSON.parse(a.d.querySelector('script.lk-deck').textContent).cards.find(c => c.mc && (c.mc.q || c.q) === id);
      const wrong = btns.find(b => b.textContent !== deckCard.mc.o[0]);
      a.click(wrong); if (!wrongId) wrongId = deckCard.id; a.click('[data-act=qnext]'); a.closeModals(); break;
    }
    const k = a.state().p[DECK].c[wrongId];
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
    check('Quizfehler plant Revanche für morgen', k.rev && k.rev.due === tomorrow.getTime() && (k.lv || 0) === 0);
    a.click('[data-act=nav][data-v=home]');
    check('Heute noch keine Revanche fällig', !/Fehler-Revanche/.test(a.q('.daily').textContent));
    // „Morgen“: Fälligkeit in die Vergangenheit legen und neu starten
    const st = a.state(); st.p[DECK].c[wrongId].rev.due = Date.now() - 1000;
    const b = boot({ 'lernkiste-v1': JSON.stringify(st) });
    check('Startseite zeigt Revanche', /1 Fehler-Revanche/.test(b.q('.daily').textContent));
    b.click('[data-act=daily]');
    const noChoices = !!b.q('[data-act=revflip]') && !b.q('[data-act=pick]') && /Fehler-Revanche/.test(b.q('.badge').textContent);
    b.click('[data-act=revflip]');
    const shows = /Richtige Antwort:/.test(b.q('.ans').textContent);
    b.click('[data-act=revrate][data-v="2"]'); b.closeModals();
    check('Revanche ohne Auswahl, Lösung, „Jetzt gewusst“ löscht sie', noChoices && shows && !b.state().p[DECK].c[wrongId].rev);
  }
  // 14) Lernidee 2: Tagesrunde mit nächstem Übungszeitpunkt
  {
    const now = Date.now();
    const st = { seenVersion: VER, deck: DECK, p: { [DECK]: { examMode: 'none', c: { i1: { lv: 1, n: 1, due: now - 60e3, ok: 1, bad: 0, over: 0 }, k1: { lv: 2, n: 2, due: now - 60e3, ok: 2, bad: 0, over: 0 }, c1: { lv: 2, n: 2, due: now + 5 * 3600e3, ok: 2, bad: 0, over: 0 } }, tests: [] } } };
    const a = boot({ 'lernkiste-v1': JSON.stringify(st) });
    const label = a.q('.daily').textContent;
    a.click('[data-act=daily]');
    let n = 0; for (let i = 0; i < 10 && a.q('[data-act=flip]'); i++) { a.click('[data-act=flip][data-v="2"]'); a.click('[data-act=rate][data-v="2"]'); a.closeModals(); n++; }
    const end = a.q('#view').textContent;
    check('Tagesrunde: nur fällige Karten (2), Ende mit nächstem Übungszeitpunkt', /2 Karten fällig/.test(label) && n === 2 && /Tagesrunde geschafft/.test(end) && /Nächste Übung: (heute|morgen) um \d\d:\d\d/.test(end), label + ' | n=' + n);
    a.click('[data-act=home]');
    check('Danach: „Heute alles erledigt“', /Heute alles erledigt/.test(a.q('.daily').textContent));
  }
  // 15) Versionierung
  {
    const a = boot();
    check(`Hinweis „Neu in Version ${VER}“ einmalig`, a.q('#notice').textContent.includes('Neu in Version ' + VER));
    a.click('[data-act=newsok]');
    check('Nach OK verschwunden', !/Neu in Version/.test(a.q('#notice').textContent) && a.state().seenVersion === VER);
    a.click('[data-act=nav][data-v=more]');
    check('Version unter „Mehr“ sichtbar', a.q('#view').textContent.includes('Lernkiste Version ' + VER));
  }
  // 16) Vokabeltest-Stapel: Tippen mit automatischer Prüfung
  {
    const ENG = 'englisch-9-2026-11';
    const edeck = JSON.parse([...new JSDOM(HTML).window.document.querySelectorAll('script.lk-deck')].find(e => e.id === 'deck-' + ENG).textContent.replace(/<\\\//g, '</'));
    const card = a => { const h = a.q('h2.q') || a.q('.kcard .sub'); const t = h.textContent.trim(); return edeck.cards.find(c => c.q === t); };
    // Tippfehler im ersten verlangten Begriff (nicht in der Musterantwort: dort können gleichwertige Varianten stehen, z. B. ep03)
    const typo = c => { const t = c.ok[0].split('|')[0].replace(/\(.*?\)\s*/g, '').trim(); return t.slice(0, -1) + (t.slice(-1) === 'x' ? 'q' : 'x'); };
    const typeIn = (a, sel, val) => a.input(sel, val);
    const a = boot({ 'lernkiste-v1': JSON.stringify({ deck: ENG, seenVersion: VER }) });
    check('Vokabel-Stapel: Startseite zeigt „Vokabeltest“ statt „Probeklausur“', !!a.q('[data-act=vtest]') && !a.q('[data-act=exam]'));
    a.click('[data-act=learn]');
    check('Karteikarte hat Eingabefeld statt Selbsteinschätzung', !!a.q('#vin') && !a.q('[data-act=flip]') && a.q('#vin').getAttribute('autocorrect') === 'off' && a.q('#vin').getAttribute('spellcheck') === 'false');
    a.click('[data-act=vcheck]');
    check('Leere Eingabe wird nicht gewertet', !!a.q('#vin') && !a.q('.ans'));
    // richtig
    let c = card(a), id1 = c.id;
    typeIn(a, '#vin', c.a); a.click('[data-act=vcheck]');
    check('Richtige Antwort → „Richtig!“', /Richtig!/.test(a.q('.zbox.okb').textContent) && !a.q('[data-act=vover]'));
    a.click('[data-act=vnext]'); a.closeModals();
    check('Richtig → Stufe 1, automatisch bewertet', a.state().p[ENG].c[id1].lv === 1 && a.state().p[ENG].c[id1].ok === 1);
    // falsch
    c = card(a); const id2 = c.id;
    typeIn(a, '#vin', 'xyzxyz'); a.click('[data-act=vcheck]');
    check('Falsche Antwort → rot mit Lösung', /nicht richtig/.test(a.q('.zbox.nob').textContent) && !!a.q('.ans') && !!a.q('[data-act=vover]'));
    a.click('[data-act=vnext]'); a.closeModals();
    check('Falsch → Stufe 0, Fehler gezählt', a.state().p[ENG].c[id2].lv === 0 && a.state().p[ENG].c[id2].bad === 1);
    // weiß ich nicht
    c = card(a); const id3 = c.id;
    a.click('[data-act=vskip]');
    check('„Weiß ich nicht“ zeigt Lösung ohne „War doch richtig“', /Keine Antwort/.test(a.q('.zbox.nob').textContent) && !a.q('[data-act=vover]'));
    a.click('[data-act=vnext]'); a.closeModals();
    // Enter-Taste prüft
    c = card(a);
    typeIn(a, '#vin', c.a);
    a.q('#vin').dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    check('Enter-Taste löst „Prüfen“ aus', !!a.q('.zbox.okb'));
    a.click('[data-act=vnext]'); a.closeModals();
    // „War doch richtig“
    c = card(a); const id5 = c.id;
    typeIn(a, '#vin', 'andere übersetzung'); a.click('[data-act=vcheck]'); a.click('[data-act=vover]'); a.closeModals();
    check('„War doch richtig“ wertet als gewusst und wird vermerkt', a.state().p[ENG].c[id5].ok === 1 && a.state().p[ENG].c[id5].vo === 1);
    check('Keine Skriptfehler im Tipp-Modus', !a.errs.length, a.errs.join(';'));

    // Vokabeltest
    const b = boot({ 'lernkiste-v1': JSON.stringify({ deck: ENG, seenVersion: VER }) });
    b.click('[data-act=vtest]');
    check('Vokabeltest: Einstellungen mit Richtung und Anzahl', b.d.querySelectorAll('[data-act=vdir]').length === 3 && b.d.querySelectorAll('[data-act=vnum]').length === 3);
    check('Vokabeltest: Standard ist Rückmeldung sofort', b.d.querySelectorAll('[data-act=vfb]').length === 2 && b.q('[data-act=vfb][data-v=now]').getAttribute('aria-pressed') === 'true');
    // a) Sofort prüfen (Standard)
    b.click('[data-act=vnum][data-v="10"]'); b.click('[data-act=vdir][data-v=en]'); b.click('[data-act=vrun]');
    {
      let okShown = 0, nobShown = 0, noBack = true, sol = true;
      for (let i = 0; i < 10; i++) {
        const cc = card(b);
        if (b.q('[data-act=tback]')) noBack = false;
        b.input('#tin', i < 6 ? cc.a : i === 6 ? 'falsch' : i === 7 ? typo(cc) : '');
        b.click('[data-act=tnext]');
        if (b.q('#tin')) sol = false; // nach „Prüfen“ darf kein Eingabefeld mehr da sein
        if (b.q('.zbox.okb')) okShown++; if (b.q('.zbox.nob')) nobShown++;
        if (!b.q('.ans')) sol = false;
        if (i === 9) check('Sofort prüfen: letzter Knopf heißt „Zum Ergebnis“', /Zum Ergebnis/.test(b.q('[data-act=tnext]').textContent));
        b.click('[data-act=tnext]');
      }
      b.closeModals();
      check('Sofort prüfen: nach jedem Wort Rückmeldung mit Lösung', okShown === 6 && nobShown === 4 && sol, okShown + '/' + nobShown + '/' + sol);
      check('Sofort prüfen: kein „Zurück“ (Antwort nicht nachträglich änderbar)', noBack);
      check('Sofort prüfen: Ergebnis „6 von 10 richtig“, als „sofort geprüft“ gespeichert', /6 von 10 richtig/.test(b.q('.big .n').textContent) && b.state().p[ENG].vtests.length === 1 && b.state().p[ENG].vtests[0].fb === 'now' && b.state().p[ENG].vtests[0].s === 6);
      check('Sofort prüfen: Fehlerliste am Ende bleibt', b.d.querySelectorAll('.card2').length === 4 && !!b.q('[data-act=vfix]'));
      b.click('[data-act=vtest]');
      b.click('[data-act=vfb][data-v=end]');
      check('Einstellung „Erst am Ende“ wird gemerkt', b.state().p[ENG].vset.fb === 'end');
      const z = boot(b.dump()); z.click('[data-act=vtest]');
      check('Einstellung bleibt nach Neustart', z.q('[data-act=vfb][data-v=end]').getAttribute('aria-pressed') === 'true');
    }
    // b) Erst am Ende (wie im Test)
    b.click('[data-act=vrun]');
    let seenAdd = false, langs = new Set();
    for (let i = 0; i < 10; i++) {
      const cc = card(b); if (cc.add) seenAdd = true; langs.add(cc.lang);
      b.input('#tin', i < 7 ? cc.a : i === 7 ? 'falsch' : i === 8 ? typo(cc) : '');
      if (i === 3) check('Erst am Ende: keine Rückmeldung während des Tests', !b.q('.zbox') && !b.q('.ans'));
      b.click('[data-act=tnext]');
    }
    b.closeModals();
    const rec = () => b.state().p[ENG].vtests.slice(-1);
    check('Ergebnis „7 von 10 richtig“', /7 von 10 richtig/.test(b.q('.big .n').textContent), b.q('.big .n') && b.q('.big .n').textContent);
    check('Test nur Richtung Englisch, ohne Zusatzkarten', !seenAdd && langs.size === 1 && langs.has('en'));
    check('Ergebnis genau einmal gespeichert', b.state().p[ENG].vtests.length === 2 && rec()[0].fb === 'end' && rec()[0].s === 7 && rec()[0].n === 10 && rec()[0].dir === 'en');
    check('Fehlerliste: 3 Einträge, leere Antwort ohne „War doch richtig“', b.d.querySelectorAll('.card2').length === 3 && b.d.querySelectorAll('[data-act=tover]').length === 2);
    b.click('[data-act=tover]'); b.click('[data-act=tover]');
    check('„War doch richtig“ korrigiert Ergebnis und wird vermerkt', /9 von 10/.test(b.q('.big .n').textContent) && rec()[0].s === 9 && rec()[0].o === 2 && /selbst als richtig gewertet/.test(b.q('.big').textContent));
    b.click('[data-act=vfix]');
    check('„Fehler üben“ startet Runde mit den Fehlern', !!b.q('#vin') && /1 \/ 1/.test(b.q('.sbar').textContent));
    b.click('[data-act=home]'); b.click('[data-act=nav][data-v=prog]');
    check('Lernstand zeigt Vokabeltest für Eltern', /Vokabeltests/.test(b.q('#view').textContent) && /9\/10/.test(b.q('#view').textContent) && /selbst als richtig gewertet/.test(b.q('#view').textContent));
    const r = boot(b.dump()); r.click('[data-act=nav][data-v=prog]');
    check('Vokabeltest-Ergebnis bleibt nach Neustart', /9\/10/.test(r.q('#view').textContent));
    check('Keine Skriptfehler im Vokabeltest', !b.errs.length && !r.errs.length, b.errs.concat(r.errs).join(';'));

    // Geschichte unverändert
    const g = boot({ 'lernkiste-v1': JSON.stringify({ deck: DECK, seenVersion: VER }) });
    check('Geschichte: weiter Probeklausur, kein Vokabeltest', !!g.q('[data-act=exam]') && !g.q('[data-act=vtest]'));
    g.click('[data-act=learn]');
    check('Geschichte: Karteikarten weiter mit Selbsteinschätzung', !!g.q('[data-act=flip]') && !g.q('#vin'));
    // Fortschritt aus 3.1 bleibt lesbar
    const old = { deck: ENG, seenVersion: '3.1', points: 40, p: { [ENG]: { c: { ep02: { lv: 2, n: 3, due: Date.now() + 9e6, ok: 3, bad: 0, over: 0 } }, tests: [], exam: null } } };
    const m = boot({ 'lernkiste-v1': JSON.stringify(old) });
    check('Fortschritt aus Version 3.1 bleibt erhalten', m.state().p[ENG].c.ep02.lv === 2 && /1 von 104/.test(m.q('.hs').textContent) === false && new RegExp('Neu in Version '+VER.replace('.','\\.')).test(m.q('#notice').textContent) && !m.errs.length, m.q('.hs').textContent);
  }
  // ===== Mathe: Rechentraining (ab 5.0) =====
  {
    const MA = 'mathe-9-2026-11';
    const strip = s => String(s).replace(/\^\{([^}]*)\}/g, '$1').replace(/_\{([^}]*)\}/g, '$1');
    const de = v => String(Math.abs(v) >= 1000 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100).replace('.', ',');
    // unabhängige Nachrechnung (nicht der Rechner der App)
    const ev = (f, vars) => { const n = Object.keys(vars); return new Function(...n, 'pi', 'sqrt', 'cbrt', 'return ' + f.replace(/\^/g, '**'))(...n.map(k => vars[k]), Math.PI, Math.sqrt, Math.cbrt); };
    const mboot = (state = {}) => { const b = boot({ 'lernkiste-v1': JSON.stringify(Object.assign({ deck: MA, seenVersion: VER }, state)) });
      b.md = JSON.parse([...b.d.querySelectorAll('script.lk-deck')].find(e => e.id === 'deck-' + MA).textContent.replace(/<\\\//g, '</'));
      const fill = (t, set) => strip(t.replace(/\[([A-Za-z_]\w*)\]/g, (m, k) => k in set ? de(set[k]) : m));
      b.cur = () => { const tq = b.q('.tq').textContent.trim(); for (const t of b.md.tasks) for (const s of t.sets) if (fill(t.q, s) === tq) { const vars = { ...s }, val = []; t.steps.forEach((st, j) => { if (st.k === 'num') { val[j] = ev(st.f, vars); if (st.as) vars[st.as] = val[j]; } }); return { t, s, val, vars }; } throw new Error('Aufgabe nicht erkannt: ' + tq); };
      b.step = () => { const c = b.cur(), mq = b.q('.mq').textContent.trim(), j = c.t.steps.findIndex(st => strip(st.q) === mq); if (j < 0) throw new Error('Schritt nicht erkannt: ' + mq); return Object.assign(c, { j, st: c.t.steps[j] }); };
      // how: 'ok' | 'unit' (Zahl richtig, Einheit falsch) | Zahl (eigener Wert) | 'skip' | 'pickbad'
      b.answer = (how = 'ok') => { const c = b.step(), st = c.st; let fb;
        if (st.k === 'pick') { const btns = [...b.d.querySelectorAll('[data-act=rcpick]')], right = btns.find(x => x.textContent.trim() === strip(st.o[0])); b.click(how === 'pickbad' ? btns.find(x => x !== right) : right); }
        else if (how === 'skip') b.click('[data-act=rcskip]');
        else { b.input('#rcin', typeof how === 'number' ? de(how) : de(c.val[c.j])); const us = [...b.d.querySelectorAll('[data-act=rcunit]')];
          if (us.length) b.click(how === 'unit' ? us.find(x => x.dataset.v !== st.u) : us.find(x => x.dataset.v === st.u)); b.click('[data-act=rccheck]'); }
        fb = b.q('.zbox[role=status]') ? b.q('.zbox[role=status]').textContent : ''; b.click('[data-act=rcnext]'); b.closeModals(); return fb; };
      b.solveTask = () => { let n = 0; while (!b.q('[data-act=rctask]') && n++ < 12) b.answer('ok'); };
      b.badge = () => b.q('.ctop .badge').textContent;
      return b; };

    // Startseite
    const a = mboot();
    check('Mathe: Rechentraining statt Probeklausur/Vokabeltest', !!a.q('[data-act=calc]') && !a.q('[data-act=exam]') && !a.q('[data-act=vtest]') && !!a.q('[data-act=learn]') && !!a.q('[data-act=test]'));
    // Jede Aufgabe, jeder Zahlensatz: App-Lösungsweg stimmt mit unabhängiger Nachrechnung überein
    {
      let n = 0, bad = [];
      for (const t of a.md.tasks) for (const s of t.sets) { const vars = { ...s }; t.steps.forEach((st, j) => { if (st.k !== 'num') return; const v = ev(st.f, vars); if (st.as) vars[st.as] = v; n++; if (!isFinite(v) || v <= 0) bad.push(t.id + '#' + j); (st.err || []).forEach(e => { let y; try { y = ev(e.f, vars); } catch (x) { y = NaN; } if (isFinite(y) && Math.abs(y - v) <= Math.abs(v) * 0.006) bad.push(t.id + ' Fehlerformel=Lösung ' + e.f + ' ' + JSON.stringify(s)); }); }); }
      check('Mathe: alle Rechenschritte ergeben gültige Werte, keine Fehlerformel trifft die Lösung', n > 200 && !bad.length, n + ' Schritte; ' + bad.slice(0, 4).join(' | '));
    }
    // Geführte Runde, alles richtig
    a.click('[data-act=calc]');
    check('Rechentraining: Einstellungen (Hilfe, Anzahl)', /Automatisch/.test(a.q('#view').textContent) && !!a.q('[data-act=rcmode][data-v=g]') && !!a.q('[data-act=rcnum][data-v="4"]'));
    a.click('[data-act=rcmode][data-v=g]'); a.click('[data-act=rcnum][data-v="4"]'); a.click('[data-act=rcrun]');
    check('Geführt: Aufgabe mit Skizze und Kennzeichnung', /Schritt für Schritt/.test(a.badge()) && !!a.q('.tq') && !!a.q('.gx svg'));
    const topicsSeen = new Set(); let stepsAsked = 0;
    for (let i = 0; i < 4; i++) { const c = a.cur(); topicsSeen.add(c.t.t); let n = 0; while (!a.q('[data-act=rctask]') && n++ < 12) { a.answer('ok'); stepsAsked++; }
      if (i === 0) check('Geführt: Lösungsweg und Merksatz nach der Aufgabe', /Aufgabe richtig/.test(a.q('#view').textContent) && /Lösungsweg/.test(a.q('#view').textContent) && /Merke/.test(a.q('#view').textContent));
      a.click('[data-act=rctask]'); a.closeModals(); }
    check('Geführt: 4 von 4 richtig, Ergebnis-Seite', /4 von 4 Aufgaben richtig/.test(a.q('.big .n').textContent), a.q('.big') ? a.q('.big').textContent : '');
    check('Gemischt: Aufgaben aus verschiedenen Themen', topicsSeen.size === 4, [...topicsSeen].join(','));
    const pm = a.state().p[MA];
    check('Könnensstufe 1 je gelöstem Aufgabentyp gespeichert', Object.values(pm.m).filter(k => k.lv === 1 && k.ok === 1).length === 4 && pm.mtests.length === 1 && pm.mtests[0].s === 4);
    check('Pinguin-Trophäe durch Rechentraining', !!a.state().tro.peng);

    // Automatisch: gekonnte Typen kommen ohne Hilfsschritte, neue geführt
    const b = mboot({ filter: ['ke'], p: { [MA]: { c: {}, tests: [], exam: null, m: { 'kegel-o': { n: 1, ok: 1, lv: 1 }, 'kegel-v': { n: 1, ok: 1, lv: 1 }, 'kegel-sand': { n: 1, ok: 1, lv: 1 } }, mset: { n: 4, mode: 'auto' } } } });
    b.click('[data-act=calc]'); check('Themenfilter gilt im Rechentraining', /3 Aufgabentypen in den gewählten Themen/.test(b.q('#view').textContent));
    b.click('[data-act=rcrun]');
    check('Automatisch: gekonnter Typ „Wie in der Arbeit“', /Wie in der Arbeit/.test(b.badge()) && /auf Papier/.test(b.q('#view').textContent));
    let finalsOnly = true, guard = 0;
    while (!b.q('.big') && guard++ < 40) { if (b.q('[data-act=rctask]')) { b.click('[data-act=rctask]'); b.closeModals(); continue; } const c = b.step(); if (!c.st.final) finalsOnly = false; b.answer('ok'); }
    check('Wie in der Arbeit: nur Endergebnisse gefragt, 3 von 3', finalsOnly && /3 von 3 Aufgaben richtig/.test(b.q('.big .n').textContent));
    check('Könnensstufe 2 („kann es allein“)', Object.values(b.state().p[MA].m).every(k => k.lv === 2));

    // Fehlerdiagnose am Kegel-Volumen
    const kv = () => { const c = mboot({ filter: ['ke'], p: { [MA]: { c: {}, tests: [], exam: null, mset: { n: 4, mode: 'g' } } } }); c.click('[data-act=calc]'); c.click('[data-act=rcrun]'); let g = 0;
      while (c.cur().t.id !== 'kegel-v' && g++ < 5) { c.solveTask(); c.click('[data-act=rctask]'); c.closeModals(); } c.answer('ok'); return c; };
    let c = kv(), cu = c.step();
    let fb = c.answer(cu.val[cu.j] * 3);
    check('Diagnose: ⅓ vergessen wird erkannt', /Leider nicht richtig/.test(fb) && /⅓ vergessen/.test(fb), fb);
    check('Fehler → Aufgabe gilt als nicht gelöst und kommt mit neuen Zahlen wieder', /Noch nicht ganz/.test(c.q('#view').textContent) && /neuen Zahlen wieder/.test(c.q('#view').textContent));
    const before = c.cur().s; let g2 = 0; c.click('[data-act=rctask]');
    while (!c.q('.big') && g2++ < 60) { if (c.q('[data-act=rctask]')) { c.click('[data-act=rctask]'); c.closeModals(); continue; } if (/Zweiter Versuch/.test(c.badge())) break; c.answer('ok'); }
    check('Zweiter Versuch: gleicher Typ, andere Zahlen, geführt', /Zweiter Versuch/.test(c.badge()) && c.cur().t.id === 'kegel-v' && JSON.stringify(c.cur().s) !== JSON.stringify(before));
    c = kv(); fb = c.answer('unit');
    check('Diagnose: Zahl richtig, Einheit falsch → zählt als Fehler', /Einheit stimmt nicht/.test(fb) && /Volumen steht in cm³/.test(fb) && /Noch nicht ganz/.test(c.q('#view').textContent), fb);
    c = kv(); cu = c.step(); fb = c.answer(cu.val[cu.j] * 1.012);
    check('Rundungsfehler: zählt als richtig, mit Hinweis', /ungenau gerundet/.test(fb) && /Rundungsfehler/.test(fb) && /Aufgabe richtig/.test(c.q('#view').textContent), fb);
    c = kv(); cu = c.step(); fb = c.answer(cu.val[cu.j] * 4);
    check('Diagnose: Durchmesser statt Radius', /Durchmesser/.test(fb), fb);
    c = kv(); fb = c.answer('skip');
    check('„Weiß ich nicht“ zeigt die Rechenzeile', /So wird gerechnet/.test(c.q('#view').textContent) || /Lösungsweg/.test(c.q('#view').textContent));
    c = kv(); c.input('#rcin', 'abc'); c.click('[data-act=rccheck]');
    check('Keine Zahl → Hinweis statt Wertung', !c.q('[data-act=rcnext]') && /Zahl/.test(c.d.querySelector('.toast').textContent));
    c.input('#rcin', '37,7'); c.click('[data-act=rccheck]');
    check('Ohne Einheit → Hinweis statt Wertung', !c.q('[data-act=rcnext]') && /Einheit/.test(c.d.querySelector('.toast').textContent));
    // Formelwahl falsch
    c = mboot({ filter: ['ke'], p: { [MA]: { c: {}, tests: [], exam: null, mset: { n: 4, mode: 'g' } } } }); c.click('[data-act=calc]'); c.click('[data-act=rcrun]'); let g3 = 0;
    while (c.cur().t.id !== 'kegel-v' && g3++ < 5) { c.solveTask(); c.click('[data-act=rctask]'); c.closeModals(); }
    fb = c.answer('pickbad'); check('Falsche Formel gewählt → richtige wird gezeigt', /Nicht ganz/.test(fb) && /Richtig ist/.test(fb), fb);

    // Lernstand für Eltern + Neustart
    a.click('[data-act=nav][data-v=prog]');
    const pv = a.q('#view').textContent;
    check('Lernstand: Checkliste und Rechentraining', /Checkliste „Ich kann …“/.test(pv) && /Stand je Aufgabentyp/.test(pv) && /klappt mit Hilfsschritten/.test(pv) && /4\/4/.test(pv));
    const r = mboot(JSON.parse(a.dump()['lernkiste-v1'])); r.click('[data-act=nav][data-v=prog]');
    check('Rechentraining-Stand bleibt nach Neustart', /klappt mit Hilfsschritten/.test(r.q('#view').textContent) && /4\/4/.test(r.q('#view').textContent));
    // Karteikarten mit Skizze auf der Vorderseite, Netz-Karten
    const k = mboot({ filter: ['g'] }); k.click('[data-act=learn]');
    let sawSketch = false; for (let i = 0; i < 12 && k.q('[data-act=flip]'); i++) { if (/Netz|Körper\?/.test(k.q('h2.q').textContent) && k.q('.kcard .gx svg')) sawSketch = true; k.click('[data-act=flip][data-v="2"]'); k.click('[data-act=rate][data-v="2"]'); k.closeModals(); }
    check('Karten „Welches Netz / welcher Körper?“ zeigen die Skizze schon auf der Vorderseite', sawSketch);
    // andere Stapel unverändert
    const g = boot({ 'lernkiste-v1': JSON.stringify({ deck: DECK, seenVersion: VER }) });
    check('Geschichte/Englisch: kein Rechentraining', !g.q('[data-act=calc]') && !!g.q('[data-act=exam]'));
    const all = [a, b, c, k, r, g].flatMap(x => x.errs);
    check('Keine Skriptfehler im Rechentraining', !all.length, all.join(';'));
  }
  // Ausgabe
  const w = Math.max(...results.map(r => r.name.length));
  results.forEach(r => console.log((r.ok ? '✅ ' : '❌ ') + r.name.padEnd(w) + (r.ok || !r.detail ? '' : '  → ' + r.detail)));
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} bestanden`);
  process.exit(bad ? 1 : 0);
})();
