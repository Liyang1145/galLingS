"""Archive a generated candidate before one narrowly specified revision."""
import argparse,json,shutil
from produce_art_upgrade import ART,ROOT,output,save

def queue(key,reason,prompt,refs):
 state=json.loads((ART/'production.json').read_text('utf-8'))
 reviews=json.loads((ART/'reviews.json').read_text('utf-8'))
 overrides=json.loads((ART/'overrides.json').read_text('utf-8'))
 item=state['items'][key];arch=f'{key}_rejected_{reason}';assert not output(arch).exists()
 for ext in ['.png','.generation.json','.production.json']:
  p=output(key).with_suffix(ext)
  if p.exists():shutil.copy2(p,output(arch).with_suffix(ext))
 shutil.copy2(ART/'prompts'/f'{key}.txt',ART/'prompts'/f'{arch}.txt')
 item.setdefault('candidateRejections',[]).append({'sha256':item['sha256'],'reason':reason,'file':output(arch).relative_to(ROOT).as_posix()})
 item.update(prompt=prompt,references=refs,dependencies=[],status='queued',review='pending')
 overrides[key].update(prompt=prompt,references=refs,dependencies=[])
 reviews[key]={'sha256':item['sha256'],'status':'rejected','note':reason}
 (ART/'prompts'/f'{key}.txt').write_text(prompt+'\n',encoding='utf-8')
 for name,obj in [('reviews.json',reviews),('overrides.json',overrides)]:
  (ART/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 save(state)

if __name__=='__main__':
 from pathlib import Path
 p=argparse.ArgumentParser();p.add_argument('key');p.add_argument('reason');p.add_argument('prompt_file',type=Path);p.add_argument('--references',nargs='+',required=True);a=p.parse_args()
 queue(a.key,a.reason,a.prompt_file.read_text('utf-8'),a.references)
