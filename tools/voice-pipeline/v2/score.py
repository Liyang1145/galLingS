import json,csv,numpy as np,pickle,sys
from concurrent.futures import ProcessPoolExecutor
from feat import feat
if __name__=='__main__':
    rows=list(csv.DictReader(open('鲸鱼小姐_配音_前200句/台词清单.csv',encoding='utf-8-sig')))
    paths=[f"鲸鱼小姐_配音_前200句/语音/{int(r['序号']):03d}_{r['台词ID']}.mp3" for r in rows]
    with ProcessPoolExecutor(8) as ex: F=list(ex.map(feat,paths,[r['台词'] for r in rows]))
    pickle.dump((rows,F),open('feat200.pkl','wb'))
    M=np.array([f['mfcc'] for f in F]); c=np.median(M,0); sd=np.median(np.abs(M-c),0)*1.48+1e-6
    md=np.sqrt((((M-c)/sd)**2).mean(1))
    f0=np.array([f['f0'] for f in F]); cen=np.array([f['cen'] for f in F]); rate=np.array([f['rate'] for f in F])
    z=lambda a:(a-np.nanmedian(a))/(np.nanmedian(np.abs(a-np.nanmedian(a)))*1.48)
    zf,zc,zm,zr=z(f0),z(cen),z(md),z(rate)
    print('median f0',np.nanmedian(f0),'cen',np.median(cen),'rate',np.nanmedian(rate))
    sc=np.nan_to_num(np.abs(zf))+np.abs(zc)+np.maximum(zm,0)
    for k in np.argsort(-sc)[:30]:
        print(rows[k]['序号'],rows[k]['台词'][:16],round(f0[k]),'zf',round(zf[k],1),'zc',round(zc[k],1),'zm',round(zm[k],1),'zr',round(zr[k],1),round(sc[k],1))
    print('032 rank',list(np.argsort(-sc)).index(31), round(zf[31],1),round(zc[31],1),round(zm[31],1),round(zr[31],1))
