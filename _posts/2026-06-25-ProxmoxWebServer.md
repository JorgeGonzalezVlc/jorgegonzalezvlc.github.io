---
layout: post
title: "Servidor web en casa: Nginx, Flask y Cloudflare Zero Trust"
date: 2026-06-25
categories: [Sistemas]
tags: [Proxmox, Homelab, Linux, Python, Docker]
image:
  path: /assets/img/proxmox_webserver.png
  alt: WebServer
  width: 500
  height: 280
  class: sz-contain
---

## La idea

Hace un tiempo desarrollé una web para una asociación cultural, algo sencillo: HTML, CSS, JavaScript y algo de PHP para el formulario de contacto. Con el tiempo surgió la necesidad de ampliarla con dos aplicaciones en Python: una para crear la academia y otra para la gestión interna.

Cual fue mi sorpresa al intentar desplegarlas, resulta que mi hosting compartido no soportaba Python y la solución que me ofrecía mi proveedor era pasarme a un VPS por 18€/mes.

Teniendo ya el mini PC con Proxmox, la respuesta era obvia. Lenvantarlo en mi propio PC.

## VM y no contenedor LXC

Proxmox permite desplegar tanto VMs como contenedores LXC. Mi primera pregunta fue exactamente esa: ¿para qué montar una VM entera si un contenedor es más ligero?

La respuesta es el aislamiento. Una VM tiene su propio kernel, su propia red, su propio todo. Si algo sale mal o alguien consigue comprometer el servidor web (esperemos que no suceda), se queda dentro de la VM, mientras que un contenedor LXC comparte el kernel del host, lo que reduce ese aislamiento. 
Para un servicio expuesto a internet no me parecía una buena idea ahorrar recursos a costa de seguridad.

## Creando la VM en Proxmox

Desde el panel de Proxmox (`https://192.168.1.253:8006`) click en **Create VM** y configuro:

- **OS**: Ubuntu Server 22.04 LTS (tenemos que tener la ISO subida previamente a `local → ISO Images`)
- **Disks**: 50GB en `local-zfs`, Discard activado, IO thread activado
- **CPU**: 1 core, tipo `host` (va un poco justo, pero siempre podre ampliar en un futuro)
- **Memory**: 2Gb
- **Network**: `vmbr0`, modelo VirtIO

Durante la instalación de Ubuntu es importante configurar la red de forma estática. 
Los servicios generalmente necesitan IP fija, si la IP cambia los clientes tendran compplicado encontrarla:

```
IP:      192.168.1.10/24
Gateway: 192.168.1.1
DNS:     8.8.8.8, 8.8.4.4
```

Yo activé SSH desde el propio instalador. 
Me resulta mas sencillo de esta manera. No tengo por qué volver a la consola de Proxmox, gestiono todo desde la terminal de cualquier equipo de mi red.

Una vez instalado:

```bash
ssh jorge@192.168.1.10
sudo apt update && sudo apt upgrade -y
```

## Instalando el stack

**Nginx** es un servidor web de alto rendimiento y código abierto que también actúa como proxy inverso, balanceador de carga y caché HTTP. Su arquitectura lo hace especialmente eficiente y tiene un bajo consumo de memoria.

```bash
sudo apt install nginx -y
sudo systemctl status nginx  # debe mostrar active
```

**PHP 8.1:** Famosisimo lenguaje de programacion de codigo abierto muy comun del lado del servidor

```bash
sudo apt install php8.1-fpm php8.1-cli php8.1-common php8.1-mysql \
  php8.1-zip php8.1-gd php8.1-mbstring php8.1-curl php8.1-xml php8.1-bcmath -y
```

En Linux PHP está modularizado, cada extensión es un paquete separado. Al principio parece que instalas demasiado pero tiene lógica: solo metes lo que necesitas. `php8.1-fpm` es el motor que habla con Nginx, `php8.1-mbstring` da soporte a tildes y ñ, `php8.1-curl` permite hacer peticiones HTTP desde PHP...

**Python:**

```bash
sudo apt install python3 python3-pip python3-venv -y
```

Ademas de esto deberemos instalar las diferentes dependecians que necesitamos para nuestro proyecto entre ellas Flask, el cual trae su propio servidor de desarrollo pero no está pensado para producción, él mismo te avisa cuando lo despliegas. PArta suplir esto usaremos Gunicorn, el servidor WSGI que gestiona los workers en condiciones reales:

```
Nginx recibe la petición → la pasa a Gunicorn → Gunicorn la pasa a Flask
```

## Estructura de carpetas

La estructura es sencilla, cada sitio web tiene su propia carpeta en `/var/www/`:

```bash
sudo mkdir -p /var/www/dominio.es
sudo mkdir -p /var/www/subdominio.dominio.es
sudo mkdir -p /var/www/subdominio2.dominio.es
sudo chown -R jorge:jorge /var/www/
```

El `-R` es recursivo, aplica el cambio de propietario a todas las subcarpetas. Muy importante!! Sin esto Nginx no puede leer los archivos y solo verías errores 403.

Subo los archivos ya preparados desde mi PC usando powershell con `scp`:

```powershell
# Desde PowerShell en Windows
scp -r "C:\Users\jorge\Desktop\web\css" jorge@192.168.1.10:/var/www/xxxx.es/
scp -r "C:\Users\jorge\Desktop\web\img" jorge@192.168.1.10:/var/www/xxxx.es/
scp -r "C:\Users\jorge\Desktop\web\js" jorge@192.168.1.10:/var/www/xxxx.es/
scp "C:\Users\jorge\Desktop\web\index.html" jorge@192.168.1.10:/var/www/xxxxx.es/
scp "C:\Users\jorge\Desktop\web\enviar.php" jorge@192.168.1.10:/var/www/xxxxx.es/
scp -r "C:\Users\jorge\Desktop\web\emusica_academia" jorge@192.168.1.10:/var/www/xxxxx.xxxxx.es/
scp -r "C:\Users\jorge\Desktop\web\emusica_gestion" jorge@192.168.1.10:/var/www/xxxxx.xxxxx.es/
```

¡Consejo! Si ves que algo en este punto no se muestra como toca revisa los permisos


## Configurando Nginx

Nginx tiene dos carpetas importantes:

- `/etc/nginx/sites-available/` → donde guardas todas las configuraciones
- `/etc/nginx/sites-enabled/` → las que están activas

En ellas encontraras el archivo default, recomiendo una lectura en el explica un poco como se organiza la arquitectura.

Yo en lugar de copiar archivos entre carpetas (y duplicarlos) utilicé enlaces simbólicos. Así si modifico el archivo en `sites-available` el cambio se refleja automáticamente en `sites-enabled`. Si quieres desactivar un sitio simplemente borras el enlace sin tocar la configuración.

**Web principal (`dominio.es`):**

```bash
sudo nano /etc/nginx/sites-available/dominio.es
```

```nginx
server {
    listen 80 default_server;
    server_name e-musica.es www.dominio.es;
    root /var/www/dominio.es;
    index index.html index.php;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }
}
```

El bloque `location ~ \.php$` le dice a Nginx que cuando alguien pida un archivo `.php` lo pase a PHP-FPM en lugar de servirlo como texto plano. `default_server` hace que sea el sitio por defecto cuando se accede directamente por IP.

**Apps Flask (`academia` y `gestión`):**

Aquí Nginx actúa como proxy inverso: recibe la petición y la redirige internamente a Gunicorn:

```nginx
server {
    listen 80;
    server_name academia.xxxxx.es;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activo los tres sitios y desactivo el default de Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/xxxx.es /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/academia.xxxxx.es /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/gestion.xxxxxx.es /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t  # verifica que no hay errores de sintaxis
sudo systemctl reload nginx
```

La configuración de Nginx me sorprendió lo limpia que es. Esperaba algo más complejo para gestionar tres dominios distintos, pero para nada.

## Configurando las apps Flask

Cada app necesita su propio entorno virtual para no mezclar dependencias entre proyectos:

```bash
cd /var/www/academia.xxxx.es/xxxxxx_academia
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
deactivate
```

Pruebo que arranca:

```bash
gunicorn --workers 1 --bind 127.0.0.1:5001 run:app
```

Si va bien, creo el servicio systemd. Un servicio systemd es un proceso que corre en segundo plano de forma continua, arranca con el sistema y si se cae se reinicia solo. Diferente a una tarea programada (cron) que se ejecuta en momentos concretos y termina:

```bash
sudo nano /etc/systemd/system/academia.service
```

```ini
[Unit]
Description=Gunicorn academia xxxxx
After=network.target

[Service]
User=jorge
WorkingDirectory=/var/www/academia.xxxxx.es/xxxxx_academia
Environment="PATH=/var/www/academia.xxxxx.es/xxxxx_academia/venv/bin"
ExecStart=/var/www/academia.xxxxxx.es/xxxxx_academia/venv/bin/gunicorn --workers 1 --bind 127.0.0.1:5001 run:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable academia
sudo systemctl start academia
sudo systemctl status academia  # debe mostrar active
```

Repito el proceso para gestión cambiando las rutas y el puerto a `5000`.

## Probando en local antes de publicar

Antes de tocar nada en Cloudflare verifico que todo funciona localmente. Para que mi PC resuelva los dominios a la IP del servidor sin pasar por DNS, edito el archivo hosts de Windows.

Abro el Bloc de notas **como administrador** y abro `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.1.10    xxxxx.es
192.168.1.10    academia.xxxxx.es
192.168.1.10    gestion.xxxxxx.es
```

Los tres sitios cargan perfectamente.

**Importante y que me costó un buen rato**: cuando termines las pruebas hay que borrar estas líneas del hosts antes de configurar Cloudflare. Si no las borras el navegador sigue yendo directo a la IP local ignorando completamente Cloudflare y parece que el túnal no funciona. Me pasé un buen rato mirando logs hasta darme cuenta.

## Cloudflare Zero Trust: publicando sin abrir puertos

Esperaba que esta parte fuera la más compleja. No lo fue.

En lugar de abrir puertos en el router y exponer la IP pública, uso un túnel de [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). El servidor establece una conexión saliente hacia Cloudflare, nunca al revés. Nadie desde internet sabe dónde está el servidor físicamente.

```
Usuario → HTTPS → Cloudflare → túnel cifrado → cloudflared → Nginx
```

Ventajas:
- IP doméstica nunca expuesta
- Sin abrir ningún puerto en el router
- HTTPS automático sin certificados ni Certbot
- Protección DDoS incluida
- Funciona aunque el operador use CGNAT

**Instalación:**

1. Entro en [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Zero Trust**
2. **Networking → Tunnels → Create a tunnel**
3. Selecciono **Cloudflared**, nombre `webserver`, sistema **Debian 64-bit**
4. Cloudflare genera directamente los comandos de instalación con el token incluido

```bash
# El panel genera estos comandos automáticamente
# Comando 1: instala cloudflared
# Comando 2: lo instala como servicio con tu token
sudo cloudflared service install TU_TOKEN_AQUI
```

```bash
sudo systemctl status cloudflared  # debe mostrar active
```

En el panel aparece **Healthy**. Desde aquí configuro las rutas en **Routes → Add route → Published application**:

| Dominio | Service URL |
|---------|-------------|
| `xxxx.es` | `http://localhost:80` |
| `academia.xxxxx.es` | `http://localhost:5001` |
| `gestion.xxxxx.es` | `http://localhost:5000` |

Cloudflare crea automáticamente los registros DNS para cada subdominio.

Por último en **Cloudflare → e-musica.es → SSL/TLS → Configure** selecciono modo **Flexible**: el usuario habla con Cloudflare por HTTPS, Cloudflare habla con mi servidor por HTTP. El túnel ya cifra ese tramo internamente.


## Reflexión final

Si tuviera que quedarme con algo de este proceso sería lo rápido que fue montar el túnel de Cloudflare. Llevo tiempo viendo gente hablar de ello y lo tenía en la cabeza como algo complejo. Para nada. Diez minutos desde que entras al panel hasta que el túnel está activo.

Lo mismo con Nginx. Gestionar tres dominios distintos con configuraciones completamente diferentes son tres archivos de texto de menos de quince líneas cada uno.

Si estás pagando un VPS solo para tener Python en producción y tienes un cacharro por casa con algo de RAM, dale una oportunidad a esto. Ojalá lo hubiera hecho antes.

A por ciero para muestra un botón [Mi Web](https://www.e-musica.es/) por si lo quieres echar un ojo

## Lo que viene

De momento sirve la apgina un poco lento, tengo que investigar el motivo y arreglarlo pero estoy contento con el primer resultado.

Voy pensando otros proyectos OPNsense para segmentar la red con VLANs, Wazuh para monitorización y Nextcloud para una nube privada.

Seguiremos informando.



