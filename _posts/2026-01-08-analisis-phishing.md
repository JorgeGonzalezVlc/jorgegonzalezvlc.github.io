---
layout: post
title: "Análisis de correo de phishing"
date: 2026-01-08
categories: [Blue Team]
tags: [Phishing, Forense, Blue Team]
image:
  path: /assets/img/phishing2.png
  alt: Phishing Detector
  width: 500
  height: 280
  class: sz-contain
---

Se analizó un correo electrónico que suplantaba a PayPal tras ser recibido por un usuario. El análisis confirmó que se trataba de un intento de phishing cuyo objetivo era redirigir a la víctima a un enlace malicioso con el fin de robar credenciales

<img width="799" height="559" alt="imagen" src="https://github.com/user-attachments/assets/bdfab230-4ff6-4e72-8427-8b8d486e7f22" />


---

## Detección
El correo levantó sospechas por los siguientes motivos:
- Uso de la imagen corporativa de PayPal
- Mensaje urgente solicitando una acción inmediata
- Idioma alemán no habitual para el destinatario
- Inclusión de un enlace para continuar un supuesto proceso de entrega

---

## Análisis

### Análisis de cabeceras del correo
El análisis de las cabeceras reveló que el dominio del *return-path* no pertenece a PayPal, lo que indica una suplantación del remitente.

**Return-Path identificado:** bounce@rjttznyzjydmillquh.designclub.uk.com

<img width="811" height="640" alt="imagen" src="https://github.com/user-attachments/assets/e19dc58d-b990-4528-8d2c-cbf8bb0be10d" />


### Análisis de la URL
El enlace incluido en el correo redirigía a un dominio externo no asociado con PayPal.

**Dominio identificado:** storage.googleapis.com

<img width="800" height="632" alt="imagen" src="https://github.com/user-attachments/assets/6d003f52-18c2-4822-b588-a0a5e042d10f" />

### Análisis de reputación
La URL fue analizada mediante un servicio de inteligencia de amenazas, donde fue marcada como maliciosa por varios motores de detección.

**SHA-256 del cuerpo de la respuesta:** 13945ecc33afee74acf7f72e1d5bb73050894356c4bf63d02a1a53e76830567f5

<img width="1403" height="1002" alt="imagen" src="https://github.com/user-attachments/assets/7f4f65e2-ae7f-40f1-8387-1f05d4ee968f" />

## Impacto
En caso de que el usuario hubiera accedido al enlace e introducido sus credenciales, el atacante podría haber obtenido acceso no autorizado a la cuenta de PayPal, con riesgo de fraude económico y compromiso adicional de información.

Durante el análisis no se observó evidencia de interacción por parte del usuario.

---

## Mitigación
- Bloqueo de la URL maliciosa en pasarela de correo y navegación web
- Eliminación del correo de la bandeja del usuario
- Concienciación al usuario sobre correos de phishing
- Configuración y revisión de políticas SPF, DKIM y DMARC
- Monitorización de campañas similares

---

## Lecciones aprendidas
- Servicios cloud legítimos pueden ser utilizados para alojar contenido malicioso
- El análisis de cabeceras sigue siendo clave para detectar suplantación
- La formación de usuarios es un control defensivo esencial frente al phishing
