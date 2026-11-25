---
layout: post
title: "Investigación de incidente con Elastic: post-explotación en un servidor Linux, hasta el intento de DirtyPipe"
date: 2026-03-26
categories: [Blue Team]
tags: [SIEM, Elastic, Forense, Linux, Threat Hunting, Blue Team]
description: "Triaje de las alertas de un servidor Linux en Elastic SIEM: enumeración manual, búsqueda de privilegios sudo, LinPEAS en /tmp, descargas con curl, acceso a claves GPG y un exploit de DirtyPipe (CVE-2022-0847). Separo verdaderos y falsos positivos y cierro con indicadores, respuesta y mapeo a MITRE ATT&CK."
image:
  path: /assets/img/posts/covers/investigacion-Linux-Elastic.webp
  alt: "Incidente en un servidor Linux — Investigación con Elastic SIEM"
---

En un servidor Linux, la cuenta de servicio de una herramienta de integración continua empieza a hacer cosas que un servicio no hace: preguntar quién es, mirar el historial, descargar herramientas y probar un exploit. Este es el informe de la investigación: qué alertas eran ataque, cuál era ruido y en qué punto estaba el atacante.

> Escenario de práctica de análisis en Elastic SIEM. He **anonimizado** los nombres de equipo, las direcciones IP y las cuentas, y no incluyo capturas del entorno original.
{: .prompt-info }

---

## Resumen

| | |
|---|---|
| **Activo afectado** | Servidor Linux `LNX-CI01` |
| **Cuenta implicada** | `svc_ci`, la cuenta de servicio de la herramienta de integración continua |
| **Alertas revisadas** | 7: **6 verdaderos positivos** y 1 falso positivo |
| **Veredicto** | **Post-compromiso confirmado.** El atacante ya ejecutaba comandos como `svc_ci` y estaba intentando escalar a root con un exploit público del kernel. |

---

## Línea temporal

| # | Evento | Evidencia | Veredicto |
|---|---|---|---|
| 1 | Enumeración manual | `whoami`, `id`, `groups`, `ls -la` y lectura de `.bash_history` en pocos segundos | ✅ Ataque |
| 2 | Búsqueda de privilegios | `sudo -l` desde `svc_ci` | ✅ Ataque |
| 3 | Preparación de herramientas | `chmod +x` sobre LinPEAS en `/tmp` | ✅ Ataque |
| 4 | Conexión saliente | `curl` hacia `198.51.100.23` (proveedor cloud) justo después | ✅ Ataque |
| 5 | Acceso a material sensible | Lectura de `~/.gnupg` | ✅ Ataque |
| 6 | `df -k` periódico | Cada 2 minutos, con el contexto de una tarea automática | ⚪ Falso positivo |
| 7 | Intento de escalada | Exploit de **DirtyPipe (CVE-2022-0847)** ejecutado desde `/tmp` | ✅ Ataque |

---

## Análisis

### Un servicio que se comporta como una persona (alertas 1 y 2)

Una cuenta de servicio ejecuta siempre lo mismo, de forma automática. Aquí aparece una ráfaga de `whoami`, `id`, `groups` y `ls -la`, más la lectura del historial de comandos: **alguien está orientándose a mano** en el sistema. Justo después llega `sudo -l`, que lista lo que la cuenta puede ejecutar como root. Es el primer paso para buscar una configuración insegura, como un `NOPASSWD`. Nada de eso forma parte del trabajo de un servidor de integración continua.

### Herramientas y salida a Internet (alertas 3 y 4)

`chmod +x` sobre **LinPEAS**, en `/tmp`, confirma la intención: LinPEAS automatiza la búsqueda de vías de escalada, y `/tmp` es la zona de preparación habitual porque cualquiera puede escribir en ella. La conexión con `curl` a una IP de un proveedor cloud, inmediatamente después, encaja con la **descarga de más herramientas** o con un canal hacia la infraestructura del atacante. Que la IP sea de un proveedor conocido no la hace legítima: el contexto manda.

### Material sensible y exploit (alertas 5 y 7)

El acceso a `~/.gnupg` busca claves privadas: material que permite firmar, descifrar o moverse a otros sistemas. Y la última alerta es la más seria: la ejecución de un exploit público de **DirtyPipe (CVE-2022-0847)**, una vulnerabilidad del kernel que permite sobrescribir archivos de solo lectura y llegar a root. En este punto el atacante **ya no busca, sino que ataca**.

### El falso positivo (alerta 6)

`df -k` cada dos minutos, siempre con el mismo intervalo y con el contexto de una tarea automática (probablemente del propio servicio), es monitorización del espacio en disco, no una persona. Lo que lo delata como legítimo es justo lo contrario de la alerta 1: **regularidad y ausencia de interacción**.

---

## Indicadores (anonimizados)

| Tipo | Valor |
|---|---|
| Cuenta usada | `svc_ci` |
| Conexión saliente | `198.51.100.23` mediante `curl` |
| Herramientas | LinPEAS y un exploit de CVE-2022-0847 en `/tmp` |
| Material accedido | `~/.gnupg` y `~/.bash_history` |

---

## Respuesta recomendada

1. **Contener:** aislar `LNX-CI01` y bloquear `198.51.100.23`.
2. **Comprobar si la escalada tuvo éxito:** procesos como root lanzados por `svc_ci`, binarios con SUID modificados y cambios en `/etc/passwd`. Hasta descartarlo, tratar el servidor como comprometido por completo.
3. **Corregir:** actualizar el kernel a una versión que corrija DirtyPipe.
4. **Rotar credenciales:** las claves GPG y los secretos que guarde la herramienta de integración continua.
5. **Buscar el acceso inicial:** las alertas empiezan cuando el atacante ya ejecuta comandos como `svc_ci`, así que la vía de entrada (probablemente la propia aplicación) sigue abierta mientras no se encuentre.

---

## Técnicas observadas (MITRE ATT&CK)

| Táctica | Técnica |
|---|---|
| Descubrimiento | T1033 System Owner/User Discovery · T1082 System Information Discovery |
| Acceso a credenciales | T1552.003 Bash History · T1552.004 Private Keys |
| Mando y control | T1105 Ingress Tool Transfer |
| Escalada de privilegios | T1068 Exploitation for Privilege Escalation |

---

## Lo que me llevo

- **El comportamiento delata más que el comando.** `whoami` no es malicioso; que lo ejecute a mano una cuenta de servicio, sí.
- **La regularidad es una buena pista para descartar.** Lo periódico y sin interacción suele ser el sistema; lo irregular y en ráfagas, una persona.
- **Una investigación también señala lo que falta.** Saber que no tienes el acceso inicial es tan importante como todo lo que sí has visto.
