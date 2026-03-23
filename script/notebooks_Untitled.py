

import pandas as pd
import matplotlib.pyplot as plt

# Lire le fichier (séparateur tabulation)
df = pd.read_csv("donnees.txt", sep="\t")

# Nettoyer les noms de colonnes (enlever espaces invisibles)
df.columns = df.columns.str.strip()

# Garder seulement les données valides
df = df[df["Statut"] == 1]

# Extraire variables
Temp = df["Temp[degC]"]
Pelec = df["Pelec[w]"]

# Créer le graphe
plt.figure()
plt.scatter(Temp, Pelec)

plt.xlabel("Température (°C)")
plt.ylabel("Puissance électrique Pelec (W)")
plt.title("Pelec en fonction de Température")

plt.grid()

plt.show()



