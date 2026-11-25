---
layout: post
title: "Investigación de incidente con Elastic: un servidor web comprometido a través de un plugin de WordPress"
date: 2026-03-30
categories: [Blue Team]
tags: [SIEM, Elastic, Forense, Linux, WordPress, Threat Hunting, Blue Team]
description: "Triaje de las alertas de un servidor web en Elastic SIEM: ejecución remota de comandos a través de un plugin de WordPress, reverse shell desde php-fpm, robo de una clave SSH y del historial de otro usuario, y preparación de la escalada. Separo verdaderos y falsos positivos y cierro con indicadores, respuesta y mapeo a MITRE ATT&CK."
image:
  path: /assets/img/posts/covers/Investigacion-Web-Elastic.webp
  alt: "Servidor web comprometido — Investigación con Elastic SIEM"
---

En un servidor web, el proceso de PHP empieza a lanzar comandos del sistema y a conectarse a puertos raros. Es la firma de una **ejecución remota de código**. Este es el informe de la investigación: cómo entró el atacante, qué hizo después y qué dos alertas, pese a parecer sospechosas, eran tráfico normal.

> Escenario de práctica de análisis en Elastic SIEM. He **anonimizado** los nombres de equipo, el dominio, las direcciones IP, las cuentas y el plugin concreto, y no incluyo capturas del entorno original.
{: .prompt-info }

---

## Resumen

| | |
|---|---|
| **Activo afectado** | Servidor web Linux `LNX-WEB02` (WordPress sobre `php-fpm`) |
| **Origen del ataque** | `203.0.113.45` |
| **Alertas revisadas** | 9: **7 verdaderos positivos** y 2 falsos positivos |
| **Veredicto** | **Compromiso confirmado.** RCE a través de un plugin vulnerable, *reverse shell* como `www-data`, robo de la clave SSH y del historial del usuario `devops` y preparación de la escalada de privilegios. |

---

## Línea temporal

| # | Evento | Evidencia | Veredicto |
|---|---|---|---|
| 1 | `logrotate` lanza `/usr/bin/dash` | Mantenimiento programado, sin argumentos ni procesos hijo raros | ⚪ Falso positivo |
| 2 | HTTPS saliente desde `php-fpm` | Hacia `192.0.2.80`, infraestructura oficial de WordPress | ⚪ Falso positivo |
| 3 | Ejecución remota de comandos | `sh -c id` lanzado desde la carpeta de un plugin | ✅ Ataque |
| 4 | *Reverse shell* | `php-fpm` abre conexiones a `203.0.113.45`, puertos 4444–4449 | ✅ Ataque |
| 5 | Reconocimiento | `whoami`, `cat /etc/passwd`, `ls -la /home/devops` | ✅ Ataque |
| 6 | Robo de clave SSH | Lectura de `/home/devops/.ssh/id_rsa` | ✅ Ataque |
| 7 | Lectura de historial | `/home/devops/.bash_history` | ✅ Ataque |
| 8 | Preparación de herramientas | `chmod +x` sobre LinPEAS y pspy en `/tmp` | ✅ Ataque |
| 9 | Búsqueda de privilegios | `sudo -l` desde una sesión interactiva en `/tmp` | ✅ Ataque |

---

## Análisis

### La entrada: un plugin que ejecuta comandos (alertas 3 y 4)

La alerta clave es `sh -c id` ejecutado con el directorio de trabajo dentro de `wp-content/plugins/<plugin>/`. Un plugin de WordPress no tiene por qué lanzar comandos del sistema, e `id` es lo primero que ejecuta un atacante para saber **con qué usuario ha entrado**. Es una **ejecución remota de código** a través de un componente vulnerable.

Lo confirma la alerta 4: el mismo `php-fpm` abre **conexiones TCP salientes a una IP externa en varios puertos altos consecutivos**. Un servidor web responde peticiones; no inicia conexiones a puertos no estándar. Es el patrón de una *reverse shell* y de los canales que el atacante va abriendo.

### Después de entrar (alertas 5 a 9)

Con la shell como `www-data`, el atacante hace lo de manual:

- **Reconocimiento:** quién es, qué cuentas hay (`/etc/passwd`) y qué hay en la carpeta personal de `devops`.
- **Credenciales:** lee la **clave privada SSH** de `devops` y su **historial de comandos**. La clave le permite entrar como ese usuario y, quizá, en otros servidores; el historial puede contener contraseñas o rutas sensibles.
- **Escalada:** prepara LinPEAS y **pspy** (que espía los procesos que lanzan otros usuarios, por ejemplo tareas de root) y consulta `sudo -l`.

Que `www-data` pudiera leer la clave privada de otro usuario es, en sí mismo, un **fallo de permisos** que el informe debe señalar: sin él, la intrusión se habría quedado en la cuenta del servidor web.

### Los dos falsos positivos (alertas 1 y 2)

- **`logrotate` → `dash`**: `logrotate` ejecuta scripts de mantenimiento a través de una shell. Sin argumentos sospechosos, sin procesos hijo raros y sin actividad alrededor, es lo esperado.
- **`php-fpm` → HTTPS a WordPress**: WordPress consulta su infraestructura oficial para actualizaciones y recursos. El destino es conocido, el puerto es el 443 y no hay patrón de mando y control.

Las dos implican al mismo `php-fpm` o a una shell, igual que el ataque. Lo que las separa es el **destino**, el **puerto** y el **contexto**.

---

## Indicadores (anonimizados)

| Tipo | Valor |
|---|---|
| IP del atacante | `203.0.113.45` (puertos 4444–4449) |
| Vector | Plugin de WordPress vulnerable (RCE) |
| Cuenta usada | `www-data` |
| Material robado | `/home/devops/.ssh/id_rsa` y `/home/devops/.bash_history` |
| Herramientas | LinPEAS y pspy en `/tmp` |

---

## Respuesta recomendada

1. **Contener:** aislar `LNX-WEB02` y bloquear `203.0.113.45`.
2. **Cerrar la entrada:** actualizar o eliminar el plugin vulnerable y revisar el resto.
3. **Credenciales:** revocar la clave SSH de `devops` (quitarla de los `authorized_keys` de todos los servidores donde esté) y rotar cualquier secreto que aparezca en su historial.
4. **Permisos:** la carpeta personal y `~/.ssh` de cada usuario no deben ser legibles por otros (`chmod 700`).
5. **Salida de red:** el servidor web no necesita iniciar conexiones a puertos arbitrarios. Un filtrado de salida habría cortado la *reverse shell*.
6. **Detección:** alertar siempre que `php-fpm` o el servidor web lancen una shell. Es de las señales más fiables de una web comprometida.

---

## Técnicas observadas (MITRE ATT&CK)

| Táctica | Técnica |
|---|---|
| Acceso inicial | T1190 Exploit Public-Facing Application |
| Ejecución | T1059.004 Unix Shell |
| Mando y control | T1571 Non-Standard Port · T1105 Ingress Tool Transfer |
| Descubrimiento | T1033 System Owner/User Discovery · T1087.001 Local Account · T1057 Process Discovery |
| Acceso a credenciales | T1552.004 Private Keys · T1552.003 Bash History |
| Escalada de privilegios | T1548.003 Sudo and Sudo Caching (reconocimiento previo) |

---

## Lo que me llevo

- **El árbol de procesos cuenta la historia.** `php-fpm` → `sh` es la frase que resume el incidente.
- **El mismo proceso puede ser legítimo o malicioso.** `php-fpm` conectándose a WordPress por el 443 es normal; a puertos consecutivos de una IP desconocida, no.
- **Los permisos convierten un fallo en un desastre.** El plugin dio la entrada, pero una clave SSH que otros usuarios podían leer dio el resto.
