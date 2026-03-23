# -*- coding: utf-8 -*-
"""
Created on Mon Jan 24 14:25:00 2022

@author: MASTO
"""
##### Importation Bibliothèque ####
import numpy as np
import PIL
from PIL import Image
###############################

#%%
list_im_lignesA = ['0'+str(i)+'A_2008.png' for i in range(1,10)]+[str(i)+'A_2008.png' for i in range(10,20)]
list_im_lignesB = ['0'+str(i)+'B_2008.png' for i in range(1,10)]+[str(i)+'B_2008.png' for i in range(10,20)]
list_im_lignesC = ['0'+str(i)+'C_2008.png' for i in range(1,10)]+[str(i)+'C_2008.png' for i in range(10,20)]
list_im_lignesD = ['0'+str(i)+'D_2008.png' for i in range(1,10)]+[str(i)+'D_2008.png' for i in range(10,20)]
list_im_lignesE = ['0'+str(i)+'E_2008.png' for i in range(1,10)]+[str(i)+'E_2008.png' for i in range(10,20)]
list_im_lignesF = ['0'+str(i)+'F_2008.png' for i in range(1,10)]+[str(i)+'F_2008.png' for i in range(10,20)]
list_im_lignesG = ['0'+str(i)+'G_2008.png' for i in range(1,10)]+[str(i)+'G_2008.png' for i in range(10,20)]
list_im_lignesH = ['0'+str(i)+'H_2008.png' for i in range(1,10)]+[str(i)+'H_2008.png' for i in range(10,20)]
list_im_lignesI = ['0'+str(i)+'I_2008.png' for i in range(1,10)]+[str(i)+'I_2008.png' for i in range(10,20)]
list_im_lignesJ = ['0'+str(i)+'J_2008.png' for i in range(1,10)]+[str(i)+'J_2008.png' for i in range(10,20)]
list_im_lignesK = ['0'+str(i)+'K_2008.png' for i in range(1,10)]+[str(i)+'K_2008.png' for i in range(10,20)]
list_im_lignesL = ['0'+str(i)+'L_2008.png' for i in range(1,10)]+[str(i)+'L_2008.png' for i in range(10,20)]

imgsA    = [ PIL.Image.open(i) for i in list_im_lignesA ]
imgsB    = [ PIL.Image.open(i) for i in list_im_lignesB ]
imgsC    = [ PIL.Image.open(i) for i in list_im_lignesC ]
imgsD    = [ PIL.Image.open(i) for i in list_im_lignesD ]
imgsE    = [ PIL.Image.open(i) for i in list_im_lignesE ]
imgsF    = [ PIL.Image.open(i) for i in list_im_lignesF ]
imgsG    = [ PIL.Image.open(i) for i in list_im_lignesG ]
imgsH    = [ PIL.Image.open(i) for i in list_im_lignesH ]
imgsI    = [ PIL.Image.open(i) for i in list_im_lignesI ]
imgsJ    = [ PIL.Image.open(i) for i in list_im_lignesJ ]
imgsK    = [ PIL.Image.open(i) for i in list_im_lignesK ]
imgsL    = [ PIL.Image.open(i) for i in list_im_lignesL ]

# pick the image which is the smallest, and resize the others to match it (can be arbitrary image shape here)
min_shape = sorted( [(np.sum(i.size), i.size ) for i in imgsA])[0][1]
imgs_combA = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsA ) )
imgs_combB = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsB ) )
imgs_combC = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsC ) )
imgs_combD = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsD ) )
imgs_combE = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsE ) )
imgs_combF = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsF ) )
imgs_combG = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsG ) )
imgs_combH = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsH ) )
imgs_combI = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsI ) )
imgs_combJ = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsJ ) )
imgs_combK = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsK ) )
imgs_combL = np.hstack( (np.asarray( i.resize(min_shape) ) for i in imgsL ) )


# save that beautiful picture
imgs_combA = PIL.Image.fromarray( imgs_combA)
imgs_combB = PIL.Image.fromarray( imgs_combB)
imgs_combC = PIL.Image.fromarray( imgs_combC)
imgs_combD = PIL.Image.fromarray( imgs_combD)
imgs_combE = PIL.Image.fromarray( imgs_combE)
imgs_combF = PIL.Image.fromarray( imgs_combF)
imgs_combG = PIL.Image.fromarray( imgs_combG)
imgs_combH = PIL.Image.fromarray( imgs_combH)
imgs_combI = PIL.Image.fromarray( imgs_combI)
imgs_combJ = PIL.Image.fromarray( imgs_combJ)
imgs_combK = PIL.Image.fromarray( imgs_combK)
imgs_combL = PIL.Image.fromarray( imgs_combL)

imgs_combA.save('A.png')
imgs_combB.save('B.png')
imgs_combC.save('C.png')
imgs_combD.save('D.png')
imgs_combE.save('E.png')
imgs_combF.save('F.png')
imgs_combG.save('G.png')
imgs_combH.save('H.png')
imgs_combI.save('I.png')
imgs_combJ.save('J.png')
imgs_combK.save('K.png')
imgs_combL.save('L.png')

#%%
lettre=['A','B','C','D','E','F','G','H','I','J','K','L']

list_im = [PIL.Image.open(lettre[i]+'.png') for i in range(12)]
min_shape = sorted( [(np.sum(i.size), i.size ) for i in list_im])[0][1]

imgs_comb = np.vstack( (np.asarray( i.resize(min_shape) ) for i in list_im ) )
imgs_comb = PIL.Image.fromarray( imgs_comb)
imgs_comb.save( 'MAPWindRose.jpg' )

