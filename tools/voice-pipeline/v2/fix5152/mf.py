import sys,glob,subprocess,numpy as np,json
def load(p):
    b=subprocess.run(['ffmpeg','-loglevel','error','-i',p,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    return np.frombuffer(b,np.int16).astype(np.float32)/32768
M=None
def feat(p):
    global M
    y=load(p); n=512;h=160
    fr=np.lib.stride_tricks.sliding_window_view(y,n)[::h]*np.hanning(n)
    S=np.abs(np.fft.rfft(fr))**2
    if M is None:
        f=np.linspace(0,8000,257); mel=lambda x:2595*np.log10(1+x/700); m=np.linspace(mel(60),mel(7600),42); hz=700*(10**(m/2595)-1)
        M=np.array([np.clip(np.minimum((f-hz[i])/(hz[i+1]-hz[i]),(hz[i+2]-f)/(hz[i+2]-hz[i+1])),0,None) for i in range(40)])
    L=np.log(S@M.T+1e-8); e=L.mean(1); L=L[e>np.percentile(e,40)]
    C=np.real(np.fft.fft(L,axis=1))[:,1:20]  # cepstrum-ish
    return np.concatenate([C.mean(0),C.std(0)])
ref=[feat(p) for p in sorted(glob.glob('鲸鱼小姐_配音_前200句_v2/语音/*.mp3'))]
R=np.array(ref); mu,sd=R.mean(0),R.std(0)+1e-6; Z=(R-mu)/sd; c=Z.mean(0)
def score(p): z=(feat(p)-mu)/sd; return float(-np.linalg.norm(z))
allz=sorted(-np.linalg.norm(Z,axis=1)); print('ref dist pct10/50/90',np.percentile(allz,[10,50,90]).round(2))
for p in sorted(glob.glob('鲸鱼小姐_配音_前200句_v2/语音/05[12]_*'))+sorted(glob.glob('fix5152/raw/*.mp3')): print(p.split('/')[-1],round(score(p),2))
