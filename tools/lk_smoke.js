// Lernkiste-Rauchtest: node lk_smoke.js index.html   (braucht jsdom: npm i jsdom@24)
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const html = require('fs').readFileSync(process.argv[2], 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://lws501.github.io/lernkiste/' });
const w = dom.window, d = w.document, errs = [];
w.addEventListener('error', e => errs.push(e.message));
const q = s => d.querySelector(s);
const click = s => { const el = typeof s === 'string' ? q(s) : s; if (!el) throw new Error('fehlt: ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const closeModal = () => { let n = 0; while (q('.modal') && n++ < 30) click('[data-act=closemodal]'); };
const home = () => click('[data-act=nav][data-v=home]');
const report = [];
try {
  home();
  const deckIds = [...d.querySelectorAll('.decks [data-act=deck]')].map(b => b.dataset.v);
  const ids = deckIds.length ? deckIds : [null];
  for (const id of ids) {
    home(); if (id) click(`.decks [data-act=deck][data-v="${id}"]`);
    const name = id || 'einziger Stapel';
    // Karteikarten: alle Bewertungen, Zahlfeld füllen
    click('[data-act=learn]');
    let n = 0;
    for (let i = 0; i < 80 && q('#vin'); i++) { // Vokabel-Stapel: tippen, automatisch geprüft
      const inp = q('#vin'); inp.value = ['famine', 'xx', ''][i % 3]; inp.dispatchEvent(new w.Event('input', { bubbles: true }));
      click(i % 3 === 2 ? '[data-act=vskip]' : '[data-act=vcheck]');
      if (!q('.ans')) throw new Error('Ergebnis ohne Lösung');
      click('[data-act=vnext]'); closeModal(); n++;
      if (q('[data-act=flip]')) { click('[data-act=flip][data-v="1"]'); click('[data-act=rate][data-v="2"]'); closeModal(); n++; }
    }
    for (let i = 0; i < 80 && q('[data-act=flip]'); i++) {
      const inp = q('#numin'); if (inp) { inp.value = '1'; inp.dispatchEvent(new w.Event('input', { bubbles: true })); }
      if (i === 0 && q('[data-act=hint]')) click('[data-act=hint]');
      click(`[data-act=flip][data-v="${i % 3}"]`);
      if (!q('.ans')) throw new Error('Rückseite ohne Antwort');
      click(`[data-act=rate][data-v="${i % 3}"]`); closeModal(); n++;
    }
    report.push(`${name}: Lernrunde ${n} Karten → ${q('.n') ? q('.n').textContent : 'kein Ende?'}`);
    home(); click('[data-act=quiz]');
    for (let i = 0; i < 12 && (q('[data-act=pick]') || q('[data-act=qreveal]')); i++) { if (q('[data-act=qreveal]')) click('[data-act=qreveal]'); click('[data-act=pick][data-v="0"]'); click('[data-act=qnext]'); closeModal(); }
    report.push(`${name}: Quiz → ${q('.n') ? q('.n').textContent : '?'}`);
    home(); click('[data-act=match]');
    if (q('.mcol')) {
      const k = q('.mcol').querySelectorAll('.mi').length;
      for (let j = 0; j < k; j++) { const l = q('[data-act=ml]:not([disabled])'); click(l); click(`[data-act=mr][data-v="${l.dataset.v}"]`); closeModal(); }
      report.push(`${name}: Zuordnen → ${q('.big .n') ? q('.big .n').textContent : '?'}`);
    }
    home();
    if (q('[data-act=vtest]')) { click('[data-act=vtest]'); click('[data-act=vnum][data-v="10"]'); click('[data-act=vrun]'); for (let j = 0; j < 12 && q('#tin'); j++) { const t = q('#tin'); t.value = j % 2 ? 'x' : ''; t.dispatchEvent(new w.Event('input', { bubbles: true })); click('[data-act=tnext]'); closeModal(); } report.push(`${name}: Vokabeltest → ${q('.big .n') ? q('.big .n').textContent : '?'}`); if (q('[data-act=vfix]')) { click('[data-act=vfix]'); click('[data-act=home]'); } }
    home();
    if (q('[data-act=exam]')) { click('[data-act=exam]'); for (let j = 0; j < 12 && q('[data-act=eshow]'); j++) { click('[data-act=eshow]'); click('[data-act=tick][data-v="0"]'); click('[data-act=enext]'); closeModal(); } report.push(`${name}: Probeklausur → ${q('.big .n') ? q('.big .n').textContent : '?'}`); }
    // Tagesrunde (enthält Fehler-Revanchen, sobald fällig)
    home(); if (q('[data-act=daily]')) { click('[data-act=daily]'); let m = 0;
      for (let i = 0; i < 40 && (q('[data-act=flip]') || q('[data-act=revflip]')); i++) { if (q('[data-act=revflip]')) { click('[data-act=revflip]'); click(`[data-act=revrate][data-v="${i % 2 ? 2 : 0}"]`); } else { click('[data-act=flip][data-v="2"]'); click('[data-act=rate][data-v="2"]'); } closeModal(); m++; }
      report.push(`${name}: Tagesrunde ${m} Karten → ${q('.n') ? q('.n').textContent : 'nichts fällig'}`); }
    home(); click('[data-act=test]'); for (let i = 0; i < 14 && q('[data-act=pick]'); i++) { click('[data-act=pick][data-v="1"]'); click('[data-act=qnext]'); closeModal(); }
  }
  click('[data-act=nav][data-v=prog]'); click('[data-act=nav][data-v=tro]'); click('[data-act=nav][data-v=more]');
  report.push('Vorlesen-Standard: ' + (q('[data-act=tts]') ? q('[data-act=tts]').textContent : '?'));
} catch (e) { errs.push('TEST: ' + e.message); }
console.log(report.join('\n'));
console.log(errs.length ? 'FEHLER:\n' + errs.join('\n') : 'OK – keine Fehler');
process.exit(errs.length ? 1 : 0);
