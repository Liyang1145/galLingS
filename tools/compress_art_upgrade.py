"""Create high-quality playback copies without resizing or altering PNG masters."""
import hashlib
import json
from PIL import Image
from produce_art_upgrade import ART, MANIFEST, output

def build():
    state=json.loads(MANIFEST.read_text(encoding='utf-8'))
    reviews=json.loads((ART/'reviews.json').read_text(encoding='utf-8'))
    folder=ART/'runtime';folder.mkdir(exist_ok=True)
    index=ART/'runtime-manifest.json'
    previous=json.loads(index.read_text(encoding='utf-8')) if index.exists() else {'items':{}}
    items=previous['items']
    for key,item in state['items'].items():
        review=reviews.get(key,{})
        reviewed_status=review.get('status') if review.get('sha256')==item.get('sha256') else item.get('review')
        if item['status']!='generated' or reviewed_status!='approved':continue
        source=output(key);digest=hashlib.sha256(source.read_bytes()).hexdigest()
        assert digest==item['sha256']
        target=folder/(key+'.webp')
        if items.get(key,{}).get('sourceSha256')==digest and target.exists():continue
        with Image.open(source) as image:
            image.load();size=image.size
            lossless=item['kind']=='sprite'
            image.save(target,'WEBP',lossless=lossless,quality=95,method=6)
            with Image.open(target) as encoded:
                assert encoded.size==size
                if lossless:
                    assert encoded.convert('RGBA').getchannel('A').tobytes()==image.convert('RGBA').getchannel('A').tobytes()
        items[key]={'path':target.relative_to(ART.parents[2]).as_posix(),
                    'sourceMasterPath':item['file'],'sourceSha256':digest,
                    'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,
                    'sourceBytes':source.stat().st_size,'size':list(size),'lossless':lossless,'webpQuality':95,
                    'resized':False,'backendQuality':item['generation'].get('backend_reported_quality'),
                    'backendModel':item['generation'].get('backend_reported_model')}
    index.write_text(json.dumps({'scope':'Approved art only; original PNGs are retained; no upscaling','items':items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'items':len(items),'originalBytes':sum(i['sourceBytes'] for i in items.values()),'runtimeBytes':sum(i['bytes'] for i in items.values())}))
    return items

if __name__=='__main__':build()
