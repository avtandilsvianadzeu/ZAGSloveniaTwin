"""Carry out a ZAGBot value request without any AI, and only when the source confirms it.

Input: the request as written by ZAGBot on the atlas (sections "### Record", "### What", "### Value",
"### Now shown", "### Should be", "### Source"), read from the file given as the first argument.
Output: the answer for the issue in zagbot_answer.md, and the exit code 0 when the request was applied,
3 when it was not a value request (another path may handle it), 2 when the source did not confirm the value.

What it checks before changing anything
- the record exists in data/twins.json
- the source is a public http(s) page or PDF that opens
- every number in the new value appears in the text of the source (decimal comma or point, with or without thousands separators)
Then it updates the one specification, stores the sentence of the source that contains the value as the quote,
and keeps the previous value in the note. Nothing else is touched.
"""
import html as H, io, json, os, re, subprocess, sys, tempfile, urllib.request
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TODAY = date.today().strftime('%-d %B %Y')
UA = 'Mozilla/5.0 (compatible; ZAG Digital Atlas request check)'


def answer(text, code):
    open(os.path.join(ROOT, 'zagbot_answer.md'), 'w', encoding='utf-8').write(text.strip() + '\n')
    print(text)
    sys.exit(code)


def section(md, name):
    m = re.search(r'^### ' + re.escape(name) + r'\s*\n+(.*?)(?=^### |\Z)', md, re.S | re.M)
    return m.group(1).strip() if m else ''


def fetch_text(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=40) as r:
        kind = (r.headers.get('content-type') or '').lower()
        raw = r.read(25 * 1024 * 1024)
    if 'pdf' in kind or raw[:5] == b'%PDF-':
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
            f.write(raw); path = f.name
        try:
            out = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True, timeout=120)
            return out.stdout
        finally:
            os.unlink(path)
    text = raw.decode('utf-8', 'ignore')
    text = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', text, flags=re.S | re.I)
    text = re.sub(r'<[^>]+>', ' ', text)
    return H.unescape(text)


def numbers(s):
    """numbers in a value, each as a list of spellings to look for"""
    out = []
    for m in re.finditer(r'\d[\d.,\s]*\d|\d', s):
        n = re.sub(r'\s', '', m.group(0))
        plain = n.replace(',', '').replace('.', '')
        forms = {n, n.replace('.', ','), n.replace(',', '.')}
        if re.fullmatch(r'\d+[.,]\d+', n):
            a, b = re.split(r'[.,]', n)
            forms |= {a + '.' + b, a + ',' + b}
        if len(plain) > 3 and re.fullmatch(r'\d+', plain):
            g = '{:,}'.format(int(plain))
            forms |= {g, g.replace(',', '.'), g.replace(',', ' '), plain}
        out.append((n, sorted(forms, key=len, reverse=True)))
    return out


def main(path):
    md = open(path, encoding='utf-8').read()
    rec = section(md, 'Record'); what = section(md, 'What'); label = section(md, 'Value')
    new = section(md, 'Should be'); src = section(md, 'Source'); now = section(md, 'Now shown')
    m = re.search(r'\(([a-z0-9_]+)\)\s*$', rec)
    rid = m.group(1) if m else ''
    if not rid or not label or not new or not what.lower().startswith('a value'):
        answer('This request is not a plain value change, so it waits for the atlas team.', 3)
    url = (re.search(r'https?://\S+', src) or [None])[0] if src else None
    if not url:
        answer('No source link was given, so the value stays as it is. Every value in the atlas needs a published source.', 2)
    if re.search(r'not known', new, re.I):
        answer('The request asks for the published value without giving one. The atlas team will look it up.', 3)
    tw_path = os.path.join(ROOT, 'data/twins.json')
    twins = json.load(open(tw_path, encoding='utf-8'))
    obj = twins['objects'].get(rid)
    if not obj:
        answer(f'No record with the id {rid} exists, so nothing was changed.', 2)
    try:
        text = fetch_text(url)
    except Exception as e:
        answer(f'The source could not be opened ({type(e).__name__}), so the value stays as it is. Source: {url}', 2)
    flat = re.sub(r'\s+', ' ', text)
    nums = numbers(new)
    if not nums:
        answer('The new value has no number in it, so it cannot be checked automatically. The atlas team will read it.', 3)
    missing = [n for n, forms in nums if not any(f in flat for f in forms)]
    if missing:
        answer(f'The source does not contain the value {", ".join(missing)}, so the value stays as it is. Source: {url}', 2)
    # the sentence of the source that holds the first number, as the quote
    first = nums[0][1]
    pos = min((flat.find(f) for f in first if f in flat), default=-1)
    start = max(0, pos - 110); end = min(len(flat), pos + 110)
    quote = flat[start:end]
    quote = quote[quote.find(' ') + 1 if start > 0 else 0:]
    if end < len(flat): quote = quote[:quote.rfind(' ')]
    quote = quote.strip()
    # unit: the trailing letters of the value, for example "31.35 m" -> value 31.35, unit m
    um = re.fullmatch(r'\s*([\d.,\s]+?)\s*([A-Za-z°%²³/]+(?:\s*[A-Za-z°%²³/]+)?)?\s*', new)
    value, unit = (um.group(1).strip(), (um.group(2) or '').strip()) if um else (new.strip(), '')
    specs = obj.setdefault('specs', [])
    lab = label.strip().lower()
    hit = next((s for s in specs if (s.get('label') or '').strip().lower() == lab), None)
    note = f'Copied from the source on {TODAY}.' + (f' Shown before: {now}.' if now else '')
    if hit:
        old = f"{hit.get('value')} {hit.get('unit') or ''}".strip()
        hit.update({'value': value, 'unit': unit or hit.get('unit') or '', 'source': url, 'quote': quote, 'quote_note': note})
        hit.pop('quote_checked', None)
        change = f'{label}: {old} is now {value} {unit or hit.get("unit") or ""}'.strip()
    else:
        specs.append({'label': label.strip(), 'value': value, 'unit': unit, 'source': url, 'quote': quote, 'quote_note': note})
        change = f'{label}: added {value} {unit}'.strip()
    json.dump(twins, open(tw_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    answer(f'Applied to {rec}.\n\n{change}.\n\nThe source confirms it: "{quote}"\n\nSource: {url}', 0)


if __name__ == '__main__':
    main(sys.argv[1])
