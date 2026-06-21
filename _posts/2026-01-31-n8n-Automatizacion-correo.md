---
layout: post
title: "Automatización inteligente de correos con n8n y OpenAI"
date: 2026-01-31
categories: [IA & Automatización]
tags: [IA, Docker, Python, AI Agents, n8n]
image:
  path: /assets/img/n8n.png
  alt: n8n OpenAI
  width: 500
  height: 280
  class: sz-contain
---


# 📧 Automatización de correo con n8n

En este proyecto vamos a crear una herramienta de automatización de correo electrónico utilizando **n8n**.

El objetivo es construir un agente capaz de:
- Leer correos entrantes  
- Procesarlos  
- Responder automáticamente  
- Gestionar la bandeja de entrada  

En definitiva, automatizar la administración del correo sin intervención manual.

---

## 1. Instalación del entorno local

Para evitar costes, trabajaremos en local utilizando **Docker**.

### Instalar Docker

Lo primero que haremos será instalar **Docker Desktop**.

<img width="1302" height="1051" alt="imagen" src="https://github.com/user-attachments/assets/963880a4-98e1-45fd-8248-f86bbff4f1a9" />

---

## 2. Ejecutar n8n en Docker

Una vez instalado Docker, descargaremos el contenedor de **n8n** (más de 100M de descargas).

### ¿Qué es un contenedor?

Un **contenedor** es un entorno aislado que incluye todo lo necesario para ejecutar una aplicación.  
En este caso, contendrá la aplicación **n8n** lista para funcionar.

### Ejecutar el contenedor

Exponemos el puerto **5678** y accedemos desde el navegador:

```
http://localhost:5678
```

<img width="2559" height="498" alt="imagen" src="https://github.com/user-attachments/assets/4e2ae0e0-a6a0-4360-b180-c6ee94bf229a" />


---

## 3. Configuración de acceso a Gmail

Para que n8n pueda acceder a nuestra bandeja de entrada, debemos crear credenciales en **Google Cloud**.

### 3.1 Crear un proyecto

En Google Cloud:

1. Ir a **Seleccionar proyecto**
2. Crear un nuevo proyecto  
3. Asignar el nombre:
```
gmail-n8n
```

<img width="2514" height="623" alt="imagen" src="https://github.com/user-attachments/assets/f7c5119e-6ca6-449a-a6ae-78c46d527cdb" />

<img width="794" height="391" alt="imagen" src="https://github.com/user-attachments/assets/bd7895c4-cc0b-45e8-8936-c87eb3940c1e" />

<img width="618" height="273" alt="imagen" src="https://github.com/user-attac```hments/assets/427cc3dd-cfbb-4df3-989e-7d2a5b84d8b9" />

> ⚠️ Importante: Las credenciales de Google se crean por proyecto y son independientes.

---

### 3.2 Habilitar la API de Gmail

Con el proyecto activo:

1. Ir a **APIs y servicios**
2. Buscar **Gmail API**
3. Hacer clic en **Habilitar**

<img width="1239" height="776" alt="imagen" src="https://github.com/user-attachments/assets/d1ba5dbc-46de-42a8-a280-3ea10980db0d" />

Esto permitirá que n8n se comunique con Gmail mediante su API.

---

### 3.3 Crear credenciales OAuth

Además de habilitar la API, debemos crear credenciales de acceso:

1. Ir a **Credenciales**
2. Crear **ID de cliente OAuth**
3. Tipo de aplicación: **Web**
4. Añadir la **URL de redirección** que proporciona n8n

<img width="1231" height="672" alt="imagen" src="https://github.com/user-attachments/assets/38d39785-2c88-40be-9828-a73b4e558f1a" />

<img width="887" height="1046" alt="imagen" src="https://github.com/user-attachments/assets/951bc0e8-0eb2-4274-9212-6af2e0b7efff" />

<img width="1198" height="738" alt="imagen" src="https://github.com/user-attachments/assets/fb499b38-4905-404d-869c-68f4805033e7" />

---

### 3.4 Conectar n8n con Google

Una vez creadas las credenciales, copia los siguientes datos en n8n:

- **Client ID**
- **Client Secret**

<img width="1197" height="746" alt="imagen" src="https://github.com/user-attachments/assets/5a81974f-6879-49f0-b9c2-06dae2757101" />

---

### 3.5 Añadir usuario de pruebas

Si la aplicación está en modo testing, debes añadir el correo que utilizarás como **usuario de prueba**.

<img width="905" height="1111" alt="imagen" src="https://github.com/user-attachments/assets/dba2d8c3-c72d-444f-9682-f9d9afdc94b9" />


## 4. Configuración de acceso a Agente de IA

De igual modo que hicimos con gemail, debemos conseguir las claves de nuestro agente de IA para que n8n pueda conectarse con dicho agente y lo pueda utilizar.

En mi caso utilizare OpenAI, para esto nos vamos a su página y entramos.
<img width="898" height="673" alt="imagen" src="https://github.com/user-attachments/assets/ffbcdd4e-2ae5-44e9-a240-723191008344" />

Nos dirigimos al apartado de API Keys y generamos una la cual usaremos en n8n
<img width="2508" height="752" alt="imagen" src="https://github.com/user-attachments/assets/87fc8dec-b780-44b6-9bcb-efdfa170c558" />

Importante, recuerda que OpenAI tiene un precio por token y esta automatizacion generará unos costes derivados de su utilizacion. Hay alternativas gratuitas como OLLAMA las cuales pueden resultar interesantes.

Despues de esto solo nos quedará ingresar la clave en n8n y de esta manera conseguir la conexion
<img width="1268" height="791" alt="imagen" src="https://github.com/user-attachments/assets/60634080-a971-4e65-b60e-447c6e79adc5" />


---

## Resultado

Ahora tenemos:
- n8n funcionando en local con Docker
- Conexión OAuth con Google
- Acceso a Gmail
- Acceso a OpenAI

Este es el primer paso para construir un **agente de automatización de correo inteligente**.

---

## 5. Creación del workflow en n8n

En esta sección se describe el flujo completo y su configuración dentro de **n8n**.

**n8n** es una herramienta de automatización *low-code / no-code* que permite construir procesos mediante nodos conectados entre sí, sin necesidad de programar directamente.

Una vez preparado el entorno, comenzamos a diseñar el workflow de automatización de correo.

---

### 5.1 Trigger del flujo

Todo workflow en n8n debe comenzar con un **trigger**, que es el evento que inicia la ejecución.

En este caso utilizaremos un nodo **Schedule Trigger**, que ejecutará el flujo automáticamente cada cierto intervalo de tiempo.

> El flujo se activará periódicamente para revisar nuevos correos.

<img width="786" height="553" alt="imagen" src="https://github.com/user-attachments/assets/32a5f7a3-faca-435b-86f5-f84faf42ed01" />

---

### 5.2 Obtención de correos (Gmail – Get Many)

El siguiente nodo es **Gmail → Get Many Messages**.

Este módulo permite recuperar múltiples correos de forma automática.  
Se configura con la etiqueta: INBOX


De esta forma, el flujo evaluará todos los mensajes presentes en la bandeja de entrada.

<img width="1291" height="799" alt="imagen" src="https://github.com/user-attachments/assets/9634004b-3959-4c75-b512-3fb4b69fb2ef" />

Cada correo obtenido será procesado individualmente por los siguientes nodos del flujo.

---

### 5.3 Análisis del contenido con IA

El siguiente módulo es **Message a model**, que utiliza **OpenAI** para analizar el contenido del correo.

Para realizar el análisis:
- Se extrae el **asunto**
- Se extrae el **cuerpo del mensaje**
- Estos datos se insertan en el **prompt** mediante variables

El modelo clasifica el correo según su contenido (por ejemplo: precio, quejas, agradecimientos, etc.).

<img width="1942" height="864" alt="imagen" src="https://github.com/user-attachments/assets/f8d73e87-bb20-41ad-8342-4b381c3016a0" />

---

### 5.4 Enrutamiento según la clasificación (Switch)

El nodo **Switch** dirige el flujo en función de la clasificación realizada por el modelo.

Dependiendo del resultado, el correo se enviará por una rama diferente del workflow.

En el ejemplo, el modelo ha clasificado el mensaje como **Quejas y reclamaciones**, por lo que el flujo continúa por esa ruta.

<img width="2432" height="944" alt="imagen" src="https://github.com/user-attachments/assets/ada6c987-8ba2-41da-a3a1-7076b26f4d51" />

---

### 5.5 Organización del correo (Add Label)

Para organizar los mensajes, se utiliza el nodo **Gmail → Add label to message**.

Este módulo añade la etiqueta correspondiente según la categoría detectada.  
Por ejemplo: Quejas y reclamaciones



De esta forma, los correos quedan clasificados automáticamente dentro de Gmail.

<img width="1596" height="695" alt="imagen" src="https://github.com/user-attachments/assets/24b9fd31-a3e1-4d3e-bae1-358a535e9822" />

---

### 5.6 Limpieza de la bandeja de entrada

Una vez clasificado el correo, se elimina la etiqueta:

- `INBOX`
- `UNREAD`

Esto se realiza mediante el nodo **Remove label from message**.

El resultado:
- El correo queda marcado como leído
- Desaparece de la bandeja principal
- Permanece únicamente en su categoría

<img width="1650" height="725" alt="imagen" src="https://github.com/user-attachments/assets/40132407-276e-4429-a38b-a4503bbdc316" />

---

### 5.7 Generación de respuesta automática (AI Agent)

Tras clasificar y organizar el correo, el siguiente paso es generar una respuesta automática.

Para ello se utiliza el nodo **AI Agent**, que crea una respuesta mediante inteligencia artificial.

Al agente se le proporcionan:

- Asunto del correo
- Contenido del mensaje
- Dirección del remitente

Opcionalmente, se puede conectar una base de datos como memoria para mantener el contexto de conversaciones anteriores (por ejemplo, por `threadId`).

El comportamiento del agente se controla mediante un **prompt personalizado**.

<img width="2443" height="530" alt="imagen" src="https://github.com/user-attachments/assets/9320a2b2-a2c3-44d1-a643-c9efb1f64dae" />
<img width="684" height="1109" alt="imagen" src="https://github.com/user-attachments/assets/a6390dcf-a642-4589-83d2-57c91250dad1" />

---

### 5.8 Envío de la respuesta

Finalmente, el correo se responde automáticamente utilizando el nodo: Gmail → Reply to message


Este módulo envía como respuesta el texto generado por el agente de IA.

<img width="721" height="691" alt="imagen" src="https://github.com/user-attachments/assets/e0d9d172-dd87-40bc-bff8-4b481933b76b" />

---

### 5.9 Flujo completo

El resultado final es un sistema que:

1. Revisa periódicamente nuevos correos  
2. Analiza su contenido mediante IA  
3. Los clasifica automáticamente  
4. Los organiza en Gmail  
5. Genera y envía respuestas automáticas  

<img width="2213" height="918" alt="imagen" src="https://github.com/user-attachments/assets/488ead20-5dd7-4112-86b1-07b1ad82a537" />

---

## Resultado

<img width="1120" height="715" alt="imagen" src="https://github.com/user-attachments/assets/2f2246b0-7433-4330-a1e8-dc6842304fd1" />


Este workflow constituye un sistema completo de gestión inteligente de correo que permite:

- Automatizar la clasificación de mensajes  
- Mantener la bandeja de entrada organizada  
- Reducir el tiempo de respuesta  
- Atender clientes de forma automática mediante IA
