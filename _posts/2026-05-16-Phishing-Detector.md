---
layout: post
title: "Sistema de deteccion de phishing inteligente"
date: 2026-05-16
categories: [Automatización]
tags: [Docker, VirusTotal, FastAPI, Gmail API, proyectos, ia, python, AI Agents, Inteligencia Artificial]
---


# 🛡️ Phishing Detector

Sistema de detección inteligente de phishing por email mediante IA, desarrollado en Python.

## ¿Qué hace?

Analiza emails de Gmail en busca de indicadores de phishing combinando dos enfoques:

- **Motor de reglas** — detecta patrones conocidos: urgencia, spoofing, dominios sospechosos, TLDs maliciosos, petición de credenciales...
- **Análisis con IA** — Claude (Anthropic) actúa como analista SOC, identifica técnicas MITRE ATT&CK y genera un informe estructurado
- **VirusTotal:** — Verificación de URLs contra +70 motores antivirus, Score independiente 0-100

---

## Ejemplo de output

```json
{
  "classification": "phishing",
  "risk_score": 97,
  "severity": "critical",
  "mitre_technique": "T1566.002",
  "mitre_technique_name": "Phishing: Spearphishing Link",
  "virus_total_score": 35,
  "reasons": [
    "Dominio fraudulento suplantando al Banco Santander con TLD .tk",
    "Reply-To diferente al remitente — técnica clásica de spoofing",
    "Solicitud explícita de credenciales mediante enlace HTTP sin cifrado"
  ],
  "attack_summary": "Ataque de phishing bancario dirigido a clientes del Banco Santander mediante dominio fraudulento para robo de credenciales.",
  "recommended_action": "delete"
}
```
---

## Arquitectura

Gmail API → Parser → IOC Extractor → Risk Engine → VirusTotal → LLM (Claude) → JSON Response (SQLite + FastAPI)

## Pipeline de análisis

Email recibido → Extracción de IOCs (URLs, IPs, dominios, adjuntos) → Motor de reglas → Risk Score preliminar → Verificación de URLs contra VirusTotal → Análisis con Claude → Clasificación + MITRE ATT&CK → Acción automática en Gmail → Guardado en base de datos

---

## Tecnologías

- **Python** — lenguaje principal
- **FastAPI** — API REST para exponer el servicio
- **Anthropic Claude** — análisis inteligente y clasificación
- **Gmail API** — lectura y gestión de emails reales
- **VirusTotal API** — verificación de URLs contra base de datos de malware
- **SQLAlchemy + SQLite** — persistencia de análisis
- **Pydantic** — validación de datos
- **Docker** — containerización para despliegue portable
- **tldextract, dnspython, BeautifulSoup** — extracción de IOCs

## IOCs detectados

- URLs y dominios maliciosos
- Direcciones IP en headers
- TLDs sospechosos (.tk, .xyz, .ml...)
- Extensiones de adjuntos peligrosas
- Spoofing de remitente (Reply-To vs From)
- Lenguaje urgente / ingeniería social
- Petición de credenciales

## Sistema de scoring y acciones

| Clasificación | Risk Score | Acción | Carpeta Gmail |
|---|---|---|---|
| Phishing crítico | ≥ 90 | delete | Phishing/Eliminado |
| Sospechoso | ≥ 70 | escalate | Phishing/Revisar |
| Cuarentena | ≥ 50 | quarantine | Phishing/Cuarentena |
| Revisión | ≥ 25 | review | Phishing/Revisar |
| Legítimo | < 25 | safe | — |

## Instalación y uso

### Opción 1 — Docker (Para integrar con otros programas tipo SIEM, existe el problema de obtener el id del mensaje.)

```bash
git clone https://github.com/JorgeGonzalezVlc/phishing-detector
cd phishing-detector
```

Configura tus credenciales en `.env` (ver `.env.example`) y añade `credentials.json` de Google Cloud Console.

```bash
docker build -t phishing-detector .
docker-compose up
```

API disponible en `http://localhost:8000/docs`

### Opción 2 — Local (Recomendado para uso práctico)

```bash
git clone https://github.com/JorgeGonzalezVlc/phishing-detector
cd phishing-detector
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Configura `.env` y `credentials.json`, luego:

```bash
# Analizar bandeja de entrada automáticamente
python run.py

# Arrancar la API REST
uvicorn main:app --reload
```

---

## Roadmap

- [x] Motor de reglas y heurísticas
- [x] Extracción de IOCs
- [x] Análisis con LLM + MITRE ATT&CK
- [x] API REST con FastAPI
- [x] Persistencia en base de datos
- [x] Conexión Gmail API — emails reales
- [x] Acciones automáticas en Gmail
- [x] Integración con VirusTotal
- [x] Docker


## 📧 Ejemplo práctico

Análisis de 3 emails reales.



### Partimos de 3 mails sin leer
<img width="1128" height="460" alt="imagen" src="https://github.com/user-attachments/assets/aa3d78f0-8c50-484f-8513-63b610df6f7d" />


### Análisis en terminal
<img width="885" height="685" alt="imagen" src="https://github.com/user-attachments/assets/86870580-fc74-4258-8064-1f94917ef484" />



### Resultado en Gmail — correo abierto y analizado con la etiqueta correspondiente
<img width="1004" height="447" alt="imagen" src="https://github.com/user-attachments/assets/087df419-1249-43af-95fb-1e708d6609c4" />




## Autor

Jorge González — [LinkedIn](https://www.linkedin.com/in/jorge-gonz%C3%A1lez-gonz%C3%A1lez-5740614b/)


## Enlace a proyectyo completo

Detector-Phishing — [Github](https://github.com/JorgeGonzalezVlc/phishing-detector)

