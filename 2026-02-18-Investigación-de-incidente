---
title: Investigación de incidente – Compromiso en host WIN01
date: 2026-02-05
categories: [Defensive]
tags: [SOC, SIEM, Log Analysis, Windows, Incident Response, Threat Hunting]
---

## Resumen

Durante el análisis del host **WIN01** se identificaron múltiples alertas relacionadas con actividades de reconocimiento, acceso no autorizado, ejecución de herramientas maliciosas y mecanismos de persistencia.  

La correlación de eventos confirma un escenario de **compromiso completo del sistema**, incluyendo:

- Enumeración inicial
- Ataques de fuerza bruta
- Acceso privilegiado
- Ejecución de malware
- Persistencia
- Intentos de robo de credenciales

---

## Línea temporal de la actividad

### 1. Enumeración mediante sesión SMB anónima

Se detectó un inicio de sesión de red (Logon Type 3) utilizando la cuenta **ANONYMOUS LOGON**, sin credenciales válidas.

Este comportamiento es característico de **Null Session**, técnica utilizada para enumerar recursos compartidos, usuarios o políticas del sistema.

**Clasificación: True Positive**

---

### 2. Acceso legítimo al proceso LSASS

Se observó la creación del proceso `lsass.exe` iniciado por `wininit.exe` bajo el contexto **SYSTEM**.

La relación padre-hijo y el contexto del proceso corresponden con el comportamiento normal del sistema operativo.

**Clasificación: False Positive**

<img src="https://github.com/user-attachments/assets/0b8bb9d0-3a33-4533-81f1-1d675bd24b86" />

---

### 3. Ataque de fuerza bruta por SMB

Se registraron múltiples intentos fallidos de autenticación desde la IP **10.10.16.14** en un corto periodo de tiempo.

El alto volumen de eventos y el patrón repetitivo indican un ataque de **Password Spraying o Brute Force**.

**Clasificación: True Positive**

<img src="https://github.com/user-attachments/assets/c42310ea-9ccf-4430-910f-6dbc41d4a55f" />

---

### 4. Enumeración de historial de PowerShell

El usuario ejecutó comandos para acceder a: ``ConsoleHost_history.txt``


Este archivo contiene comandos anteriores y puede revelar credenciales o información sensible.  
La actividad forma parte de la fase de **reconocimiento post-compromiso**.

**Clasificación: True Positive**

<img src="https://github.com/user-attachments/assets/88873fbc-3ec4-4604-97c8-16980a0e8134" />

---

### 5. Acceso privilegiado desde IP sospechosa

Se detectó un inicio de sesión remoto exitoso (Logon Type 10 – RDP) con la cuenta **Administrator** desde la IP **10.10.16.14**, previamente asociada a actividad maliciosa.

Este evento confirma **acceso interactivo con privilegios elevados**.

**Clasificación: True Positive**

<img src="https://github.com/user-attachments/assets/2b92fa82-18ef-424e-a87c-1645cdc0393c" />

---

### 6. Creación de malware en AppData

Se identificó la creación del archivo: ``C:\Users\Administrator\AppData\Local\revshell1337.exe``


El directorio **AppData\Local** es comúnmente utilizado por atacantes para almacenar payloads.  
El nombre del archivo sugiere una **reverse shell**.

**Clasificación: True Positive**

<img src="https://github.com/user-attachments/assets/39bc1991-53b4-4434-9d30-b6354bd037d6" />

---

### 7. Persistencia mediante tarea programada

Se creó una tarea programada que ejecuta el binario anterior de forma periódica.

Este mecanismo permite mantener acceso persistente al sistema tras el compromiso.

**Clasificación: True Positive**

<img src="https://github.com/user-attachments/assets/f2e999d5-758b-41e1-a890-2b082590a4d7" />

---

### 8. Acceso sospechoso a memoria de LSASS

Se observó el proceso `powershell.exe` accediendo a la memoria de `lsass.exe`.

El acceso a LSASS es una técnica comúnmente utilizada para **Credential Dumping** (por ejemplo, Mimikatz).

**Clasificación: True Positive**

<img src="https://github.com/user-attachments/assets/9fc0e470-c5fc-457f-a831-53643ca06c71" />

---

### 9. Actividad legítima del sistema

Posteriormente se observó `svchost.exe` accediendo a LSASS bajo el contexto SYSTEM.

Este comportamiento forma parte de las operaciones normales del sistema y no presenta indicadores de actividad maliciosa.

**Clasificación: False Positive**

<img src="https://github.com/user-attachments/assets/2e340162-97b0-43e8-be05-fb4c93fbe3a2" />

---

## Conclusión

El análisis de eventos confirma un **compromiso completo del host WIN01**, siguiendo una cadena de ataque típica:

1. Reconocimiento inicial (Null Session)
2. Ataque de fuerza bruta
3. Acceso privilegiado
4. Enumeración post-compromiso
5. Ejecución de malware
6. Persistencia
7. Intento de robo de credenciales

Este caso refleja un escenario realista de intrusión y destaca la importancia de la correlación temporal de eventos en un entorno SIEM para la detección temprana de incidentes.

---

## Técnicas observadas (MITRE ATT&CK)

- T1078 – Valid Accounts  
- T1110 – Brute Force  
- T1059 – Command and Scripting Interpreter  
- T1003 – OS Credential Dumping  
- T1547 – Persistence  
- T1105 – Ingress Tool Transfer  
- T1046 – Network Service Discovery






