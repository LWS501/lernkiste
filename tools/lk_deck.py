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
    if not d.get("exam"):
        warn.append("keine Probeklausur")
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
