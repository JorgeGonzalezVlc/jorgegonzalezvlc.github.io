---
layout: post
title: "Investigación de incidente con Elastic: un servidor Windows comprometido, de la fuerza bruta al acceso a LSASS"
date: 2026-03-28
categories: [Blue Team]
tags: [SIEM, Elastic, Forense, Windows, Threat Hunting, Blue Team]
destacado:
  Blue Team: 4
description: "Triaje de las alertas de un servidor Windows en Elastic SIEM: separo verdaderos y falsos positivos y reconstruyo la cadena de ataque, desde una sesión SMB anónima y fuerza bruta hasta la persistencia con una tarea programada y el acceso a la memoria de LSASS. Con línea temporal, indicadores, respuesta y mapeo a MITRE ATT&CK."
image:
  path: /assets/img/posts/covers/Investigacion-Windows-Elastic.webp
  alt: "Incidente en un servidor Windows — Investigación con Elastic SIEM"
---

Un servidor Windows acumula alertas en el SIEM. El trabajo de un analista no es darlas todas por buenas, sino **decidir cuáles son ataque y cuáles ruido**, y unir las que son ataque en una historia coherente. Este es el informe de esa investigación, alerta por alerta.

> Escenario de práctica de análisis en Elastic SIEM. He **anonimizado** los nombres de equipo, las direcciones IP, las cuentas y los archivos, y no incluyo capturas del entorno original.
{: .prompt-info }

---

## Resumen

| | |
|---|---|
| **Activo afectado** | Servidor Windows `WINSRV-02` |
| **Origen del ataque** | `203.0.113.45` |
| **Alertas revisadas** | 9: **7 verdaderos positivos** y 2 falsos positivos |
| **Veredicto** | **Compromiso confirmado.** El atacante entró como `Administrator` por RDP tras un ataque de fuerza bruta, dejó un binario con persistencia y accedió a la memoria de LSASS para robar credenciales. |

---

## Línea temporal

| # | Evento | Evidencia | Veredicto |
|---|---|---|---|
| 1 | Sesión SMB anónima | Inicio de sesión de red (4624, tipo 3) con `ANONYMOUS LOGON` | ✅ Ataque |
| 2 | `lsass.exe` creado por `wininit.exe` | Arranque normal del sistema, como `SYSTEM` | ⚪ Falso positivo |
| 3 | Fuerza bruta por SMB | Ráfaga de inicios de sesión fallidos (4625) desde `203.0.113.45` | ✅ Ataque |
| 4 | Enumeración tras el acceso | Lectura de `ConsoleHost_history.txt` y ejecución de `winPEAS.ps1` | ✅ Ataque |
| 5 | Acceso remoto privilegiado | Inicio de sesión RDP (4624, tipo 10) como `Administrator` desde `203.0.113.45` | ✅ Ataque |
| 6 | Binario sospechoso en AppData | `C:\Users\Administrator\AppData\Local\rev_shell.exe` | ✅ Ataque |
| 7 | Persistencia | Tarea programada que ejecuta ese binario periódicamente | ✅ Ataque |
| 8 | Acceso a la memoria de LSASS | `powershell.exe` abre el proceso `lsass.exe` | ✅ Ataque |
| 9 | `svchost.exe` accede a LSASS | Operación habitual del sistema, como `SYSTEM` | ⚪ Falso positivo |

---

## Análisis

### Reconocimiento y acceso (alertas 1, 3 y 5)

La primera señal es un inicio de sesión de red con **`ANONYMOUS LOGON`**: una *null session*, la técnica clásica para enumerar recursos compartidos, usuarios y políticas sin credenciales. Poco después llega una **ráfaga de inicios de sesión fallidos** desde una única IP, en una ventana de tiempo muy corta y con credenciales repetitivas: el patrón de una herramienta automática de fuerza bruta o *password spraying*.

La alerta que cierra el círculo es la 5: un **inicio de sesión RDP correcto como `Administrator` desde esa misma IP**. Por separado, cada evento podría tener otra explicación; juntos y en ese orden, indican que el atacante enumeró, adivinó la contraseña y entró con privilegios de administración.

### Enumeración, payload y persistencia (alertas 4, 6 y 7)

Ya dentro, el atacante lee `ConsoleHost_history.txt`, el historial de PowerShell, donde a menudo quedan credenciales o comandos administrativos. Además, ejecuta **winPEAS**, una herramienta de enumeración automática de vías de escalada.

Después aparece `rev_shell.exe` en `AppData\Local`, una carpeta en la que un usuario puede escribir y ejecutar sin privilegios adicionales y que suele estar menos vigilada. El nombre ya apunta a una *reverse shell*. Una **tarea programada** que lo ejecuta periódicamente le asegura volver a entrar aunque se cierre la sesión o se reinicie el servidor.

### Robo de credenciales (alerta 8)

La alerta más grave: **`powershell.exe` accediendo a la memoria de `lsass.exe`**. LSASS guarda en memoria el material de autenticación de las sesiones abiertas. Que un PowerShell interactivo lo abra es un indicador clásico de **volcado de credenciales**, con herramientas como Mimikatz o técnicas equivalentes. A partir de aquí hay que dar por comprometidas las credenciales de todas las cuentas que hayan iniciado sesión en el servidor.

### Por qué hay dos falsos positivos (alertas 2 y 9)

LSASS también es noticia cuando no hay ataque, y saber distinguirlo es la mitad del trabajo:

- **`wininit.exe` → `lsass.exe`** como `SYSTEM` es exactamente como arranca Windows. La relación padre-hijo, la ruta del binario y el contexto son los esperados, sin parámetros raros ni inyección.
- **`svchost.exe` accediendo a LSASS** como `SYSTEM` forma parte de la operativa normal de los servicios del sistema.

La diferencia con la alerta 8 no está en el proceso de destino, sino en **quién lo abre y desde qué contexto**.

---

## Indicadores (anonimizados)

| Tipo | Valor |
|---|---|
| IP del atacante | `203.0.113.45` |
| Cuenta comprometida | `Administrator` |
| Binario | `C:\Users\Administrator\AppData\Local\rev_shell.exe` |
| Persistencia | Tarea programada que ejecuta el binario anterior |
| Herramientas | `winPEAS.ps1` |

---

## Respuesta recomendada

1. **Contener:** aislar `WINSRV-02` de la red y bloquear `203.0.113.45` en el perímetro.
2. **Erradicar:** eliminar la tarea programada y el binario, y buscar el mismo indicador en el resto de equipos.
3. **Credenciales:** cambiar la contraseña de `Administrator` y de todas las cuentas con sesión en el servidor, porque LSASS ha sido leído.
4. **Endurecer:**
   - Política de bloqueo de cuentas.
   - Sin acceso anónimo por SMB.
   - RDP solo a través de VPN y con MFA.
   - **Protección de LSA** (`RunAsPPL`) o Credential Guard.

---

## Técnicas observadas (MITRE ATT&CK)

| Táctica | Técnica |
|---|---|
| Descubrimiento | T1135 Network Share Discovery · T1087 Account Discovery · T1082 System Information Discovery |
| Acceso a credenciales | T1110 Brute Force · T1552 Unsecured Credentials · **T1003.001 LSASS Memory** |
| Acceso inicial / movimiento | T1078 Valid Accounts · T1021.001 Remote Desktop Protocol |
| Ejecución | T1059.001 PowerShell |
| Persistencia | T1053.005 Scheduled Task |
| Mando y control | T1105 Ingress Tool Transfer |

---

## Lo que me llevo

- **La correlación es lo que convierte alertas en un incidente.** La IP de la fuerza bruta es la misma que la del RDP correcto; sin esa unión, son dos alertas sueltas.
- **El proceso de destino no basta.** Que algo toque LSASS no es malicioso por sí mismo; lo es *quién* lo toca y *desde dónde*.
- **Un falso positivo bien justificado también es trabajo.** Descartarlo con argumentos es lo que evita que el equipo pierda tiempo y que las alertas reales se ahoguen en ruido.
