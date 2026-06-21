---
layout: post
title: "SOC-ML: aplicando Machine Learning a logs reales de Wazuh"
date: 2026-07-10
categories: [IA & Automatización, Blue Team]
tags: [ML, Wazuh, Python, Isolation Forest, Random Forest, KMeans, Blue Team, SIEM]
image:
  path: /assets/img/ml.png
  alt: SOC-ML
  width: 500
  height: 280
  class: sz-contain
---

Proyecto personal donde aplico tres técnicas de Machine Learning sobre logs reales de mi laboratorio de ciberseguridad. 
La idea es la siguiente: tengo Wazuh corriendo en casa con un par de agentes conectados y quería ver qué podía sacar con ML sin tocar datos de internet. Podría haber descargado un dataset de [HuggingFace](https://huggingface.co/datasets) pero prefería una experiencia más realista aunque los datos sean más limitados.

Es un entorno de pruebas, así que los resultados hay que leerlos con ese contexto en mente.

---

## ¿Qué hace el proyecto?

Aplica tres paradigmas distintos de ML sobre los mismos logs:

| Módulo | Algoritmo | Tipo | Objetivo |
|--------|-----------|------|----------|
| `anomaly.py` | Isolation Forest | No supervisado | Detectar eventos raros |
| `classify.py` | Random Forest | Supervisado | Clasificar severidad |
| `cluster.py` | KMeans | No supervisado | Agrupar comportamientos |

---

## Dataset

Los logs vienen de mi propio Wazuh, exportados directamente desde `/var/ossec/logs/alerts/`. El archivo `data/wazuh_logs.json` contiene **3966 eventos reales** de un servidor Linux con agentes Windows y Linux conectados.

Si quieres usar tus propios logs solo tienes que cambiar la ruta en `main.py`:

```python
df = load_wazuh_logs('data/wazuh_logs.json')
```

---

## Transformación de datos con pandas

Antes de llegar a cualquier modelo hay un paso fundamental: convertir los logs en algo que el modelo pueda entender. Wazuh genera un JSON anidado con 275 columnas entre texto, fechas y campos vacíos. Un modelo 
de ML no puede trabajar con eso directamente.

El proceso tiene dos pasos:

**Paso 1 — `ingest.py`**: `pd.json_normalize` aplana el JSON anidado a una tabla plana de 275 columnas. Un evento que venía así:

```json
{"rule": {"level": 12, "groups": "attack"}, "agent": {"name": "servidor"}}
```

Se convierte en esto:

| rule.level | rule.groups | agent.name |
|------------|-------------|------------|
| 12         | attack      | servidor   |

**Paso 2 — `features.py`**: De las 275 columnas me quedo con las relevantes y las transformo a números:

- **`timestamp` → hora y día de la semana**: Una conexión a las 5am en un entorno de oficina es una anomalía clara. El comportamiento horario es uno de los indicadores más potentes en threat hunting.
- **`rule.level`**: La clasificación de criticidad propia de Wazuh, de 1 a 15. Pieza clave de cualquier análisis.
- **`rule.groups`**: La categoría del evento — authentication, attack, syscheck, vulnerability. Convertida a columnas binarias 0/1.
- **`rule.firedtimes`**: Cuántas veces se ha disparado esa regla. Un valor muy alto puede indicar un ataque persistente o un falso positivo recurrente.
- **`agent.name`**: El equipo que generó el evento. Útil para detectar si un agente concreto está generando demasiado ruido o está comprometido.
- **`data.srcip` y `data.dest_ip`** (frecuencia de aparición): Más que la IP en sí, lo que importa es cuántas veces aparece. Una IP que aparece 400 veces como origen es candidata a investigación. Esto también permite detectar conexiones a servidores externos poco confiables, algo fundamental en threat hunting.


---

## Arquitectura

```
SOC-ML/
├── data/
│   └── wazuh_logs.json       # logs exportados de Wazuh
├── src/
│   ├── ingest.py             # lectura y aplanado del JSON
│   ├── features.py           # selección y transformación de features
│   ├── anomaly.py            # Isolation Forest + gráfica
│   ├── classify.py           # Random Forest + gráfica
│   └── cluster.py            # KMeans + gráfica PCA
├── outputs/                  # gráficas generadas automáticamente
├── main.py                   # pipeline principal
└── requirements.txt
```

---

## Instalación

```bash
git clone https://github.com/TU_USUARIO/SOC-ML
cd SOC-ML
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

---

## Resultados

### Isolation Forest — Detección de Anomalías

El modelo analizó los 3966 eventos y marcó **199 como anómalos** (5% de contaminación configurado). Lo interesante es que no solo detecta eventos de nivel alto — hay anomalías en niveles 3 y 4 que un analista podría ignorar manualmente. Eso es exactamente el valor de este enfoque: el modelo detecta combinaciones raras de features, no solo criticidad alta.

<img width="2083" height="740" alt="anomaly_detection" src="https://github.com/user-attachments/assets/8e2721bc-5ff1-4ae1-9f34-35aa32c0898f" />


---

### Random Forest — Clasificación de Severidad

- Eventos de entrenamiento: **3172**
- Eventos de testeo: **794**
- Precisión: **100%**

La precisión del 100% es llamativa pero tiene una explicación clara: las etiquetas Low/Medium/High se derivan directamente de `rule.level`, que además es la feature más importante con diferencia (0.6 de importancia sobre 1.0). El modelo básicamente aprendió una regla que ya existía en los datos.

En un entorno real usaría etiquetas manuales para que el modelo tenga un reto más real. En un laboratorio de pruebas este resultado es esperable.

<img width="1200" height="750" alt="feature_importance" src="https://github.com/user-attachments/assets/5ba7445c-02ff-4729-9b54-b7f8c5a0631b" />


---

### KMeans — Clustering de Eventos

Agrupé los eventos en 4 clusters:

| Cluster | Eventos | Observación |
|---------|---------|-------------|
| 0 | 2419 | Comportamiento normal, el más numeroso |
| 1 | 535 | Grupo secundario bien definido |
| 2 | 175 | El más pequeño y disperso — merece atención |
| 3 | 837 | Grupo mixto, eventos con características variadas |

El **Cluster 2** es el más interesante. Al ser el grupo más pequeño y con mayor dispersión en la visualización PCA, indica eventos que no encajan bien en ningún patrón claro. En un SOC real sería el primer grupo a revisar manualmente.

<img width="1200" height="900" alt="clusters" src="https://github.com/user-attachments/assets/8a66b6da-2918-464c-bfb1-bbae64d93eec" />


---

## Próximos pasos

- Acumular más logs dejando Wazuh correr durante semanas para tener un dataset más rico
- Usar etiquetas manuales de analistas para un Random Forest más realista
- Investigar el Cluster 2 manualmente para ver qué tienen en común esos eventos
- Añadir un dashboard simple con FastAPI para ver los resultados en tiempo real

---

## Stack

- Python 3.13
- scikit-learn
- pandas
- matplotlib
- Wazuh SIEM

---

## Autor

Jorge — [GitHub](https://github.com/jorgegonzalezvlc)
