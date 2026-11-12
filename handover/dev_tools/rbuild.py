import json,glob,base64,subprocess,os,sys,re
S=sys.argv[1]
out={}
for f in sorted(glob.glob('/mnt/user-data/uploads/Downloads/zagr_*.json')+glob.glob('/mnt/user-data/uploads/Downloads/zagq_*.json')):
    try: d=json.load(open(f))
    except Exception as e: print('bad',f,e); continue
    o=d['o']
    for p,v in d['R'].items():
        u=o+p
        if 'e' in v: print('ERR',u,v['e'][:60]); continue
        if v.get('s')!=200: print('status',v.get('s'),u); continue
        if 'b' in v:
            raw=base64.b64decode(v['b'])
            if raw[:4]!=b'%PDF':
                if raw.lstrip()[:1]==b'<':
                    import html as H
                    h=raw.decode('utf8','replace')
                    h=re.sub(r'(?is)<(script|style|noscript)\b.*?</\1>',' ',h)
                    h=re.sub(r'(?i)<(br|/p|/div|/li|/tr|/td|/th|/h[1-6]|/dt|/dd)\b[^>]*>','\n',h)
                    t=H.unescape(re.sub(r'(?s)<[^>]+>',' ',h))
                    t=re.sub(r'[ \t\xa0]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
                    if u not in out or len(out[u]['x'])<len(t): out[u]={'x':t,'kind':'page','file':os.path.basename(f)}
                    continue
                print('notpdf',u,raw[:60]); continue
            fn=S+'/rpdf/'+re.sub(r'[^A-Za-z0-9]+','_',u)[-120:]+'.pdf'
            open(fn,'wb').write(raw)
            t=subprocess.run(['pdftotext','-layout',fn,'-'],capture_output=True).stdout.decode('utf8','replace')
            t2=subprocess.run(['pdftotext',fn,'-'],capture_output=True).stdout.decode('utf8','replace')
            t=t+'\n\n=====\n\n'+t2
            kind='pdf'
        else:
            import html as H2
            t=H2.unescape(v.get('x','')); kind='page'
        if u in out and len(out[u]['x'])>=len(t): continue
        out[u]={'x':t,'kind':kind,'file':os.path.basename(f)}
    if 'live' in d: out[o+'#live']={'x':d['live'],'kind':'page','file':os.path.basename(f)}
out.update(json.load(open(S+'/r/manual.json')))
json.dump(out,open(S+'/r/text.json','w'))
print(len(out))
for u,v in out.items(): print(len(v['x']),v['kind'],u[:110])
