import numpy as np
import plotly.graph_objects as go
import matplotlib.pyplot as plt

# =========================
# PARAMÈTRES À REMPLIR
# =========================

D = 60     # diamètre de l’éolienne (m)  <-- à remplir
eta = 0.4    # rendement global (0 à 1)   <-- à remplir

Patm = 101325      # pression atmosphérique (Pa)
R = 287            # constante air (J/kg/K)

# Vitesses demandées
V1 = 8.1   # m/s
V2 = 10    # m/s

# ========================
# TEMPÉRATURE
# =======================))))àààooo)l))))))))))))))))

# Température de -10°C à 40°C
T_C = np.linspace(-10, 40, 100)

# Conversion en Kelvin
T_K = T_C + 273.15

# =========================
# MASSE VOLUMIQUE
# =========================

rho = Patm / (R * T_K)

# =========================
# PUISSANCE (formule Betz)
# =========================

def puissance(rho, V):
    return eta * (16/27) * 0.5 * rho * V**3 * (np.pi * D**2 / 4)

P=[]
V = np.linspace(0,20,100)
z=0
for v in V:
    if v<15:
        z=v
    P.append(puissance(rho,z))
plt.plot(V,P)
plt.show()


P1 = puissance(rho, V1)
P2 = puissance(rho, V2)

# =========================
# GRAPHE INTERACTIF
# =========================
plt.figure()
plt.plot(T_C,P1)
(a,b)=np.polyfit(T_C,P1,1)
print(a,b)
plt.plot(T_C,P2)
(c,d)=np.polyfit(T_C,P2,1)
print(c,d)
plt.show()


'''fig = go.Figure()

fig.add_trace(go.Scatter(
    x=T_C,
    y=P1,
    mode='lines',
    name='V = 8.1 m/s'
))

fig.add_trace(go.Scatter(
    x=T_C,
    y=P2,
    mode='lines',
    name='V = 10 m/s'
))

fig.update_layout(
    title="Puissance P en fonction de la température",
    xaxis_title="Température (°C)",
    yaxis_title="Puissance P (W)"
)

fig.show()'''