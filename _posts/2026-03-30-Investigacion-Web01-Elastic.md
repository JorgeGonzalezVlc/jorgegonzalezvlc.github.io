---
title: Investigación de incidente – Compromiso en host WEB01 (Linux)
date: 2026-03-30
categories: [Defensive]
tags: [SOC, SIEM, Elastic, Log Analysis, Linux, Incident Response, Threat Hunting, Web Security]
image:
  path: /assets/img/elastic-logo.png
  alt: Phishing Detector
  width: 500
  height: 280
  class: sz-contain
---


Durante el análisis del host **WEB01** se identificó una secuencia de eventos que indica la **ejecución remota de comandos a través del servidor web**, seguida de actividades de reconocimiento interno, acceso a información sensible y preparación para escalada de privilegios.

La correlación temporal de los eventos muestra un escenario de **compromiso del servidor web**, con las siguientes fases:

- Ejecución remota de comandos (web shell o explotación de plugin)
- Reconocimiento del sistema
- Acceso a credenciales y datos sensibles
- Preparación de herramientas de post-explotación
- Enumeración de privilegios

---

## Línea temporal de la actividad

### 1. Ejecución de shell por logrotate

Se detectó la ejecución de `/usr/bin/dash` iniciada por **logrotate** sin sesión interactiva.

Tras revisar el contexto del proceso:
- Sin argumentos sospechosos
- Sin procesos hijo anómalos
- Sin actividad asociada

Este comportamiento corresponde con operaciones normales de mantenimiento del sistema.

**Clasificación: False Positive**

---

### 2. Conexión HTTPS saliente del servidor web

El proceso `php-fpm8.1`, ejecutándose como **www-data**, estableció una conexión HTTPS hacia la IP **198.143.164.252**.

La verificación del destino indica que pertenece a infraestructura legítima de **WordPress**, utilizada para:
- Actualizaciones
- Comunicación con servicios oficiales
- Descarga de recursos

No se observaron patrones de C2 ni actividad anómala adicional.

**Clasificación: False Positive**

---

### 3. Ejecución remota de comandos desde plugin WordPress

Se registró la ejecución de: ``sh -c id``

Desde el directorio: ``/var/www/lumineux.htb/wp-content/plugins/canto/includes/lib``

La ejecución de comandos del sistema desde un directorio de plugin web no es consistente con el funcionamiento normal del servidor y sugiere **ejecución remota de código (RCE)** a través de un componente comprometido.

El uso del comando `id` es típico para verificar el contexto de ejecución tras obtener acceso.

**Clasificación: True Positive**

---

### 4. Conexiones salientes anómalas a múltiples puertos

El proceso `php-fpm8.1` inició múltiples conexiones TCP hacia la IP: ``10.10.16.14``

utilizando varios puertos no estándar (1337–1342) en un corto periodo de tiempo.

Este patrón es consistente con:

- Comunicación C2
- Establecimiento de reverse shell
- Canal de datos interactivo

No corresponde con comportamiento normal de un servidor web.

**Clasificación: True Positive**

<img width="1309" height="425" alt="imagen" src="https://github.com/user-attachments/assets/0c953628-0250-48a8-9fa3-2a07f63740aa" />


---

### 5. Reconocimiento del sistema

Se observaron múltiples comandos ejecutados en un intervalo reducido:

- `whoami`
- `cat /etc/passwd`
- `ls -la /home/cameron`

Estas acciones permiten al atacante:

- Identificar el usuario actual
- Enumerar cuentas del sistema
- Localizar directorios accesibles

El patrón corresponde a **reconocimiento post-compromiso**.

**Clasificación: True Positive**

<img width="1328" height="358" alt="imagen" src="https://github.com/user-attachments/assets/95a76744-bd72-4f4d-b8f7-5d0c044bc4cf" />
<img width="1294" height="231" alt="imagen" src="https://github.com/user-attachments/assets/4cd5a14c-92fa-48a8-8f50-c7880cd2ab25" />
<img width="1304" height="308" alt="imagen" src="https://github.com/user-attachments/assets/b8335fa6-27ab-4468-8dab-34627adfe9e2" />


---

### 6. Acceso a claves SSH de otro usuario

Se detectó el acceso al directorio: ``/home/cameron/.ssh``

Seguido de la lectura del archivo: ``id_rsa``

El acceso a claves privadas SSH de otro usuario no es consistente con operaciones normales del servidor web y sugiere intento de:

- Movimiento lateral
- Escalada de privilegios
- Persistencia mediante acceso remoto

**Clasificación: True Positive**

<img width="1994" height="553" alt="imagen" src="https://github.com/user-attachments/assets/2cceae45-bd65-4cd7-9993-badc59d75be2" />


---


### 7. Acceso al historial de comandos del usuario

Se observó la lectura de: ``/home/cameron/.bash_history``

Este archivo contiene comandos previamente ejecutados y puede revelar:

- Credenciales
- Rutas sensibles
- Comandos administrativos

Este comportamiento es típico de la fase de **credential discovery** o reconocimiento local.

**Clasificación: True Positive**

<img width="1986" height="634" alt="imagen" src="https://github.com/user-attachments/assets/e8bd585e-375e-4e81-8b90-e875335bfae0" />

---

### 8. Preparación de herramientas en /tmp

Se detectó la ejecución de: ``chmod +x linpeas`` y ``chmod +x pspy``


En el directorio `/tmp`.

Ambas herramientas son ampliamente utilizadas para:

- Enumeración de privilegios
- Identificación de vectores de escalada

El uso de `/tmp` como zona de staging es común en escenarios de post-explotación.

**Clasificación: True Positive**

---

### 9. Enumeración de privilegios sudo

Finalmente se ejecutó: ``sudo -l``

desde una sesión interactiva con el directorio de trabajo en `/tmp`.

Este comando permite identificar configuraciones inseguras o permisos sudo explotables y forma parte de la fase de **privilege escalation discovery**.

**Clasificación: True Positive**


---


## Conclusión

El análisis de los eventos confirma el **compromiso del host WEB01**, siguiendo una cadena de ataque

1. Ejecución remota de comandos vía web
2. Establecimiento de comunicación externa
3. Reconocimiento del sistema
4. Acceso a credenciales (SSH, historial)
5. Despliegue de herramientas de enumeración
6. Intento de escalada de privilegios

Este caso refleja un escenario realista de intrusión en servidores web y demuestra la importancia de la correlación de eventos de proceso, red y acceso a archivos dentro de un entorno SIEM.

---

## Técnicas observadas (MITRE ATT&CK)

- T1190 – Exploit Public-Facing Application  
- T1059 – Command and Scripting Interpreter  
- T1071 – Application Layer Protocol  
- T1046 – Network Service Discovery  
- T1003 – Credential Access  
- T1552 – Unsecured Credentials  
- T1548 – Abuse Elevation Control Mechanism  
- T1105 – Ingress Tool Transfer
































