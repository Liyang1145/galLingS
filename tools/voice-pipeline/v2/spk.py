import sys,types,numpy as np,librosa,warnings
warnings.filterwarnings('ignore')
sys.modules.setdefault('webrtcvad',types.ModuleType('webrtcvad'))
from resemblyzer import VoiceEncoder
enc=VoiceEncoder('cpu',verbose=False)
def emb(p):
    y,_=librosa.load(p,sr=16000)
    if len(y)<16000*0.6: y=np.tile(y,int(np.ceil(16000*0.6/len(y)))+1)
    return enc.embed_utterance(y.astype(np.float32))
