# 📊 Finanzas Grupo — Plataforma Financiera

Plataforma de control financiero para grupos de empresas.
Construida con Next.js 14, Supabase y Vercel.

---

## 🚀 Despliegue en Vercel — Guía paso a paso

### Paso 1 — Crear cuenta en Supabase (base de datos)

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratis
2. Clic en **New Project**
3. Dale un nombre: `finanzas-grupo`
4. Elige una contraseña segura para la base de datos
5. Región: **South America (São Paulo)** — más cercana a Chile
6. Espera ~2 minutos a que se cree el proyecto

**Copia estos valores** (los necesitas después):
- Ve a Settings → API
- Copia **Project URL** → `https://xxxx.supabase.co`
- Copia **anon public key** → `eyJxxxx...`

### Paso 2 — Crear las tablas en Supabase

1. En tu proyecto Supabase, ve a **SQL Editor**
2. Clic en **New Query**
3. Copia y pega todo el contenido del archivo `supabase-schema.sql`
4. Clic en **Run** (▶)
5. Verás "Success" — tus tablas están listas

### Paso 3 — Subir el código a GitHub

```bash
# En tu computador, desde la carpeta del proyecto:
git init
git add .
git commit -m "Plataforma financiera lista"

# Crea un repo en github.com y luego:
git remote add origin https://github.com/tu-usuario/finanzas-grupo.git
git push -u origin main
```

### Paso 4 — Desplegar en Vercel

1. Ve a [vercel.com](https://vercel.com) y crea cuenta con GitHub
2. Clic en **Add New Project**
3. Importa tu repositorio `finanzas-grupo`
4. En **Environment Variables**, agrega:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Tu Project URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tu anon key de Supabase |
| `ANTHROPIC_API_KEY` | Tu key de console.anthropic.com |

5. Clic en **Deploy**
6. En ~2 minutos tienes tu URL: `finanzas-grupo.vercel.app`

### Paso 5 — Crear tu usuario administrador

1. En Supabase → **Authentication** → **Users**
2. Clic en **Invite User**
3. Ingresa tu email
4. Recibirás un email para crear tu contraseña
5. Entra a tu app y listo

### Paso 6 — Dominio propio (opcional)

Si tienes `tuempresa.cl` y quieres `finanzas.tuempresa.cl`:

1. En Vercel → tu proyecto → **Settings** → **Domains**
2. Agrega: `finanzas.tuempresa.cl`
3. En tu registrador de dominio (NIC Chile, etc.), agrega:
   - Tipo: `CNAME`
   - Nombre: `finanzas`
   - Valor: `cname.vercel-dns.com`
4. En ~1 hora el dominio está activo con HTTPS automático

---

## 💻 Desarrollo local

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus valores de Supabase

# Iniciar servidor local
npm run dev
# Abre http://localhost:3000
```

---

## 📁 Estructura del proyecto

```
finanzas-grupo/
├── app/
│   ├── page.tsx              # Dashboard principal
│   ├── login/page.tsx        # Login
│   ├── movimientos/          # Módulo movimientos
│   ├── presupuesto/          # Módulo presupuesto
│   ├── reportes/             # Reportes PDF
│   ├── bancos/               # Cuentas bancarias
│   ├── tributario/           # Documentos tributarios
│   ├── proyecciones/         # Flujo de caja proyectado
│   ├── usuarios/             # Gestión de usuarios
│   ├── kpis/                 # KPIs ejecutivos
│   └── ia/                   # Análisis con IA
├── components/
│   ├── Sidebar.tsx           # Navegación lateral
│   ├── Header.tsx            # Header con selector empresa
│   └── MetricCard.tsx        # Tarjeta de métrica
├── lib/
│   └── supabase.ts           # Cliente Supabase + tipos
├── supabase-schema.sql       # Schema completo de la base de datos
└── .env.example              # Variables de entorno de ejemplo
```

---

## 💰 Costos estimados

| Servicio | Plan gratuito | Plan de pago |
|----------|---------------|--------------|
| Vercel   | Hobby (gratis, 1 usuario) | Pro $20/mes (equipo) |
| Supabase | Free (500MB, 2 proyectos) | Pro $25/mes (8GB) |
| Dominio  | —             | ~$8.000/año |
| **Total** | **Gratis** | **~$48.000/mes** |

---

## 🔌 Integración con sistema de ventas

Una vez desplegada la app, conecta tu sistema de ventas:

1. Ve a la sección **Integraciones** en la app
2. Selecciona tu sistema (Bsale, Defontana, Nubox, etc.)
3. Ingresa tu API Key
4. Configura la frecuencia de sincronización
5. Las facturas entrarán automáticamente al módulo tributario

---

## 🆘 Soporte

Si tienes problemas con el despliegue, pregunta directamente a Claude
con el mensaje: "Tengo un error al desplegar en Vercel: [pega el error aquí]"
