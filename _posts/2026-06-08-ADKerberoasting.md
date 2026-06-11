---
layout: post
title: "Active Directory: Kerberoasting"
date: 2026-06-08
categories: [Offensive, Defensive]
tags: [AD, Kerberos, Kerberoasting]
image:
  path: /assets/img/kerberoasting.png
  alt: Phishing Detector
  width: 500
  height: 280
  class: sz-contain
---

# Kerberoasting

## ¿Qué es?

Se trata de una técnica de ataque bastante común en Active Directory (AD) que consiste en robar credenciales y escalar privilegios dentro de una red. Se trata de obtener hashes de un TGS y desencriptarlas.

En AD se utiliza un identificador único de servicio (SPN) para cada servicio, bien sea SQL Server, IIS... Kerberos es el encargado de generar los tickets necesarios para que un usuario pueda interactuar en el entorno: el primero, el TGT para entrar, y el TGS para solicitar acceso al servicio en cuestión.

Estos tickets siempre van encriptados mediante AES, RC4 e incluso en ocasiones DES. En función de cuál se utilice será más o menos difícil desencriptarlo.

---

## Walkthrough

Para esto usaremos la herramienta [Rubeus](https://github.com/GhostPack/Rubeus).

Vamos a utilizar la herramienta con la acción kerberoast sin especificar el usuario, de este modo Kerberos pedirá un TGS para cada SPN registrado:

```
.\Rubeus.exe kerberoast /outfile:spn.txt
```

Una vez obtenidos los hashes y pasados como indicamos en el comando al archivo `spn.txt`, nos vamos a nuestra máquina Kali para usar [Hashcat](https://hashcat.net/hashcat/) con el comando:

```
hashcat -m 13100 -a 0 spn.txt passwords.txt --outfile="cracked.txt"
```

En caso de tener un error por parte de Hashcat deberemos forzar la acción mediante la incorporación al final de:

```
--force
```

Otra manera de conseguir desencriptar el hash sería con [John the Ripper](https://www.openwall.com/john/) mediante el comando:

```
sudo john spn.txt --fork=4 --format=krb5tgs --wordlist=passwords.txt --pot=results.pot
```

<img width="842" height="617" alt="imagen" src="https://github.com/user-attachments/assets/2766ad86-2f7f-4b48-95a9-72436588822e" />


---

## Prevención

Dado que principalmente se trata de un proceso que trata de crackear hashes, la primera prevención y posiblemente la más efectiva sea utilizar un sistema de encriptación potente como AES y además utilizar unas credenciales robustas junto con una rotación periódica de las mismas, partiendo siempre de minimizar al máximo las cuentas con SPN registrado.

Otra opción sería usar Group Managed Service Accounts (GMSA), las cuales son cuentas vinculadas a un servicio específico y son condicionales en función del host, además de que tienen una rotación de contraseñas automática. El único problema es que actualmente no están integradas con todos los servicios de AD.

---

## Detección

Cuando se solicita un TGS, el cual es emitido por Kerberos para ver si se puede acceder a un SPN, se genera un evento ==4769==. La dificultad es que también se genera cuando un usuario intenta entrar a un servicio de forma legítima, de forma que lo siguiente en lo que nos podemos fijar es en el tipo de encriptación. Si estamos en un entorno que usa AES y de pronto vemos un evento usando RC4, esto debería advertirnos.

Otro modo de detección sería ver si un usuario genera más de cierto número de TGS en un breve periodo de tiempo, puesto que no sería normal un usuario solicitando por ejemplo 10 tickets en menos de 20 segundos.

---

## Honeypot

Para generar un cebo podemos crear un usuario con registro SPN que nunca acceda a ningún servicio, por tanto no tiene generados TGS vinculados a él. En el momento en que uno de estos se genera es porque lo están haciendo terceras partes intentando entrar.

Idealmente el usuario ha de ser creíble y atractivo para un atacante.
