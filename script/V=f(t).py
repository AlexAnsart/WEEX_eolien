# -*- coding: utf-8 -*-
"""
Created on Mon Mar 23 11:45:03 2026

@author: vauti
"""

# -*- coding: utf-8 -*-
"""
Created on Mon Mar 23 11:38:31 2026

@author: vauti
"""

import pandas as pd
import matplotlib.pyplot as plt

# Lire le fichier (séparateur tabulation)
df = pd.read_csv("donnees.txt", sep="\t")

# Nettoyer les noms de colonnes (enlever espaces invisibles)
df.columns = df.columns.str.strip()
df = df[df["Statut"] == 1]
print(df[["Vitess_Vent_[m/s]","Temp[degC]"]].corr())

# Garder seulement les données valides

df = df[0:100]


# Extraire variables
Temp = df["Temp[degC]"]
Pelec = df["Vitess_Vent_[m/s]"]

# Créer le graphe
plt.figure()
plt.scatter(Temp, Pelec)

plt.xlabel("Température (°C)")
plt.ylabel("vitesse du vent (m/s)")
plt.title("vitesse du vent en fonction de Température")

plt.grid()

plt.show()
