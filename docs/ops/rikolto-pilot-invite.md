# Rikolto × Etholys — piloto + emails (validação)

## Preparação técnica (feita / a fazer no deploy)

- Empresa **Rikolto** (`shortName: RIKOLTO`)
- Trial **90 dias** · plano base `plan.institucional` + sistemas piloto: **ATLAS, SIEP, FUNDHUB, FORGE, NEXUS**
- Billing enforced (convites só podem atribuir sistemas licenciados)
- Emails de convite com layout institucional Etholys (slate + teal)

URL: https://app.etholys.com

---

## A) Email individual de convite (sistema → pessoa)

**Assunto:** `Invitación Etholys — Rikolto`

**Texto (ES):**

> **RIKOLTO**  
> **Bienvenida a Etholys**
>
> Equipo Etholys te invitó como miembro a usar ATLAS, SIEP, FUNDHUB, FORGE, NEXUS en Rikolto.
>
> Cargo: Coordinación de proyectos
>
> Este acceso forma parte del piloto institucional Rikolto × Etholys. El equipo Etholys acompaña la puesta en marcha.
>
> Tu acceso está limitado a los sistemas asignados. Usa el botón o introduce el código en el inicio de sesión.
>
> **CÓDIGO DE ACCESO**  
> `RIK7A2C9` *(exemplo — o real sai no envio)*
>
> **[Activar acceso]** → https://app.etholys.com/login?invite=…
>
> Esta invitación expira en 14 días.

Prévia HTML: `apps/web/tmp/mail-previews/rikolto-invite.html`

---

## B) Email / mensagem ao grupo (piloto)

**Assunto:** `Rikolto × Etholys — acceso al piloto`

**Texto (ES):**

> **RIKOLTO**  
> **Su espacio de piloto está listo**
>
> Hola equipo,
>
> Rikolto ha sido invitada a probar Etholys — el ecosistema digital para gestión de proyectos, captación de fondos y formación integrada.
>
> Durante este piloto tendrán acceso a los módulos acordados, con apoyo del equipo Etholys. Todo en un solo inicio de sesión.
>
> - SIEP — gestión de proyectos  
> - FUNDHUB — captación de fondos  
> - FORGE — formación y aprendizaje  
> - ATLAS — operaciones y finanzas  
> - NEXUS — asistencia a MIPYMEs  
>
> **[Entrar a Etholys]** → https://app.etholys.com/login
>
> Si aún no recibió su código individual, pídalo al administrador de la organización o al equipo Etholys.

Prévia HTML: `apps/web/tmp/mail-previews/rikolto-pilot-group.html`

---

## C) Mensagem curta para WhatsApp / grupo (copiar-colar)

```
Hola equipo Rikolto 👋

Les compartimos el acceso al piloto Etholys — plataforma integrada para proyectos (SIEP), captación (FUNDHUB), formación (FORGE) y operaciones (ATLAS / NEXUS).

1) Entrar: https://app.etholys.com
2) Cada persona recibe un correo de invitación con su código
3) En el login: “Registrarse” / activar con el código (o el botón del email)

Si no llega el correo, revisen spam o avísenos para reenviar.

Equipo Etholys — acompañamos el piloto.
```

---

## Como convidar pessoas (depois do seed)

1. Login admin Etholys / admin Rikolto  
2. `/hub/admin` → Invitaciones **ou** Centro integrado → Equipa  
3. Wizard: email + cargo + sistemas (só os licenciados) → enviar  

O email sai automaticamente no layout novo.
