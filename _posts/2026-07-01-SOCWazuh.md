---
title: "SOC inteligente con Wazuh e IA local (ARIA)"
date: 2026-06-21
categories: [Ciberseguridad, Defensive]
tags: [Wazuh, SIEM, IA, Ollama, Mistral, FastAPI, Python, SOC, MITRE, Suricata, YARA]
---

En este artículo documento paso a paso cómo construí  un SOC con una capa de IA.

Lo primero era buscar un nombre chulo y como en el campo de la ciberseguridad es todo en inglés pues decidí **ARIA** (Automated Response & Intelligence Analyst), ademas que soy fan de juego de tronos.

Aria es un SOC doméstico inteligente que combina [Wazuh](https://wazuh.com) como SIEM con un LLM local Ollama para analizar alertas de seguridad en tiempo real. 

El proyecto tiene dos grandes bloques: primero montar el SIEM con algunas capas de detección, y después construir la capa de inteligencia artificial que analiza automáticamente cada alerta.

Código disponible en [github.com/JorgeGonzalezVlc/ARIA](https://github.com/JorgeGonzalezVlc/ARIA).

---

## Arquitectura del sistema

```
Endpoints (Windows 11 + Ubuntu Desktop)
├── Agente Wazuh          → eventos del sistema
├── Suricata              → IDS de red
├── FIM + YARA            → integridad de ficheros
└── VirusTotal API        → threat intelligence
          ↓
  Wazuh Manager + OpenSearch
  (VM Ubuntu Server 22.04 — 192.168.1.254)
          ↓
  Webhook HTTP POST (tiempo real)
          ↓
  ARIA — FastAPI Backend
  (PC Windows — 192.168.1.100:8000)
          ↓
  Ollama + Mistral (LLM 100% local)
          ↓
  Análisis + MITRE ATT&CK + Threat Score
```

Consideré que era mejor un modelo local ya que trabajaría con logs de nuestra red y no quería exponerlos a pesar de que antropic por ejemplo dice que no usa los datos de la api para entrenar sus modelos...

---

## Parte 1 — Infraestructura base

### Preparar la máquina virtual

**Herramienta:** [VirtualBox](https://www.virtualbox.org/) | **ISO:** [Ubuntu Server 22.04 LTS](https://ubuntu.com/download/server)

Instalé Ubuntu Server 22.04 LTS en VirtualBox. La versión 22.04 es importante, es la que mejor soporte tiene con Wazuh, tiene mantenimiento hasta 2027 y me aseguro que sera estable.

La configuración de red es importante. Como vamos a conectar máquinas virtuales con máquinas de mi propia red es necesario usar el **Adaptador puente (bridge)**. 

Durante el asistente de instalación de Ubuntu configuré:

- **IP estática**: `192.168.1.254` (para esto fue necesario entrar en el router y hacer alguna minima configuración, para evitar posibles conflictos con DHCP)
- **OpenSSH**: instalado durante la configuración inicial

> **Por qué IP estática**: El Manager de Wazuh tiene que tener siempre la misma IP porque todos los agentes están configurados para apuntar a ella. Si cambia, los agentes pierden la conexión. Los servicios por lo general mejor tenerlos siempre en la misma casa

Con SSH activo puedo cerrar la ventana de VirtualBox y trabajar todo desde el terminal de mi PC principal:

```bash
ssh jorge@192.168.1.254
```

### Instalar Wazuh


Antes de instalar nada, actualizar el sistema:

```bash
sudo apt update && sudo apt upgrade -y
```

**Documentación oficial:** [Wazuh Quickstart](https://documentation.wazuh.com/current/quickstart.html)

Wazuh tiene un instalador automático que despliega tres componentes en un solo nodo: **Manager, Indexer y Dashboard**

```bash
curl -sO https://packages.wazuh.com/4.7/wazuh-install.sh
sudo bash wazuh-install.sh -a
```

El proceso tarda un rato. Al finalizar muestra las credenciales:

```
INFO: --- Summary ---
INFO: You can access the web interface https://192.168.1.254
    User: admin
    Password: XXXXXXXXXXXXXXXX
```

**Guardar estas credenciales**, no se vuelven a mostrar, verifica que todos los servicios están activos y los puertos escuchando

```bash
sudo systemctl status wazuh-manager wazuh-indexer wazuh-dashboard
```

```bash
sudo ss -tlnp | grep -E "1514|1515|55000|9200|443"
```

| Puerto | Servicio | Descripción |
|--------|----------|-------------|
| 443 | Dashboard | Interfaz web (HTTPS) |
| 55000 | API REST | Gestión del Manager |
| 9200 | OpenSearch | Almacenamiento de logs |
| 1514 | wazuh-remoted | Recepción de eventos de agentes |
| 1515 | wazuh-authd | Registro de agentes nuevos |

Al dashboard puedes entrar en `https://192.168.1.254`.

---

## Parte 2 — Conectar agentes

### Agente en Windows 11

**Documentación:** [Wazuh Agent Windows](https://documentation.wazuh.com/current/installation-guide/wazuh-agent/wazuh-agent-package-windows.html)

En el dashboard: **Server Management → Endpoints Summary → Deploy new agent**.

El asistente genera automáticamente el comando de instalación completo y solo hay que **ejecutarlo en powershell como admin**. Es importante, yo me tire un rato hasta que me di cuenta del error.

```powershell
Invoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.14.5-1.msi" `
  -OutFile $env:tmp\wazuh-agent
msiexec.exe /i $env:tmp\wazuh-agent /q `
  WAZUH_MANAGER='192.168.1.254' `
  WAZUH_AGENT_GROUP='default' `
  WAZUH_AGENT_NAME='Pc-Jorge'
NET START WazuhSvc
```

### Agente en Ubuntu Desktop

**Documentación:** [Wazuh Agent Linux DEB](https://documentation.wazuh.com/current/installation-guide/wazuh-agent/wazuh-agent-package-linux.html)

En Ubuntu es igual que en Windows, cambia que es un .deb pero te lo dan todo ya listo:

```bash
wget https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/wazuh-agent_4.14.5-1_amd64.deb
sudo WAZUH_MANAGER='192.168.1.254' WAZUH_AGENT_NAME='jorge-ubu' \
  dpkg -i wazuh-agent_4.14.5-1_amd64.deb
sudo systemctl enable wazuh-agent
sudo systemctl start wazuh-agent
```


Con los dos agentes activos el dashboard muestra:

![Dashboard Wazuh con dos agentes activos](assets/img/aria/dashboard_con_los_dos_clientes_conectados.png)
*Dos agentes activos: Pc-Jorge (Windows 11 — 192.168.1.100) y jorge-ubu (Ubuntu 22.04 — 192.168.1.138)*

---

## Parte 3 — Capas de detección

### File Integrity Monitoring (FIM)

**Documentación:** [Wazuh FIM](https://documentation.wazuh.com/current/user-manual/capabilities/file-integrity/index.html)

FIM viene activado por defecto en Wazuh a través del módulo **syscheck**. Monitoriza cambios en ficheros y directorios — creaciones, modificaciones, eliminaciones y cambios de permisos.

Para añadir directorios específicos editar el `ossec.conf` del agente Windows en `C:\Program Files (x86)\ossec-agent\ossec.conf`:

```xml
<syscheck>
  <!-- Directorio a monitorizar en tiempo real -->
  <directories realtime="yes" check_all="yes">
    C:\Users\jorge\Downloads
  </directories>
  
  <!-- Frecuencia del escaneo completo (en segundos) -->
  <frequency>43200</frequency>
</syscheck>
```

Reiniciar el agente para aplicar los cambios:

```powershell
NET STOP WazuhSvc
NET START WazuhSvc
```

Verificar en el log del agente que FIM ha arrancado:

```powershell
Get-Content "C:\Program Files (x86)\ossec-agent\ossec.log" -Tail 10
```

Deben aparecer líneas como:
```
File integrity monitoring scan started
Real-time file integrity monitoring started
```

### Integración con VirusTotal

**Documentación:** [Wazuh VirusTotal integration](https://documentation.wazuh.com/current/user-manual/capabilities/malware-detection/virus-total-integration.html) | **API:** [VirusTotal](https://www.virustotal.com/gui/my-apikey)

Cuando FIM detecta un fichero nuevo, Wazuh puede enviarlo a [VirusTotal](https://www.virustotal.com) para análisis automático. Si el fichero es detectado como malicioso, genera una alerta de alta severidad.

Editar `/var/ossec/etc/ossec.conf` en el Manager y añadir antes de `</ossec_config>`:

```xml
<integration>
  <name>virustotal</name>
  <api_key>TU_API_KEY</api_key>
  <group>syscheck</group>
  <alert_format>json</alert_format>
</integration>
```

La API key gratuita de VirusTotal tiene un límite de 4 peticiones por minuto — suficiente para un home lab.

Reiniciar el Manager:

```bash
sudo systemctl restart wazuh-manager
```

Para probarlo crear un fichero en el directorio monitorizado:

```powershell
New-Item "$env:USERPROFILE\Downloads\malware_test.exe" -ItemType File
```

En el dashboard aparecen las alertas de FIM y VirusTotal:

![Alertas de FIM y VirusTotal en Wazuh](assets/img/aria/virus_total_en_windows_deteccion_de_archivo.png)
*FIM detecta el nuevo fichero (rule 554) y VirusTotal lo analiza automáticamente (rule 87104)*

### Suricata — IDS de red

**Documentación:** [Suricata](https://suricata.io/documentation/) | **Reglas ET/Open:** [Emerging Threats](https://rules.emergingthreats.net/)

[Suricata](https://suricata.io) es un sistema de detección de intrusiones de red open source. Mientras Wazuh monitoriza lo que ocurre dentro del host, Suricata analiza el tráfico de red en busca de patrones maliciosos.

> **Importante**: Suricata funciona mucho mejor en Linux que en Windows. En Windows la versión 8.x tiene problemas de compatibilidad con los drivers de captura de red (Npcap) que hacen que no detecte correctamente el tráfico.

Instalación en Ubuntu Desktop:

```bash
sudo apt install suricata -y
```

Activar el ruleset [Emerging Threats Open](https://rules.emergingthreats.net/open/suricata/) — es gratuito y cubre miles de amenazas conocidas:

```bash
sudo suricata-update enable-source et/open
sudo suricata-update
sudo systemctl restart suricata
```

Verificar que está corriendo y capturando tráfico:

```bash
sudo systemctl status suricata
sudo tail -f /var/log/suricata/fast.log
```

Integrar con Wazuh añadiendo en el `ossec.conf` del agente Ubuntu (`/var/ossec/etc/ossec.conf`):

```xml
<localfile>
  <log_format>json</log_format>
  <location>/var/log/suricata/eve.json</location>
</localfile>
```

Reiniciar el agente:

```bash
sudo systemctl restart wazuh-agent
```

> **Problema encontrado**: Suricata no alerta sobre tráfico normal como pings — solo genera alertas cuando una regla específica dispara. Para detectar escaneos de red con Nmap es necesario tener activas las reglas `emerging-scan.rules`. Las reglas por defecto de la instalación son básicas.

### Reglas YARA

**Documentación:** [YARA](https://yara.readthedocs.io/) | [Wazuh YARA integration](https://documentation.wazuh.com/current/user-manual/capabilities/malware-detection/yara/index.html)

[YARA](https://virustotal.github.io/yara/) permite detectar malware en ficheros basándose en patrones de bytes, strings y condiciones lógicas. Es la herramienta estándar en análisis forense y threat hunting.

Wazuh ejecuta automáticamente YARA sobre los ficheros que FIM detecta como nuevos o modificados.

---

## Parte 4 — Verificar la detección

Antes de pasar a la IA, verificar que Wazuh está detectando eventos correctamente. Un test básico es generar intentos de autenticación fallida:

```powershell
net use \\localhost\IPC$ /user:usuariofalso contraseñafalsa
```

Ejecutarlo 4-5 veces. Este comando intenta conectarse a un recurso compartido de red en el propio equipo con credenciales inexistentes — Windows lo registra como evento de seguridad y Wazuh lo captura inmediatamente.

En el dashboard (Threat Intelligence → Threat Hunting, filtrar por agente Pc-Jorge):

![Alerta de login fallido en Wazuh](assets/img/aria/evento_loginfailure_windows.png)
*Wazuh detecta los intentos de autenticación fallida — regla 60122, nivel 5*

El agente Ubuntu también genera eventos interesantes de forma natural, sesiones PAM, cambios en servicios Systemd, evaluaciones CIS Benchmark:

![Eventos del agente Ubuntu en Wazuh](assets/img/aria/captura_de_cliente_ubuntu.png)
*El agente jorge-ubu generando eventos variados incluyendo VirusTotal y evaluaciones de seguridad*

---

## Parte 5 — ARIA: la capa de inteligencia artificial

### Instalar Ollama y el modelo Mistral

**Herramienta:** [Ollama](https://ollama.com/) | **Modelo:** [Mistral](https://ollama.com/library/mistral)

[Ollama](https://ollama.com) permite ejecutar LLMs localmente de forma sencilla. Descargarlo desde [ollama.com/download](https://ollama.com/download/windows) e instalarlo.

En Settings de Ollama activar **"Expose Ollama to the network"** — necesario para que el backend de ARIA pueda conectarse a Ollama.

Descargar el modelo Mistral (unos 4GB):

```powershell
ollama pull mistral
```

Ollama expone una API REST en `http://localhost:11434`. Verificar que funciona:

```
http://localhost:11434
```

Debe devolver `Ollama is running`.

### Estructura del proyecto ARIA

```
ARIA/
├── api/
│   ├── __init__.py          ← necesario para que Python trate la carpeta como módulo
│   ├── main.py              ← FastAPI app + endpoint webhook
│   └── requirements.txt
├── ai_engine/               ← ojo: guión bajo, no guión medio
│   ├── __init__.py
│   └── ollama_client.py     ← cliente Ollama + prompts SOC
├── frontend/                ← Streamlit dashboard (en desarrollo)
├── db/                      ← esquema PostgreSQL (en desarrollo)
└── README.md
```

> **Problema encontrado**: la carpeta se llamó inicialmente `ai-engine` con guión medio. Python no puede importar módulos con guión en el nombre porque lo interpreta como operador de resta. Hay que usar guión bajo: `ai_engine`.

> **Problema encontrado**: al crear los ficheros `__init__.py` hay que asegurarse de que existen en todas las carpetas que se importan como módulos. Sin ellos Python no reconoce la carpeta como paquete y lanza `AttributeError: module has no attribute 'app'`.

Crear el entorno virtual e instalar dependencias:

```powershell
cd "C:\ruta\a\ARIA"
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn requests python-dotenv
pip freeze > api/requirements.txt
```

### Backend FastAPI

**Documentación:** [FastAPI](https://fastapi.tiangolo.com/)

[FastAPI](https://fastapi.tiangolo.com) es un framework web moderno para Python que genera automáticamente documentación interactiva de la API (Swagger UI) en `/docs`.

Crear `api/main.py`:

```python
from fastapi import FastAPI, Request
from ai_engine.ollama_client import analyze_alert
import json

app = FastAPI(title="ARIA - Automated Response & Intelligence Analyst")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ARIA"}

@app.post("/api/v1/ingest")
async def ingest_alert(request: Request):
    alert = await request.json()
    print(f"[ARIA] Alerta recibida: {alert.get('rule', {}).get('description', '')}")
    
    print("[ARIA] Enviando a Ollama...")
    try:
        analysis = analyze_alert(alert)
        print(f"[ARIA] Análisis completado: {json.dumps(analysis, indent=2, ensure_ascii=False)}")
    except Exception as e:
        print(f"[ARIA] Error en análisis: {e}")
        analysis = {"error": str(e)}
    
    return {"status": "received", "analysis": analysis}
```

Arrancar el servidor:

```powershell
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

- `--reload`: reinicia automáticamente cuando hay cambios en el código
- `--host 0.0.0.0`: accesible desde cualquier IP de la red, no solo localhost
- `--port 8000`: puerto donde escucha ARIA

Verificar en `http://localhost:8000/health` — debe devolver `{"status":"ok","service":"ARIA"}`.

### Cliente Ollama con prompts de SOC

Crear `ai_engine/ollama_client.py`:

```python
import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "mistral"

def analyze_alert(alert: dict) -> dict:
    """
    Envía una alerta de Wazuh a Ollama y devuelve el análisis estructurado.
    """
    prompt = f"""Eres un analista SOC senior. Analiza esta alerta de seguridad 
y responde ÚNICAMENTE en JSON válido, sin texto adicional, sin markdown.

ALERTA:
{json.dumps(alert, indent=2)}

Responde SOLO con este JSON:
{{
  "what_happened": "qué ocurrió en lenguaje claro",
  "why_dangerous": "por qué es peligroso",
  "impact": "impacto potencial",
  "false_positive_probability": 0.0,
  "mitre_tactic": "nombre de la táctica",
  "mitre_technique": "T1XXX",
  "threat_score": "LOW|MEDIUM|HIGH|CRITICAL",
  "recommendations": ["acción 1", "acción 2"]
}}"""

    response = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False      # esperamos la respuesta completa, no streaming
    })

    result = response.json()
    text = result.get("response", "").strip()
    
    # Limpiar posibles bloques de código markdown que el modelo añada
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        # Extraer el JSON de la respuesta
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception as e:
        return {"error": str(e), "raw": text}
```

> **Problema encontrado**: Mistral a veces devuelve el JSON con caracteres escapados (`\n`, `\"`) dentro del string de respuesta, lo que rompe el parser. Esto ocurre especialmente cuando el modelo añade contexto adicional alrededor del JSON a pesar de las instrucciones del prompt. La solución más robusta es limpiar el texto antes de parsearlo y extraer solo el bloque `{...}`.

### Webhook — conectar Wazuh con ARIA

Este es el punto de unión entre el SIEM y la IA.

Wazuh tiene un sistema de integraciones custom: cuando en la configuración se define `<name>custom-aria</name>`, Wazuh busca automáticamente un fichero llamado `custom-aria` en `/var/ossec/integrations/` y lo ejecuta cada vez que una alerta supera el nivel configurado.

Wazuh pasa la alerta al script como fichero temporal en `sys.argv[1]` — es decir, ejecuta el script así:
```
python3 /var/ossec/integrations/custom-aria /tmp/alerta_abc123.json
```

**Paso 1**: Añadir el bloque de integración en `/var/ossec/etc/ossec.conf` del Manager:

```xml
<!-- Integración ARIA -->
<integration>
  <name>custom-aria</name>
  <hook_url>http://192.168.1.100:8000/api/v1/ingest</hook_url>
  <level>3</level>              <!-- alertas de nivel 3 o superior -->
  <alert_format>json</alert_format>
</integration>

<!-- Integración VirusTotal -->
<integration>
  <name>virustotal</name>
  <api_key>TU_API_KEY</api_key>
  <group>syscheck</group>
  <alert_format>json</alert_format>
</integration>
```

> **Nota**: la IP `192.168.1.100` es la del PC donde corre ARIA (el PC Windows), no la del servidor Wazuh. El Manager necesita saber a dónde enviar las alertas.

**Paso 2**: Crear el script en el servidor:

```bash
sudo nano /var/ossec/integrations/custom-aria
```

```python
#!/usr/bin/env python3
import sys
import json
import requests

# Wazuh pasa la alerta como fichero temporal — sys.argv[1] es su ruta
alert_file = sys.argv[1]

with open(alert_file) as f:
    alert = json.load(f)

# Enviamos la alerta a ARIA por HTTP POST
requests.post(
    "http://192.168.1.100:8000/api/v1/ingest",
    json=alert,
    timeout=5
)
```

**Paso 3**: Dar los permisos correctos — el script debe ser ejecutable y pertenecer al grupo `wazuh`:

```bash
sudo chmod +x /var/ossec/integrations/custom-aria
sudo chown root:wazuh /var/ossec/integrations/custom-aria
sudo systemctl restart wazuh-manager
```

> **Por qué estos permisos**: Wazuh corre como usuario `wazuh` en el sistema. Si el script no tiene los permisos correctos, el usuario `wazuh` no puede ejecutarlo y la integración falla silenciosamente — sin errores visibles, simplemente no llega nada a ARIA.

Verificar que el webhook funciona revisando el log de integraciones:

```bash
sudo tail -f /var/ossec/logs/integrations.log
```

---

## Resultado final

Con todo configurado el flujo completo funciona en tiempo real. Generando un intento de login fallido en Windows:

```powershell
net use \\localhost\IPC$ /user:usuariofalso contraseñafalsa
```

En el terminal de ARIA aparece el análisis completo de Mistral en segundos:

![ARIA analizando una alerta en tiempo real](assets/img/aria/respuesta_aria.jpg)
*ARIA recibe la alerta de Wazuh y Mistral genera el análisis con MITRE mapping y threat score automáticamente*

Wazuh detecta → webhook instantáneo → ARIA recibe → Mistral analiza → resultado estructurado. Todo local, sin que ningún dato salga del entorno.

---

## Resumen de problemas encontrados

| Problema | Causa | Solución |
|----------|-------|----------|
| `NET START Wazuh` falla | El servicio se llama `WazuhSvc` en Windows | Usar `NET START WazuhSvc` |
| PowerShell da error críptico al instalar agente | Sin privilegios de administrador | Abrir PowerShell como administrador |
| `AttributeError: module has no attribute 'app'` | Falta `__init__.py` en la carpeta `api/` | Crear el fichero vacío |
| Error de importación `ai-engine` | Python no permite guiones en nombres de módulos | Renombrar a `ai_engine` |
| Webhook no llega a ARIA | Script sin permisos de ejecución | `chmod +x` y `chown root:wazuh` |
| Suricata no detecta tráfico en Windows | Incompatibilidad de la versión 8.x con Npcap | Usar Suricata en Linux |
| JSON de Mistral no parsea | El modelo añade texto o escapes alrededor del JSON | Extraer bloque `{...}` y limpiar markdown |

---

## Conclusión

El proyecto hasta ahora ha sido muy interesante, he trasteado mucho, he roto cosas y las he arreglado después, he visto cómo conectar con webhooks, he integrado IA, reglas YARA, en definitiva he jugado un poco.

Como todo esto podría seguir creciendo, se me ocurre hacer un chatbot para consultas, automatizar alertas mediante Telegram, correo o WhatsApp, hacer respuesta automática ante ciertas alertas, tener un dashboard para ver todo bonito...

Veremos cómo continuamos, pero por ahora lo dejamos aquí.

Si quieres el código completo lo tienes en [github.com/JorgeGonzalezVlc/ARIA](https://github.com/JorgeGonzalezVlc/ARIA).
