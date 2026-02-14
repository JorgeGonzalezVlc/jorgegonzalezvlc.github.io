---
title: Investigación de incidente – Compromiso en host WIN01 (Windows)
date: 2026-02-14
categories: [Defensive]
tags: [SOC, SIEM, Elastic, Log Analysis, Windows, Incident Response, Threat Hunting]
---

Investigación completa de un host Windows comprometido, reconstruyendo la cadena de ataque desde la enumeración inicial hasta la persistencia y el intento de robo de credenciales.

Durante el análisis del host **WIN01** se identificaron múltiples alertas asociadas a actividades maliciosas que abarcan distintas fases del ciclo de ataque.

La correlación temporal y contextual de los eventos confirma un **compromiso completo del sistema**, incluyendo:

- Enumeración inicial sin autenticación
- Ataques de fuerza bruta sobre servicios SMB
- Acceso remoto con privilegios elevados
- Enumeración post-compromiso
- Ejecución de malware
- Establecimiento de persistencia
- Intentos de robo de credenciales mediante acceso a LSASS

El incidente refleja un escenario realista de intrusión en un entorno Windows empresarial.


---

## Línea temporal de la actividad

### 1. Enumeración mediante sesión SMB anónima

Se detectó un inicio de sesión de red (Logon Type 3) utilizando la cuenta **ANONYMOUS LOGON**, sin credenciales válidas.

Este comportamiento es característico de **Null Session**, técnica utilizada para enumerar recursos compartidos, usuarios o políticas del sistema.

**Clasificación: True Positive**

<img width="1322" height="503" alt="imagen" src="https://github.com/user-attachments/assets/26676af1-d667-4608-a5aa-18f8d8394627" />


---

### 2. Acceso legítimo al proceso LSASS

Se observó la creación del proceso `lsass.exe` iniciado por `wininit.exe` bajo el contexto **NT AUTHORITY\SYSTEM**.

La relación padre-hijo, la ruta del binario y el contexto de ejecución corresponden con el comportamiento normal del sistema operativo durante el arranque y la gestión de autenticación.

No se detectaron parámetros anómalos, acceso externo ni técnicas de inyección de memoria.

**Clasificación: False Positive**

---

### 3. Ataque de fuerza bruta por SMB

Se registraron múltiples intentos fallidos de autenticación desde la IP **10.10.16.14** en un corto periodo de tiempo.

El patrón observado —alto volumen, origen único, ventana temporal reducida y uso repetitivo de credenciales— es característico de un **ataque automatizado de fuerza bruta o password spraying**.


**Clasificación: True Positive**

<img width="1078" height="464" alt="imagen" src="https://github.com/user-attachments/assets/a097a620-6b18-4546-906c-67ed39581e16" />


---

### 4. Enumeración de historial de PowerShell

El usuario ejecutó comandos para acceder a: ``ConsoleHost_history.txt``


Este archivo almacena el historial de comandos ejecutados en sesiones de PowerShell.  
El acceso a este recurso suele realizarse durante fases de **enumeración post-compromiso**, ya que puede revelar:

- Credenciales en texto plano
- Scripts ejecutados previamente
- Información sensible sobre tareas administrativas

El uso de `winPEAS.ps1` confirma que esta actividad forma parte de una **enumeración automatizada del sistema**.

**Clasificación: True Positive**

<img width="1332" height="533" alt="imagen" src="https://github.com/user-attachments/assets/fc6f545b-bd59-46f3-b4f5-d4f09fdc6971" />


---

### 5. Acceso privilegiado desde IP sospechosa

Se detectó un inicio de sesión remoto exitoso (Logon Type 10 – RDP) con la cuenta **Administrator** desde la IP **10.10.16.14**, previamente asociada a actividad maliciosa.
El evento confirma el establecimiento de una **sesión interactiva remota con privilegios elevados**, lo que indica que el atacante logró comprometer credenciales administrativas.


**Clasificación: True Positive**

<img width="1472" height="490" alt="imagen" src="https://github.com/user-attachments/assets/bdb66854-bfcb-4997-adf2-b71a21a3992c" />


---

### 6. Creación de malware en AppData

Se identificó la creación del archivo: ``C:\Users\Administrator\AppData\Local\revshell1337.exe``


El directorio **AppData\Local** es comúnmente utilizado por atacantes para almacenar payloads, ya que permite ejecución sin privilegios adicionales y suele estar excluido de controles estrictos.

El nombre del archivo sugiere una **reverse shell**, indicando preparación para comunicación remota con infraestructura atacante.


**Clasificación: True Positive**

<img width="1345" height="443" alt="imagen" src="https://github.com/user-attachments/assets/4074ebdb-b016-474c-9873-0c7d4fec7f77" />


---

### 7. Persistencia mediante tarea programada

Se creó una tarea programada que ejecuta el binario anterior de forma periódica.

Este mecanismo permite mantener acceso persistente al sistema tras el compromiso.

**Clasificación: True Positive**

<img width="1325" height="230" alt="imagen" src="https://github.com/user-attachments/assets/0ebb0d4e-eed3-4928-bf50-c596c5baa9b8" />


---

### 8. Acceso sospechoso a memoria de LSASS

Se observó el proceso `powershell.exe` accediendo a la memoria de `lsass.exe`.

El acceso a LSASS por procesos no autorizados es un indicador crítico de **Credential Dumping**, técnica utilizada para extraer hashes o credenciales en texto plano (por ejemplo, mediante Mimikatz).


**Clasificación: True Positive**

<img width="1358" height="485" alt="imagen" src="https://github.com/user-attachments/assets/b3703f9b-7934-4fc7-b465-97c855a60471" />


---

### 9. Actividad legítima del sistema

Posteriormente se observó `svchost.exe` accediendo a LSASS bajo el contexto SYSTEM.

Este comportamiento forma parte de las operaciones normales del sistema y no presenta indicadores de actividad maliciosa.

**Clasificación: False Positive**

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






