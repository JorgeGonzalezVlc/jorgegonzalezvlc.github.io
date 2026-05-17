---
title: Investigación de incidente – Compromiso en NIX01 (Linux)
date: 2026-03-26
categories: [Defensive]
tags: [SOC, SIEM, Elastic, Log Analysis, Incident Response, Linux, Privilege Escalation, Threat Hunting]
---

Análisis de un incidente en Linux donde múltiples eventos del SIEM revelan actividad de post-explotación y preparación de escalada de privilegios.

Durante el análisis de eventos en el SIEM se detectó una secuencia de alertas en el host **NIX01** que indicaban actividad anómala.  
Los eventos mostraban comportamientos típicos de **post-compromiso**, incluyendo reconocimiento del sistema, enumeración de privilegios, ejecución de herramientas de explotación y preparación para una posible escalada de privilegios.

El objetivo del análisis fue determinar qué alertas correspondían a actividad maliciosa (**True Positive**) y cuáles podían considerarse comportamiento legítimo (**False Positive**).

---

## Contexto

Host afectado: NIX01  
Usuario implicado: teamcity  
Tipo de análisis: Investigación en SIEM (logs de sistema Linux)

---

## Línea temporal de la actividad

### 1. Enumeración del sistema

Se observaron múltiples comandos ejecutados en un corto intervalo de tiempo:

- `whoami`
- `id`
- `groups`
- `ls -la`
- consulta de `.bash_history`

  
Esta secuencia de comandos indica enumeración manual del entorno, utilizada para identificar el contexto del usuario, privilegios disponibles y artefactos previamente ejecutados.

Este tipo de actividad no es consistente con procesos automatizados del sistema y es característico de reconocimiento posterior a un acceso inicial.

**Clasificación: True Positive**

<img width="1337" height="504" alt="imagen" src="https://github.com/user-attachments/assets/38c20d5c-d633-4018-a8f7-69b3492591ea" />


---

### 2. Enumeración de privilegios

Posteriormente se ejecutó: ``sudo -l``


Este comando permite listar los privilegios sudo disponibles y detectar posibles configuraciones inseguras (por ejemplo, permisos NOPASSWD).

La ejecución desde el contexto del usuario teamcity y tras actividades previas de enumeración sugiere búsqueda activa de vectores de escalada de privilegios, lo cual no forma parte del comportamiento habitual del servicio.

**Clasificación: True Positive**

---

### 3. Preparación de herramientas de post-explotación

Se detectó la modificación de permisos mediante: ``chmod +x linpeas...``


El archivo corresponde a LinPEAS, una herramienta ampliamente utilizada por atacantes para identificar vulnerabilidades locales y oportunidades de escalada de privilegios.

El uso de herramientas de enumeración ofensiva desde el directorio /tmp es un patrón común en escenarios de post-compromiso.

**Clasificación: True Positive**

<img width="1343" height="445" alt="imagen" src="https://github.com/user-attachments/assets/8d06eb4a-9fe9-4e42-ba37-8af6c86f9f3e" />


---

### 4. Comunicación externa sospechosa

Se observó una conexión saliente mediante: ``curl -> 34.200.177.28``


Aunque la dirección IP pertenece a infraestructura de AWS, el uso de curl inmediatamente después de actividades de reconocimiento y preparación de herramientas sugiere:

Descarga de payloads o herramientas adicionales

Comunicación con infraestructura controlada por el atacante

Este comportamiento no es consistente con el tráfico normal del servicio.

**Clasificación: True Positive**

<img width="1343" height="234" alt="imagen" src="https://github.com/user-attachments/assets/3f415c0e-0457-4a78-8a70-340a0950ff02" />


---

### 5. Acceso a información sensible

Se detectó acceso al directorio: ``~/.gnupg``


El acceso a estas rutas tras actividades de enumeración indica una posible fase de recolección de credenciales o material sensible.
Este comportamiento no forma parte de la operativa normal del sistema y es consistente con actividad de post-compromiso.

**Clasificación: True Positive**

<img width="1335" height="488" alt="imagen" src="https://github.com/user-attachments/assets/d463e9d6-a406-4678-be9e-530a90d75319" />


---

### 6. Actividad legítima del sistema

Se observó la ejecución periódica del comando: ``df -k``


El patrón de ejecución regular  (cada 2 minutos) y el contexto del proceso indican que esta actividad está asociada a tareas automáticas de monitorización o mantenimiento del sistema (posiblemente del servicio TeamCity).

No se observan indicios de interacción manual ni relación con la actividad maliciosa.

**Clasificación: False Positive**

<img width="1331" height="444" alt="imagen" src="https://github.com/user-attachments/assets/bb7b566f-9e69-48ea-a1e6-5a884c45fac4" />


---

### 7. Intento de explotación local

Finalmente se detectó la ejecución de un script relacionado con:

**CVE-2022-0847 (DirtyPipe)**

El script se encontraba en un directorio temporal (/tmp) y fue ejecutado desde una sesión interactiva.

La presencia de código de exploit público y su ejecución en este contexto indican un intento activo de escalada de privilegios local.

**Clasificación: True Positive**

<img width="1345" height="353" alt="imagen" src="https://github.com/user-attachments/assets/349924b2-c5dc-4aeb-bc0b-f8284c1d4899" />


---

## Análisis

La correlación de eventos muestra una secuencia típica de actividad tras el compromiso de un sistema:

1. Reconocimiento del entorno
2. Enumeración de privilegios
3. Preparación de herramientas
4. Comunicación externa
5. Acceso a datos sensibles
6. Intento de escalada de privilegios

La única alerta clasificada como False Positive corresponde a actividad normal de monitorización del sistema.

---

## Conclusión

La actividad observada en el host **NIX01** es consistente con un escenario de **post-compromiso** y preparación para escalada de privilegios mediante explotación local.

Indicadores clave:

- Enumeración interactiva del sistema
- Uso de herramientas de post-explotación
- Conexiones externas mediante herramientas de línea de comandos
- Ejecución de código relacionado con vulnerabilidades conocidas

Este tipo de comportamiento requiere una respuesta inmediata del SOC, incluyendo aislamiento del host, análisis forense y revisión de credenciales comprometidas.

---

## Lecciones aprendidas

- La correlación temporal de eventos es clave para identificar ataques reales.
- No todas las alertas deben clasificarse como maliciosas; la validación de contexto permite identificar False Positives.
- Las herramientas de enumeración y exploits conocidos son indicadores claros de actividad post-compromiso.



















