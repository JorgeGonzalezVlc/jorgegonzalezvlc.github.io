---
title: Análisis de logs y tráfico de red 
date: 2026-01-25
categories: [Defensive]
tags: [SOC, Log Analysis, Incident Response, PCAP, Web Attack]
---


## Introducción

En este laboratorio se realiza un análisis de **logs de seguridad** y un **archivo PCAP**, con el objetivo de detectar actividad maliciosa, identificar al atacante y confirmar si existió compromiso del sistema.

El escenario simula el flujo de trabajo, donde la detección inicial se realiza mediante logs y posteriormente se valida el impacto mediante análisis de tráfico de red.

---

## Preparación del entorno

Se descarga y descomprime el fichero proporcionado por la plataforma.  
Dentro del archivo se encuentran dos ficheros principales:

- `meerkat-alerts.json` → Registro de alertas
- `meerkat.pcap` → Captura de tráfico de red

<img width="635" height="413" alt="imagen" src="https://github.com/user-attachments/assets/ed74fb38-d4d2-4cbc-a13a-d33d1e72de50" />


---

## Análisis del archivo JSON

El archivo `meerkat-alerts.json` contiene múltiples eventos de seguridad, por lo que se utiliza la herramienta **jq** para facilitar su análisis.

Tras inspeccionar la estructura de los eventos, se identifican como campos más relevantes:
- `ts`
- `src_ip`
- `dest_ip`
- `alert.signature`

Durante el análisis de las firmas de alerta se detectan múltiples eventos relacionados con:

- **Bonitasoft Authorization Bypass**
- **CVE-2022-25237**
- Indicadores de **RCE Upload**
- Peticiones automatizadas con `python-requests`

La dirección IP **138.199.59.221** destaca como principal origen de estas alertas.

<img width="833" height="1162" alt="imagen" src="https://github.com/user-attachments/assets/a00463c1-6d17-4ef3-97d1-e383c73428a3" />


---

## Correlación de alertas por IP

Filtrando únicamente los eventos generados por `138.199.59.221`, se observa una cadena clara de ataque:

1. Bypass de autorización
2. Peticiones automatizadas
3. Intentos de RCE
4. Acciones web posteriores

Esto indica un ataque dirigido y estructurado.

<img width="820" height="641" alt="imagen" src="https://github.com/user-attachments/assets/914da824-f150-4dc6-bc66-bc659cc989bf" />


---

## Análisis del archivo PCAP

Con la IP sospechosa identificada, se analiza el archivo `meerkat.pcap` utilizando **Wireshark**.

Se filtra el tráfico por:
- IP origen
- Protocolo HTTP
- User-Agent sospechoso

Durante el análisis se observan:
- Respuestas HTTP con código **200**
- Envío de credenciales válidas
- Múltiples intentos de login hasta lograr acceso

<img width="1979" height="1202" alt="imagen" src="https://github.com/user-attachments/assets/a9916380-a984-4a52-b648-31600850fda5" />

Esto confirma que el atacante consiguió acceso al sistema.

---

## Persistencia en el sistema

Se identifica una petición GET que descarga un script remoto.  
Dicho script añade una clave pública al archivo: **/home/ubuntu/.ssh/authorized_keys**

<img width="2020" height="826" alt="imagen" src="https://github.com/user-attachments/assets/4e59bc1d-fc39-497c-9122-be0ee85450c9" />
<img width="562" height="154" alt="imagen" src="https://github.com/user-attachments/assets/423b81c6-7792-4fc5-a032-cbfb4b7e63cc" />
<img width="1663" height="138" alt="imagen" src="https://github.com/user-attachments/assets/f1ff24b1-17b8-49a7-9fb6-f7e805b67c9d" />


Esta técnica permite al atacante mantener acceso persistente al sistema vía SSH.

---

## Técnicas identificadas

- Explotación de vulnerabilidad web (CVE-2022-25237)
- Automatización de ataques
- Fuerza bruta / Credential stuffing
- Persistencia mediante claves SSH

---

## Clasificación MITRE ATT&CK

- **Initial Access**: Exploit Public-Facing Application
- **Credential Access**: Brute Force / Credential Stuffing
- **Persistence**:
  - **T1098** – Account Manipulation
  - **T1098.004** – SSH Authorized Keys
- **Severidad**: Alta 

---

## Conclusión

Este análisis demuestra cómo, a partir de alertas de seguridad aparentemente aisladas, es posible identificar y confirmar un compromiso real del sistema mediante la correlación de múltiples fuentes de información.

El uso combinado de logs y tráfico de red permitió reconstruir la secuencia completa del ataque: explotación de una vulnerabilidad conocida, acceso no autorizado, abuso de credenciales y establecimiento de persistencia mediante claves SSH.  

Este tipo de investigación refleja un escenario real de trabajo en un SOC, donde la validación del impacto es clave para diferenciar intentos de ataque de incidentes confirmados y priorizar la respuesta adecuada.


 


