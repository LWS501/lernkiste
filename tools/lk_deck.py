#!/usr/bin/env python3
"""Lernkiste-Stapel prüfen und in index.html einbauen.

  python3 lk_deck.py validate deck.json
  python3 lk_deck.py list index.html
  python3 lk_deck.py add index.html deck.json [--out neu.html]   (gleiche id = ersetzen)
  python3 lk_deck.py remove index.html <deck-id> [--out neu.html]
"""
import json, re, sys

START, END = "<!-- @@LK-DECKS-START@@ -->", "<!-- @@LK-DECKS-END@@ -->"
BLOCK = re.compile(r'<script type="application/json" class="lk-deck" id="deck-([^"]+)">(.*?)</script>', re.S)
KINDS = {"wheel", "pyramid", "steps", "timeline", "list"}
SHAPES = {"quader", "zylinder", "kegel", "pyramide", "kugel", "prisma", "netz-zylinder", "netz-kegel", "netz-pyramide", "eiswaffel", "turm"}
NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def validate_tasks(d, tids, gr, E, warn):
    """Rechenaufgaben (kind=math): Vorlagen mit Zahlensätzen und Rechenschritten."""
    tasks = d.get("tasks")
    if tasks is None:
        if d.get("kind") == "math":
            warn.append("kind=math ohne Rechenaufgaben (tasks) – es gibt dann kein Rechentraining")
        return
    if not isinstance(tasks, list):
        E("tasks muss eine Liste sein")
        return
    seen = set()
    for i, t in enumerate(tasks):
        n = f"Rechenaufgabe {t.get('id', i) if isinstance(t, dict) else i}"
        if not isinstance(t, dict) or not t.get("id") or t["id"] in seen or not t.get("n") or not t.get("q") or t.get("t") not in tids:
            E(f"{n}: id (eindeutig), n, q und Thema t nötig")
            continue
        seen.add(t["id"])
        if t.get("g") is not None and t["g"] not in gr:
            E(f"{n}: Grafik {t['g']} existiert nicht")
        sets = t.get("sets")
        if not (isinstance(sets, list) and sets and all(isinstance(s, dict) and s and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in s.values()) for s in sets)):
            E(f"{n}: sets muss eine Liste von Zahlensätzen sein")
            continue
        if len(sets) < 3:
            warn.append(f"{n}: weniger als 3 Zahlensätze – die Aufgabe wiederholt sich schnell")
        known = set(sets[0]) | {"pi", "sqrt", "cbrt"}
        if any(set(s) != set(sets[0]) for s in sets):
            E(f"{n}: alle Zahlensätze brauchen dieselben Namen")
        steps = t.get("steps")
        if not (isinstance(steps, list) and steps):
            E(f"{n}: steps fehlen")
            continue
        for j, s in enumerate(steps):
            if not isinstance(s, dict) or not s.get("q") or s.get("k") not in ("pick", "num"):
                E(f"{n}, Schritt {j + 1}: k (pick/num) und q nötig")
                continue
            if s["k"] == "pick":
                o = s.get("o") or []
                if len(o) < 2 or len(set(o)) != len(o):
                    E(f"{n}, Schritt {j + 1}: o braucht mind. 2 verschiedene Formeln (richtige zuerst)")
                continue
            exprs = [s.get("f")] + [e.get("f") for e in s.get("err") or []]
            for f in exprs:
                if not isinstance(f, str) or not f.strip():
                    E(f"{n}, Schritt {j + 1}: Rechenausdruck f fehlt")
                    continue
                unknown = set(NAME.findall(f)) - known
                if unknown or not re.fullmatch(r"[A-Za-z0-9_ .+\-*/^()]+", f):
                    E(f"{n}, Schritt {j + 1}: unbekannte Namen oder Zeichen in „{f}“ {sorted(unknown)}")
            if any(not e.get("m") for e in s.get("err") or []):
                E(f"{n}, Schritt {j + 1}: Fehlerhinweis ohne Text m")
            for name in re.findall(r"\[([A-Za-z_][A-Za-z0-9_]*)\]", s.get("w") or ""):
                if name not in known:
                    E(f"{n}, Schritt {j + 1}: Platzhalter [{name}] unbekannt")
            if s.get("as"):
                known.add(s["as"])
        if not any(isinstance(s, dict) and s.get("k") == "num" and s.get("final") for s in steps):
            warn.append(f"{n}: kein Schritt mit final – „wie in der Arbeit“ fragt dann nur den letzten Schritt")
        for name in re.findall(r"\[([A-Za-z_][A-Za-z0-9_]*)\]", t["q"]):
            if name not in sets[0]:
                E(f"{n}: Platzhalter [{name}] im Text hat keinen Wert")
    for c in d.get("checklist") or []:
        for tid in c.get("tasks") or []:
            if tid not in seen:
                E(f"Checkliste „{c.get('n')}“: Aufgabe {tid} gibt es nicht")


def validate(d):
    err, warn = [], []
    E = err.append
    if not isinstance(d, dict):
        return ["Stapel ist kein Objekt"], []
    if not re.fullmatch(r"[a-z0-9-]{3,60}", str(d.get("id", ""))):
        E("id fehlt oder ungültig (nur a-z, 0-9, -)")
    for k in ("title", "subject"):
        if not str(d.get(k, "")).strip():
            E(f"{k} fehlt")
    if d.get("examDate") and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d["examDate"]):
        E("examDate muss YYYY-MM-DD sein")
    if d.get("kind") not in (None, "vocab", "math"):
        E("kind (Prüfungsart) muss fehlen oder \"vocab\" bzw. \"math\" sein")
    if d.get("kind") == "vocab" and not any(isinstance(c, dict) and c.get("ok") for c in (d.get("cards") or [])):
        E("kind=vocab, aber keine Karte hat gültige Antworten (ok)")
    topics = d.get("topics") or []
    tids = [t.get("id") for t in topics]
    if not topics:
        E("topics fehlen")
    if len(set(tids)) != len(tids):
        E("doppelte Themen-ids")
    for t in topics:
        if not t.get("n"):
            E(f"Thema {t.get('id')}: Name n fehlt")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(t.get("c", ""))):
            E(f"Thema {t.get('id')}: Farbe c muss #rrggbb sein")
    gr = d.get("graphics") or {}
    for gid, g in gr.items():
        if g.get("k") == "shape":
            if g.get("s") not in SHAPES:
                E(f"Grafik {gid}: Skizze s muss eines von {sorted(SHAPES)} sein")
            continue
        if g.get("k") not in KINDS:
            E(f"Grafik {gid}: k muss eines von {sorted(KINDS)} sein")
            continue
        it = g.get("items") or []
        if not it:
            E(f"Grafik {gid}: items leer")
        if g["k"] in ("timeline", "list") and not all(isinstance(x, list) and len(x) == 2 for x in it):
            E(f"Grafik {gid}: items müssen Paare [links, rechts] sein")
        if g["k"] in ("wheel", "pyramid", "steps") and not all(isinstance(x, str) for x in it):
            E(f"Grafik {gid}: items müssen Texte sein")
        if g["k"] == "wheel" and (not g.get("c") or len(it) > 8 or any(len(x) > 17 for x in it if isinstance(x, str))):
            E(f"Grafik {gid}: wheel braucht c, max. 8 items, je max. 17 Zeichen")
        if g["k"] == "pyramid" and (len(it) > 6 or any(len(x) > 22 for x in it if isinstance(x, str))):
            E(f"Grafik {gid}: pyramid max. 6 Ebenen, je max. 22 Zeichen")
    cards = d.get("cards") or []
    if len(cards) < 5:
        E("weniger als 5 Karten")
    ids = [c.get("id") for c in cards]
    if len(set(ids)) != len(ids):
        E("doppelte Karten-ids")
    for c in cards:
        cid = c.get("id")
        if c.get("t") not in tids:
            E(f"Karte {cid}: Thema t unbekannt")
        for k in ("q", "a"):
            if not str(c.get(k, "")).strip():
                E(f"Karte {cid}: {k} fehlt")
        if "h" in c and not (isinstance(c["h"], list) and all(isinstance(x, str) for x in c["h"])):
            E(f"Karte {cid}: h muss Liste von Texten sein")
        if "s" in c and not (isinstance(c["s"], list) and all(isinstance(x, str) for x in c["s"])):
            E(f"Karte {cid}: s (Lösungsweg) muss Liste von Texten sein")
        mc = c.get("mc")
        if mc is not None:
            o = mc.get("o") or []
            if len(o) < 2 or len(set(o)) != len(o):
                E(f"Karte {cid}: mc.o braucht mind. 2 verschiedene Optionen (richtige zuerst)")
        num = c.get("num")
        if num is not None:
            if not isinstance(num.get("v"), (int, float)) or isinstance(num.get("v"), bool):
                E(f"Karte {cid}: num.v muss eine Zahl sein")
            if "tol" in num and not (isinstance(num["tol"], (int, float)) and 0 <= num["tol"] < 1):
                E(f"Karte {cid}: num.tol relativ zwischen 0 und 1 (z. B. 0.02)")
            if not c.get("s"):
                warn.append(f"Karte {cid}: Rechenkarte ohne Lösungsweg s")
        ok = c.get("ok")
        if ok is not None:
            if not (isinstance(ok, list) and ok and all(isinstance(x, str) and x.strip() for x in ok)):
                E(f"Karte {cid}: ok muss eine nicht leere Liste von Texten sein (Schreibweisen mit | trennen)")
            elif "need" in c and not (isinstance(c["need"], int) and 1 <= c["need"] <= len(ok)):
                E(f"Karte {cid}: need muss zwischen 1 und der Zahl der ok-Gruppen liegen")
            elif len(ok) > 1 and "need" not in c:
                warn.append(f"Karte {cid}: mehrere ok-Gruppen ohne need – es reicht dann eine")
            if d.get("kind") != "vocab":
                warn.append(f"Karte {cid}: ok wird nur bei kind=vocab ausgewertet")
        if "all" in c and not (isinstance(c["all"], list) and all(isinstance(x, str) and x.strip() for x in c["all"])):
            E(f"Karte {cid}: all muss Liste von Texten sein")
        if "lang" in c and c["lang"] not in ("en", "de"):
            E(f"Karte {cid}: lang muss en oder de sein")
        if c.get("g") is not None:
            if c["g"] not in gr:
                E(f"Karte {cid}: Grafik {c['g']} existiert nicht")
            elif c.get("hl") is not None and not (isinstance(c["hl"], int) and 0 <= c["hl"] < len(gr[c["g"]].get("items", []))):
                E(f"Karte {cid}: hl außerhalb der Grafik")
        for k, v in c.items():
            if isinstance(v, str) and ("{" in v or "}" in v) and not re.fullmatch(r"(?:[^{}]|[\^_]\{[^{}]*\})*", v):
                E(f"Karte {cid}.{k}: geschweifte Klammern nur als ^{{…}} oder _{{…}}")
    for t in tids:
        if not any(c.get("t") == t for c in cards):
            E(f"Thema {t} hat keine Karten")
    if cards and sum(1 for c in cards if c.get("mc")) < max(5, len(cards) // 2):
        warn.append("wenig Quizfragen (mc) – Ziel: mind. die Hälfte der Karten")
    for i, m in enumerate(d.get("match") or []):
        p = m.get("p") or []
        if not m.get("n") or not (3 <= len(p) <= 8):
            E(f"Zuordnen {i}: Name n und 3–8 Paare nötig")
        if len({x[0] for x in p}) != len(p) or len({x[1] for x in p}) != len(p):
            E(f"Zuordnen {i}: linke und rechte Seiten müssen eindeutig sein")
    for i, x in enumerate(d.get("exam") or []):
        if x.get("t") not in tids or not x.get("q") or not x.get("p"):
            E(f"Probeklausur {i}: t, q und p nötig")
    if not d.get("match"):
        warn.append("kein Zuordnen-Set")
    if not d.get("exam") and not d.get("tasks"):
        warn.append("keine Probeklausur")
    validate_tasks(d, tids, gr, E, warn)
    cids = set(ids)
    for c in d.get("checklist") or []:
        if not c.get("n"):
            E("Checkliste: Eintrag ohne Text n")
        for cid in c.get("cards") or []:
            if cid not in cids:
                E(f"Checkliste „{c.get('n')}“: Karte {cid} gibt es nicht")
    return err, warn


def read_blocks(html):
    if START not in html or END not in html:
        sys.exit("Marker @@LK-DECKS-START/END@@ fehlen – falsche index.html?")
    return [(m.group(1), json.loads(m.group(2).replace("<\\/", "</"))) for m in BLOCK.finditer(html)]


def write_blocks(html, decks):
    body = "\n".join(
        f'<script type="application/json" class="lk-deck" id="deck-{d["id"]}">'
        + json.dumps(d, ensure_ascii=False).replace("</", "<\\/") + "</script>" for d in decks)
    a, b = html.index(START) + len(START), html.index(END)
    return html[:a] + "\n" + body + "\n" + html[b:]


def out_path(args, default):
    return args[args.index("--out") + 1] if "--out" in args else default


def main(a):
    if len(a) < 2:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == "validate":
        d = json.load(open(a[1], encoding="utf-8"))
        err, warn = validate(d)
        for w in warn:
            print("WARNUNG:", w)
        for e in err:
            print("FEHLER:", e)
        print(f"{d.get('id')}: {len(d.get('cards', []))} Karten, {len(d.get('topics', []))} Themen, "
              f"{len(d.get('match', []))} Zuordnen, {len(d.get('exam', []))} Klausuraufgaben")
        sys.exit(1 if err else 0)
    html = open(a[1], encoding="utf-8").read()
    decks = [d for _, d in read_blocks(html)]
    if cmd == "list":
        for d in decks:
            print(f"{d['id']} | {d.get('subject')} | {d.get('title')} | Arbeit {d.get('examDate')} | {len(d['cards'])} Karten")
        return
    if cmd == "add":
        new = json.load(open(a[2], encoding="utf-8"))
        err, warn = validate(new)
        if err:
            for e in err:
                print("FEHLER:", e)
            sys.exit(1)
        for w in warn:
            print("WARNUNG:", w)
        replaced = any(d["id"] == new["id"] for d in decks)
        decks = [new if d["id"] == new["id"] else d for d in decks] + ([] if replaced else [new])
        p = out_path(a, a[1])
        open(p, "w", encoding="utf-8").write(write_blocks(html, decks))
        print(("ersetzt: " if replaced else "hinzugefügt: ") + new["id"], "→", p)
        return
    if cmd == "remove":
        decks = [d for d in decks if d["id"] != a[2]]
        p = out_path(a, a[1])
        open(p, "w", encoding="utf-8").write(write_blocks(html, decks))
        print("entfernt:", a[2], "→", p)
        return
    sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
