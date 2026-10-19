import librosa,numpy as np,warnings,re
warnings.filterwarnings('ignore')
def feat(p,text=None):
    y,sr=librosa.load(p,sr=16000)
    f0,v,_=librosa.pyin(y,fmin=110,fmax=800,sr=sr,frame_length=1024)
    f=f0[v] if v.sum()>3 else np.array([np.nan])
    S=np.abs(librosa.stft(y,n_fft=1024)); 
    m=librosa.feature.mfcc(S=librosa.power_to_db(librosa.feature.melspectrogram(S=S**2,sr=sr)),n_mfcc=20)
    e=librosa.feature.rms(S=S,frame_length=1024)[0]; keep=e>np.percentile(e,40)
    cen=librosa.feature.spectral_centroid(S=S,sr=sr)[0][keep]
    d=len(y)/sr; n=len(re.sub(r'[^\w]','',text or '')) 
    return dict(f0=float(np.nanmedian(f)),f0hi=float(np.nanpercentile(f,90)) if len(f)>1 else np.nan,cen=float(np.median(cen)),mfcc=m[1:,keep].mean(1),rate=n/d if n else np.nan,dur=d)
