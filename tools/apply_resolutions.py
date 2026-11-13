"""Write the research decisions on open questions into data/twins.json.

Input: JSON files with one object per question point (pid "record#kind", status, decision, keep, source_url, quote, ...),
as produced by the research and checked by an independent second pass.
Usage: python tools/apply_resolutions.py results1.json results2.json ...

What it does
- stores every decision under objects[record].resolutions[pid], with the date it was checked
- for a settled source difference with a value to keep, updates that value in specs when the label matches,
  and keeps the earlier value in the quote note
- for a settled missing quote, stores the quotes on the matching values
- positions are not changed here, they are listed for a separate check
It never removes the list of differences, so the page still shows what was in question and how it was settled.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATE = '13 November 2026'
BAD = re.compile('[–—·…;]')


def tidy(s):
    if not isinstance(s, str):
        return s
    s = re.sub(r'\s*[–—]\s*', ', ', s)
    s = s.replace('…', '...').replace('·', ', ')
    s = re.sub(r'\s*;\s*', ', ', s)
    return re.sub(r'\s+', ' ', s).strip()


def main(files):
    path = os.path.join(ROOT, 'data/twins.json')
    twins = json.load(open(path, encoding='utf-8'))
    objs = twins['objects']
    changed, quoted, stored, positions, skipped = [], 0, 0, [], []
    for f in files:
        for r in json.load(open(f, encoding='utf-8')):
            pid = r.get('pid', '')
            rid, _, kind = pid.partition('#')
            if rid not in objs or r.get('status') not in ('resolved', 'partly', 'unresolved'):
                skipped.append(pid); continue
            url = r.get('source_url') or ''
            if url and not re.match(r'^https?://', url):
                url = ''
            if r['status'] != 'unresolved' and not url and kind != 'quote':
                r['status'] = 'unresolved'; r['tried'] = (r.get('tried') or '') + ' No source link was given, so it stays open.'
            rec = {k: r.get(k) for k in ('status', 'decision', 'keep', 'source_title', 'source_date', 'rank', 'quote', 'tried')}
            rec = {k: (tidy(v) if k != 'quote' else v) for k, v in rec.items() if v not in (None, '', [], {})}
            if url:
                rec['source_url'] = url
            rec['checked'] = DATE
            if r.get('verified') is not None:
                rec['second_check'] = r['verified']
            o = objs[rid]
            o.setdefault('resolutions', {})[pid] = rec
            stored += 1
            specs = o.get('specs', [])
            keep = r.get('keep') or {}
            if r['status'] == 'resolved' and kind.startswith('differ') and keep.get('label') and keep.get('value') and url:
                norm = lambda x: re.sub(r'\s*\(.*?\)', '', str(x)).strip().lower()
                lab = keep['label'].strip().lower()
                exact = [s for s in specs if s.get('label', '').strip().lower() == lab]
                loose = [s for s in specs if norm(s.get('label', '')) == norm(lab)]
                for s in (exact or (loose if len(loose) == 1 else [])):
                        old = tidy(f"{s.get('value')} {s.get('unit') or ''}".strip())
                        new = str(keep['value']).strip()
                        if str(s.get('value')).strip() != new or (keep.get('unit') and keep.get('unit') != s.get('unit')):
                            s['value'] = new
                            if keep.get('unit') is not None:
                                s['unit'] = keep.get('unit')
                            s['source'] = url
                            if r.get('quote'):
                                s['quote'] = r['quote']
                            s['quote_note'] = f'Settled on {DATE} from the source that ranks highest (ZAG, owner or official, then the latest). Shown before: {old}.'
                            s.pop('quote_checked', None)
                            changed.append((rid, s['label'], old, new))
                        break
            if kind == 'quote' and r.get('quotes'):
                for q in r['quotes']:
                    for s in specs:
                        if s.get('label', '').strip().lower() == str(q.get('label', '')).strip().lower() and not s.get('quote') and q.get('quote'):
                            if q.get('source_url') and q['source_url'] != s.get('source'):
                                continue
                            s['quote'] = q['quote']; s['quote_note'] = f'Copied from the source on {DATE}.'; quoted += 1
            if kind == 'position' and r.get('position') and r['status'] == 'resolved':
                positions.append((rid, r['position']))
    json.dump(twins, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('stored', stored, 'values changed', len(changed), 'quotes added', quoted, 'skipped', skipped)
    for c in changed:
        print('  changed', c)
    for p in positions:
        print('  position to check', p)


if __name__ == '__main__':
    main(sys.argv[1:])
