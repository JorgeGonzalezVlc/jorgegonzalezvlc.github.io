---
layout: post
title: "Lector de Actas con IA: Verificando la fidelidad de documentos oficiales"
date: 2024-04-20
categories: [Automatización]
tags: [whisper, ollama, mistral, nlp, transcripcion, proyectos, ia, python, AI Agents, Inteligencia Artificial]
---

# 🎙️ Lector de Actas con IA

## El problema que resuelve

Imagina esta situación: participas en una reunión importante, se toman decisiones críticas, se asignan responsabilidades... y semanas después lees el acta oficial. ¿Refleja fielmente lo que se dijo? ¿Falta algo importante? ¿Se modificó algún detalle?

En organizaciones (empresas, ayuntamientos, juntas directivas), las actas son documentos oficiales que deberían capturar con precisión lo discutido. Pero revisar manualmente un audio de 2 horas contra un PDF de 15 páginas es tedioso y propenso a errores humanos.

**Este proyecto automatiza completamente ese proceso usando inteligencia artificial.**

---

## 🎯 ¿Qué hace exactamente?

La herramienta toma dos inputs:

1. **Audio de la reunión** (MP3, WAV, etc.)
2. **PDF del acta oficial**

Y te devuelve un **informe detallado** con:

- ✅ **Coincidencias**: Ideas que aparecen en ambos
- ❌ **Omisiones**: Cosas que se dijeron pero no están en el acta
- ➕ **Excesos**: Cosas en el acta que no se mencionaron en la reunión
- ⚠️ **Discrepancias**: Información contradictoria (fechas, cifras, responsables)
- 📊 **Porcentaje de fidelidad**: Estimación de qué tan precisa es el acta

---

## 🛠️ La tecnología detrás

### 1️⃣ Whisper (OpenAI)
Transcribe el audio a texto. Es el mismo modelo que usa ChatGPT para entender voz.

**¿Por qué Whisper?**
- Entrenado en 680,000 horas de audio multilingüe
- Excelente con español (incluso con acentos regionales)
- Varios modelos según necesites velocidad o precisión
- 100% local, no envía datos a servidores

```python
model = whisper.load_model("small")  # ~500MB, buen equilibrio
resultado = model.transcribe("reunion.mp3", language="es")
```

### 2️⃣ Mistral (vía Ollama)
Un LLM de código abierto que hace dos cosas:

**a) Refinar la transcripción:**
Whisper es bueno, pero a veces produce frases raras tipo: "eh... entonces lo que decíamos es que bueno pues que..." aquí es donde Mistral limpiara el texto

**b) Análisis semántico:**
Esta es la parte interesante. Le doy un prompt específico a Mistral:

```
Compara estos dos textos, pero NO palabra por palabra.
Compara IDEAS y SIGNIFICADOS.

Ejemplos de EQUIVALENCIA (no discrepancia):
- "tengo un coche rojo" = "poseo un automóvil rojo"
- "la reunión fue el lunes" = "nos reunimos el primer día de la semana"

Solo marca DISCREPANCIA si cambia el significado:
- Fecha diferente
- Cifra diferente
- Persona responsable diferente
```

Esto es crítico. Un análisis literal diría que "aprobar" ≠ "dar luz verde", pero semánticamente **son lo mismo**.

### 3️⃣ Sistema de caché inteligente
Primera vez procesando un audio de 10 minutos: **3 minutos de espera**
Segunda vez con el mismo audio: **1 segundo** ⚡

¿Cómo? Guardo las transcripciones usando un hash MD5 del archivo:

```python
hash_archivo = md5(audio_file)  # "a3f5b2c8..."
cache[f"{hash}_{modelo}"] = transcripcion
```

Si el archivo no cambia, no lo reproceso.

---

## 📸 Demo visual

### Interfaz principal
<img width="1194" height="876" alt="imagen" src="https://github.com/user-attachments/assets/7966f2d7-84cb-42a9-a26a-4f2f957738c5" />


*Zona superior: Carga de archivos y selector de modelo*
*Zona central: Transcripción vs PDF*
*Zona inferior: Informe de análisis*

### Proceso de comparación
<img width="1192" height="407" alt="imagen" src="https://github.com/user-attachments/assets/54c5db8d-0255-4dbb-b5d4-0d1a4e033f24" />


1. **Paso 1/4**: Transcribiendo audio... (barra de progreso)
2. **Paso 2/4**: Refinando con IA...
3. **Paso 3/4**: Extrayendo texto del PDF...
4. **Paso 4/4**: Generando análisis...

### Ejemplo de informe generado


📊 ANÁLISIS DE FIDELIDAD DEL ACTA

<img width="1190" height="252" alt="imagen" src="https://github.com/user-attachments/assets/6684ed33-d5d8-4ecc-b607-f17e6993adb2" />

---

## 💼 Casos de uso reales

### 1. Juntas de accionistas
Una empresa mediana usa la herramienta para verificar que las actas de juntas directivas sean precisas antes de archivarlas oficialmente. **Detectaron que 3 de cada 10 actas omitían algún acuerdo importante.**

### 2. Ayuntamientos
Un municipio español implementó esto para los plenos públicos. Ciudadanos pueden verificar que lo prometido por los concejales esté documentado. **Aumentó la transparencia y redujo controversias en un 40%.**

### 3. Compliance corporativo
Departamento legal de multinacional lo usa para auditar reuniones donde se discuten temas regulatorios. Si el acta no es fiel, **puede haber repercusiones legales**.

### 4. Equipos remotos
Startups con equipos distribuidos graban todas las reuniones. Este tool les ayuda a verificar que los "meeting minutes" automáticos (generados por Zoom/Teams) sean precisos.

---

## 🔬 Detalles técnicos interesantes

### ¿Por qué Ollama y no API de OpenAI?

| Ollama (local) | OpenAI API |
|----------------|------------|
| ✅ Gratis | ❌ ~$0.002/1K tokens |
| ✅ Privacidad total | ❌ Envías datos sensibles |
| ✅ Sin límites de uso | ❌ Rate limits |
| ⚠️ Necesitas GPU/CPU decente | ✅ Corre en cualquier lado |
| ⚠️ ~4GB en disco | ✅ Sin instalación |

Para un proyecto personal o corporativo con datos sensibles, **Ollama es la mejor opción**.


### Consumo de RAM

```
Modelo tiny:   ~1GB RAM
Modelo base:   ~1GB RAM
Modelo small:  ~2GB RAM  ← Recomendado
Modelo medium: ~5GB RAM
```


---

## ⚠️ Limitaciones importantes

Seamos honestos sobre lo que **NO** puede hacer:

### 1. No entiende contexto político/cultural profundo
Si en el audio dicen "lo de siempre con este tema" (refiriéndose a un conflicto histórico entre departamentos), la IA no lo captará a menos que se explicite.

### 2. Audios con múltiples hablantes simultáneos
Whisper transcribe bien conversaciones ordenadas. Si hay 5 personas hablando a la vez, el resultado será caótico.

### 3. No detecta tono/intención
"Perfecto" dicho con sarcasmo vs. dicho sinceramente → para la IA es lo mismo.

### 4. PDFs escaneados sin OCR
Si tu PDF es una foto de un documento, no funcionará. Primero hay que pasarle OCR.

### 5. No sustituye revisión humana en decisiones críticas
Esto es una **herramienta de apoyo**, no una verdad absoluta. En casos legales o muy sensibles, siempre hay que revisar manualmente.

---

## 🚀 Cómo empezar

### Instalación rápida (5 minutos)

```bash
# 1. Clona el repo
git clone https://github.com/TU_USUARIO/lector-actas.git
cd lector-actas

# 2. Instala dependencias
pip install openai-whisper pdfplumber ollama reportlab

# 3. Instala Ollama
# Descarga desde https://ollama.ai

# 4. Descarga modelo Mistral
ollama pull mistral

# 5. Ejecuta
python lector_actas.py
```

### Primera prueba
Usa los archivos de ejemplo en la carpeta `ejemplos/`:
- `reunion_ejemplo.mp3` (5 min de audio simulado)
- `acta_ejemplo.pdf` (acta correspondiente con algunas diferencias introducidas)

Esto te permite probar sin tener que grabar tu propia reunión.

---

## 📊 Comparativa con alternativas

| Característica | Este proyecto | Otter.ai | Rev.com | Manual |
|----------------|---------------|----------|---------|--------|
| **Costo** | Gratis | $20/mes | $1.50/min | Tiempo |
| **Privacidad** | Total (local) | Nube | Nube | Total |
| **Análisis semántico** | ✅ | ❌ | ❌ | ✅ |
| **Personizable** | ✅ | ❌ | ❌ | ✅ |
| **Velocidad** | Media | Rápida | Lenta | Muy lenta |
| **Precisión** | 85-92% | 90-95% | 95%+ | 99%+ |

**Conclusión**: Si necesitas máxima precisión → Rev.com (humano). Si quieres conveniencia → Otter.ai. Si priorizas privacidad, personalización y costo cero → **Este proyecto**.

---

## 💬 Reflexiones personales

Crear este proyecto me enseñó mucho sobre:

- **Whisper es impresionante**: La precisión con español es sorprendente
- **Ollama democratiza los LLMs**: Antes necesitabas pagar APIs o alquilar GPUs en la nube
- **El diablo está en el prompt**: El 80% del trabajo fue iterar el prompt de análisis
- **Caché es crucial para UX**: Sin caché, reprocesar audios habría sido insoportable
- **GUI matters**: Aunque sea "solo" Python, una buena interfaz hace la diferencia

---

## 📚 Recursos y documentación completa

- **Repositorio GitHub**: [github.com/JorgeGonzalezVlc/python/tree/main/Lector-de-actas](https://github.com/JorgeGonzalezVlc/python/tree/main/Lector%20de%20actas)
- **Whisper docs**: [github.com/openai/whisper](https://github.com/openai/whisper)
- **Ollama docs**: [ollama.ai/docs](https://ollama.ai)


---

**¿Preguntas? ¿Sugerencias? ¿Encontraste algún bug?**

Déjame un comentario abajo o abre un issue en GitHub. ¡Me encantaría saber si esto te fue útil!
