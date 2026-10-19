# 两个常用图像工具：
# graykey(rgb)            灰底(≈199,199,198)抠图 → alpha；连通到边缘的灰区和明显灰像素都清掉
# diff_composite(orig, gen_crop, box)  局部修图：模型输出只按“与原图差异区”羽化合成回原图，其余逐像素不变
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
def graykey(a):
    a=np.asarray(a,float)[...,:3];d=np.abs(a-np.array([199,199,198])).max(-1)
    lab,_=ndimage.label(d<14);edge=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
    bg=np.isin(lab,list(edge))|(d<16);near=ndimage.binary_dilation(bg,iterations=2)&~bg
    al=np.where(bg,0,255).astype(float);al[near]=np.clip((d[near]-6)/30,0,1)*255
    return al
def diff_composite(orig,gen,box,thr=28):
    x0,y0,x1,y1=box;o=np.array(orig.convert('RGBA')).astype(float);sub=o[y0:y1,x0:x1]
    e=np.array(gen.convert('RGBA').resize((x1-x0,y1-y0),Image.LANCZOS)).astype(float)
    d=np.abs(e[...,:3]-sub[...,:3]).max(-1)>thr
    d=ndimage.binary_opening(d);d=ndimage.binary_closing(d,iterations=5);d=ndimage.binary_dilation(d,iterations=5)
    d[:6]=d[-6:]=False;d[:,:6]=d[:,-6:]=False
    m=np.array(Image.fromarray((d*255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[...,None]/255
    o[y0:y1,x0:x1]=e*m+sub*(1-m);return Image.fromarray(np.clip(o,0,255).astype('uint8'),'RGBA')
