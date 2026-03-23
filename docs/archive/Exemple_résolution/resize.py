# -*- coding: utf-8 -*-
"""
Created on Mon Jan 24 14:59:56 2022

@author: Masto
"""
from PIL import Image 
from skimage.transform import resize
import matplotlib.pyplot as plt
import cv2
#%%
im1 = cv2.imread('fond_carte.png')
im2 = cv2.imread('MAPWindRose.jpg')
res1 = cv2.resize(im1, dsize=(int(17100*0.98), int(10800*0.98)), interpolation=cv2.INTER_CUBIC)
res2 = cv2.resize(im2, dsize=(int(17100*0.98), int(10800*0.98)), interpolation=cv2.INTER_CUBIC)

#%%
cv2.imwrite('fond_carte_redim.png',res1)
cv2.imwrite('MAPWindRose_redim.png',res2)
#%%

img = Image.open('MAPWindRose_redim.png')
img = img.convert("RGBA")
datas = img.getdata()

newData = []
for item in datas:
    if item[0] == 255 and item[1] == 255 and item[2] == 255:
        newData.append((255, 255, 255, 0))
    else:
        newData.append(item)

img.putdata(newData)
img.save("MAPWindRose_redim.png", "PNG")

#%%
im1 = Image.open('MAPWindRose_redim.png')
im2 = Image.open('fond_carte_redim.png')
im2 = im2.convert('RGBA')

im3 = Image.blend(im2, im1, 0.4)
#%%
im3.save('Vents_sur_Ile.png')
