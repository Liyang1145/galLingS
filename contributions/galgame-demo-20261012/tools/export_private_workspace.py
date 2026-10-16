"""Export a sanitized snapshot without changing original assets or save data.

Usage: python tools/export_private_workspace.py DESTINATION
The destination must be outside this workspace. Review the report before upload.
"""
from pathlib import Path
import os, sys, re, json, hashlib, zipfile, io, struct

ROOT = Path(__file__).resolve().parents[1]
DEST = Path(sys.argv[1]).resolve()
if DEST == ROOT or ROOT in DEST.parents:
    raise SystemExit('Export destination must be outside the workspace')
if DEST.exists() and any(DEST.iterdir()):
    raise SystemExit('Use an empty destination')
DEST.mkdir(parents=True, exist_ok=True)
excluded, changes, manifest, blockers = [], [], [], []
profile = str(Path.home())
root_variants = [str(ROOT), str(ROOT).replace('\\', '/')]
profile_variants = [profile, profile.replace('\\', '/')]
secret_patterns = [
    re.compile(rb'gh[pousr]_[A-Za-z0-9]{24,}'),
    re.compile(rb'github_pat_[A-Za-z0-9_]{40,}'),
    re.compile(rb'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}'),
    re.compile(rb'AIza[0-9A-Za-z_-]{30,}'),
    re.compile(rb'AKIA[0-9A-Z]{16}'),
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
]
private_dirs = {'.git', '.venv', '__pycache__', '.pytest_cache', 'saves', 'test-saves', '.userdata'}
text_ext = {'.md','.txt','.log','.json','.jsonl','.yaml','.yml','.toml','.cfg','.ini',
            '.py','.rpy','.js','.mjs','.cjs','.ts','.html','.css','.bat','.ps1','.xml',
            '.csv','.sh','.rst','.gitignore','.gitattributes','.license'}

def excluded_reason(name):
    parts = Path(name.replace('\\','/')).parts
    if any(p.lower() in private_dirs for p in parts):
        return 'local metadata, environment, bytecode cache, or personal save data'
    if parts and parts[-1].lower() in {'persistent','persistent.bak','save_token.txt'}:
        return 'personal persistent/save identity data'
    if parts and parts[-1].lower().startswith('.env') and not any(x in parts[-1].lower() for x in ['example','sample','template']):
        return 'potential local credentials'
    if parts and parts[-1].lower().endswith('.rpyc'):
        return 'compiled script cache; source retained for rebuild'
    return None

def digest(data): return hashlib.sha256(data).hexdigest()

def scrub_text(data):
    encoding = 'utf-8-sig'
    if data.startswith((b'\xff\xfe',b'\xfe\xff')): encoding='utf-16'
    elif data[:4096].count(b'\x00') > len(data[:4096]) // 5: encoding='utf-16-le'
    try: text = data.decode(encoding)
    except UnicodeError:
        try: text = data.decode('gb18030')
        except UnicodeError: return None
    for p in root_variants:
        text = re.sub(re.escape(p), '.', text, flags=re.I)
        text = re.sub(re.escape(p.replace('\\','\\\\')), '.', text, flags=re.I)
    for p in profile_variants:
        text = re.sub(re.escape(p), '<USERPROFILE>', text, flags=re.I)
        text = re.sub(re.escape(p.replace('\\','\\\\')), '<USERPROFILE>', text, flags=re.I)
    # File URLs serialize profile paths with percent escaping.
    from urllib.parse import quote
    for p in profile_variants:
        text = re.sub(re.escape(quote(p, safe=':/')), '<USERPROFILE>', text, flags=re.I)
    return text.encode('utf-8')

def png_metadata(data):
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): return data
    out=bytearray(data[:8]); pos=8
    while pos+12<=len(data):
        n=struct.unpack('>I',data[pos:pos+4])[0]; end=pos+n+12
        if end>len(data): raise ValueError('Invalid PNG chunk')
        kind=data[pos+4:pos+8]
        if kind not in {b'tEXt',b'zTXt',b'iTXt',b'eXIf'}: out.extend(data[pos:end])
        pos=end
    return bytes(out)

def jpeg_metadata(data):
    if not data.startswith(b'\xff\xd8'): return data
    out=bytearray(data[:2]); pos=2
    while pos<len(data):
        start=pos
        if data[pos]!=255: raise ValueError('Invalid JPEG marker')
        while pos<len(data) and data[pos]==255: pos+=1
        marker=data[pos]; pos+=1
        if marker==0xDA: out.extend(data[start:]); break
        if marker==0xD9: out.extend(data[start:pos]); break
        if marker in {0x01,*range(0xD0,0xD8)}: out.extend(data[start:pos]); continue
        size=int.from_bytes(data[pos:pos+2],'big'); end=pos+size
        if marker not in {0xE1,0xED,0xFE}: out.extend(data[start:end])
        pos=end
    return bytes(out)

def private_markers(data):
    found=[]
    for p in profile_variants:
        for enc in ['utf-8','utf-16-le','utf-16-be']:
            if p.encode(enc).lower() in data.lower(): found.append('local profile path')
        if p.replace('\\','\\\\').encode().lower() in data.lower(): found.append('escaped local profile path')
    if any(p.search(data) for p in secret_patterns): found.append('credential-shaped content')
    return sorted(set(found))

def sanitize(name, data, depth=0):
    if depth>3: raise ValueError('Nested archive limit exceeded')
    before=digest(data)
    if data.startswith(b'PK\x03\x04') and zipfile.is_zipfile(io.BytesIO(data)):
        result=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as z, zipfile.ZipFile(result,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as out:
            for info in z.infolist():
                if info.is_dir(): continue
                if '..' in Path(info.filename).parts or Path(info.filename).is_absolute():
                    raise ValueError('Unsafe archive entry')
                reason=excluded_reason(info.filename)
                entry=name+'!'+info.filename
                if reason: excluded.append({'path':entry,'reason':reason}); continue
                b=sanitize(entry,z.read(info),depth+1)
                out.writestr(info.filename,b)
        data=result.getvalue()
    elif data.startswith(b'\x89PNG'):
        data=png_metadata(data)
    elif data.startswith(b'\xff\xd8'):
        data=jpeg_metadata(data)
    else:
        suffix=Path(name.split('!')[-1]).suffix.lower()
        if suffix in text_ext or Path(name).name.startswith('.') or (b'\x00' not in data[:8192] and len(data)<2_000_000):
            clean=scrub_text(data)
            if clean is not None: data=clean
    hits=private_markers(data)
    # Bundled crypto-library bytecode contains public PEM labels and test fixtures.
    # Keep the shipped SDK library intact; these are not local account credentials.
    vendor = name.split('!')[-1].replace('\\','/')
    public_crypto = re.search(r'/lib/python3\.12/(?:ecdsa/(?:keys|test_ecdh|test_keys|test_pyecdsa)|rsa/(?:key|pem))\.pyc$', vendor)
    if public_crypto and hits == ['credential-shaped content']:
        hits=[]
    if hits: blockers.append({'path':name,'findings':hits})
    if digest(data)!=before: changes.append({'path':name,'action':'sanitized text/metadata/archive'})
    return data

for path in sorted(ROOT.rglob('*')):
    if not path.is_file(): continue
    rel=path.relative_to(ROOT).as_posix()
    reason=excluded_reason(rel)
    if reason:
        excluded.append({'path':rel,'reason':reason}); continue
    if path.is_symlink(): raise SystemExit('Review symbolic links before export')
    data=sanitize(rel,path.read_bytes())
    target=DEST/rel; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
    manifest.append({'path':rel,'size':len(data),'sha256':digest(data)})

report={'status':'PASS' if not blockers else 'BLOCKED','originals_modified':False,
        'scope':'all workspace files except documented privacy/local-state exclusions',
        'exported_files':len(manifest),'excluded':excluded,'sanitized':changes,'blockers':blockers,
        'checks':['UTF8/UTF16 personal profile paths','escaped paths','credential patterns',
                  'recursive ZIP entries','PNG/JPEG metadata removal'],
        'reviewed_false_positives':['bundled ecdsa/rsa PEM labels and public test fixtures in SDK bytecode'],
        'derived_cache_policy':'rpyc and __pycache__ excluded; sources and rebuild tools retained'}
(DEST/'WORKSPACE-MANIFEST.json').write_text(json.dumps({'files':manifest},ensure_ascii=False,indent=2),encoding='utf-8')
(DEST/'PRIVACY-REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':report['status'],'files':len(manifest),'excluded':len(excluded),
                  'sanitized':len(changes),'bytes':sum(x['size'] for x in manifest),
                  'blockers':blockers},ensure_ascii=False))
if blockers: raise SystemExit(2)
