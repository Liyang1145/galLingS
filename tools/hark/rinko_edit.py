# Rinko Image2.5 图像编辑（多图参考）：python rinko_edit.py spec.json
# spec：[{"images":[...],"prompt":"...","out":"x.png","size":"2752x1536","bg":"transparent"}]
# 必须 stream=true；并发 CC<=2；MODEL 默认 gpt-image-2.5-sunburst（用户要求，不可换 gpt-image-2）。
# 鉴权：curl 请求需带 Authorization: Bearer <Rinko key>（Hark 环境由凭据网关注入；别的环境自行加 -H）。
import sys,json,base64,subprocess,os
from PIL import Image
def edit(images,prompt,out,size='2752x1536',bg=None):
    args=['curl','-s','-N','-m','600','https://api.rinko.ai/v1/images/edits','-F','model='+os.environ.get('MODEL','gpt-image-2.5-sunburst'),'-F',f'size={size}','-F','quality=high','-F','stream=true','-F','partial_images=1','-F','prompt='+prompt]
    if bg: args+=['-F',f'background={bg}']
    for im in images: args+=['-F',f'image[]=@{im}']
    for t in range(3):
        r=subprocess.run(args,capture_output=True,text=True)
        for l in r.stdout.splitlines():
            if l.startswith('data:') and 'completed' in l:
                open(out,'wb').write(base64.b64decode(json.loads(l[5:])['b64_json'])); return 'ok'
        err=r.stdout[:150]
    return 'fail '+err
if __name__=='__main__':
    spec=json.load(open(sys.argv[1]))
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(int(os.environ.get("CC","2"))) as ex:
        fut={ex.submit(edit,s['images'],s['prompt'],s['out'],s.get('size','2752x1536'),s.get('bg')):s['out'] for s in spec}
        for f in concurrent.futures.as_completed(fut): print(fut[f],f.result(),flush=True)
