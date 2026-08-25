# Hope Hands · Integración con Supabase

## 1. Qué se hizo

```
hope_hands/
├── js/
│   ├── supabase-client.js   ← AQUÍ VAN TU URL Y TU ANON KEY (único lugar)
│   ├── auth.js                ← login / registro / logout / protección de rutas
│   ├── profiles.js            ← perfil donador + perfil fundación + equipo/voluntarios/ubicaciones + premium
│   ├── campaigns.js           ← crear/editar/listar/borrar campañas
│   ├── resources.js           ← productos/recursos que necesita cada fundación
│   └── donations.js           ← donaciones, solicitudes de apoyo, campañas guardadas
├── sql/
│   └── schema.sql              ← TODO el esquema de base de datos, con RLS y comentarios
└── (todas las páginas .html, mismo diseño de siempre)
```

### Conectadas 100% a Supabase (ya no usan datos falsos de localStorage):
- **Autenticación:** `login-donador.html`, `login-fundacion.html`, `signup-donador.html`, `signup-fundacion.html`
- **Perfiles:** `donador/profile.html`, `fundacion/profile.html` (info básica, contacto, equipo, voluntarios, ubicaciones)
- **Campañas:** `fundacion/add-campaign.html`, `fundacion/campaigns.html`, `donador/campaigns.html` (incluye favoritos y "Offer support"), `campaigns.html` (pública, con estado vacío real)
- **Fundaciones:** `foundations.html` (pública, con estado vacío real y conteos reales de campañas/donadores), `donador/foundation-profile.html` (perfil de una fundación específica, con sus campañas y productos reales), `donador/foundations.html` (mapa con ubicación real geocodificada automáticamente)
- **Recursos/productos:** `fundacion/add-resource.html`, `fundacion/products.html`
- **Dashboards:** `donador/dashboard.html` (fundaciones recomendadas y top donadores con datos reales), `donador/impact.html`, `fundacion/dashboard.html`, `fundacion/dashboard-premium.html` (estadísticas, campañas, productos, equipo e insights de IA generados a partir de datos reales)
- **Reportes y donantes:** `fundacion/reports.html`, `fundacion/donors.html`
- **Plan premium ($4.99/mes):** `fundacion/agent-of-change.html`, `fundacion/premium-checkout.html` (demo de cobro — ver nota de seguridad más abajo)
- **Página de inicio:** `home.html` — las estadísticas del hero (fundaciones, campañas, productos, donadores) ahora son conteos reales en vez de números inventados.

### Todavía usan contenido de demostración (a propósito, ver por qué):
- Ya no queda ninguno pendiente de la lista original. Si encuentras más casos de datos "quemados" en el HTML, avísame para revisarlos.

## 2. Chat entre donador y fundación (nuevo)

Ahora hay un chat de verdad, de ida y vuelta:
- El donador manda el primer mensaje desde "Offer support" en una campaña.
- La fundación lo ve y responde en **`fundacion/messages.html`**.
- El donador ve la respuesta en **`donador/messages.html`**.
- Ambos lados tienen un contador rojo (badge) en el menú lateral que muestra cuántos mensajes sin leer tienen — se actualiza cada vez que entras al Dashboard, Campaigns (donador), Donors o Messages (fundación).

**Importante:** agregué una tabla nueva a la base de datos (`messages`). Tienes que correrla en Supabase:
1. Ve a **SQL Editor** → clic en **"+"** para una consulta nueva.
2. Abre el archivo **`sql/messages_addon.sql`** (está en la misma carpeta que `schema.sql`), copia todo su contenido y pégalo ahí.
3. Dale **"Run"**. No afecta ni borra nada de lo que ya tenías.

**Limitación honesta:** el contador de mensajes sin leer y el enlace a "Messages" en el menú solo están conectados en las páginas principales (los 2 Dashboards, `donador/campaigns.html` y `fundacion/donors.html`). El resto de páginas todavía no muestran ese contador — pero puedes entrar a Messages desde cualquiera de esas 4 pantallas. Tampoco se manda ningún correo/notificación push cuando llega un mensaje; solo se ve dentro de la web app.

## 3. Cómo funciona ahora el mapa de fundaciones

`donador/foundations.html` (el mapa con Leaflet) ahora usa datos reales. Para que una fundación aparezca con su pin en el mapa:
1. La fundación debe llenar el campo **"Address (used for the map)"** en `fundacion/profile.html` (pestaña Basic Info) — o haberlo puesto ya al registrarse en `signup-fundacion.html`.
2. Al guardar, el sistema convierte esa dirección en coordenadas automáticamente usando el servicio gratuito de OpenStreetMap (Nominatim) — no necesitas ninguna API key para esto.
3. Si la dirección es muy vaga (ej. solo "Panamá"), es posible que no se pueda ubicar con precisión; entre más específica (calle + ciudad), mejor.
4. Las fundaciones sin ubicación guardada siguen apareciendo en la lista, solo no tienen pin en el mapa.

## 4. Cómo conectar tu proyecto de Supabase (paso a paso)

**Paso 1 — Crea el proyecto en Supabase** (si no lo tienes):
https://supabase.com/dashboard → "New project"

**Paso 2 — Corre el esquema SQL:**
1. Dentro de tu proyecto, ve a **SQL Editor** → **New query**.
2. Pega todo el contenido de `sql/schema.sql` y presiona **Run**.
3. Esto crea todas las tablas, políticas de seguridad (RLS) y el trigger que crea el perfil automáticamente al registrarse.
   - Si ya lo habías corrido antes de esta entrega, vuelve a correrlo completo: se agregaron columnas nuevas (`received` en `foundation_resources`, `status` en `foundation_volunteers`, `card_last4` en `premium_subscriptions`) y la tabla nueva `foundation_locations`. El script usa `IF NOT EXISTS` así que no rompe nada existente.

**Paso 3 — Copia tus credenciales:**
1. Ve a **Project Settings** (ícono de engranaje) → **API**.
2. Copia **Project URL** y **anon public key**.

**Paso 4 — Pégalas en el proyecto:**
Abre `js/supabase-client.js` y reemplaza:
```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-ANON-PUBLIC-KEY-AQUI";
```
con tus valores reales. Ese es el ÚNICO archivo que necesitas tocar para conectar el proyecto.

**Paso 5 — Prueba el flujo completo:**
1. Abre `signup-fundacion.html` (con Live Server o similar — no `file://`) y crea una cuenta de fundación de prueba.
2. Entra a `fundacion/profile.html` y completa el perfil, agrega un miembro de equipo y un voluntario.
3. Crea una campaña desde `fundacion/add-campaign.html`.
4. Abre `signup-donador.html` en una ventana aparte (o modo incógnito) y crea una cuenta de donador.
5. Entra a `donador/campaigns.html`: deberías ver la campaña real que creaste, poder guardarla como favorita y enviar una solicitud de apoyo.
6. Verifica en Supabase → **Table Editor** que las filas aparecen en `profiles`, `foundations`, `campaigns`, `saved_campaigns`, `support_requests`.

> Sobre "los puertos": Supabase no usa un puerto que tú configures — es un servicio en la nube al que te conectas por HTTPS con la URL del Paso 3. El único "puerto" que existe es el de tu servidor local mientras desarrollas (ej. `http://localhost:5500` con Live Server); Supabase funciona igual sin importar qué puerto uses localmente.

## 5. Nota de privacidad sobre el ranking de donadores

Para que "Top Donors This Month" (en `donador/dashboard.html`) y las estadísticas de `foundations.html` funcionen sin que cada visitante tenga que iniciar sesión, tuve que agregar 2 políticas de seguridad (RLS) que hacen **público**:
- El **nombre** de cualquier donador registrado (tabla `donor_profiles`).
- La **cantidad donada** en cada donación, aunque no el detalle del producto (tabla `donations`).

Están marcadas con comentarios en `sql/schema.sql` (busca "Política adicional"). Si prefieres que esto sea 100% privado, puedes borrar esas dos políticas — el ranking de top donadores simplemente dejará de mostrar datos.

## 6. Nota de seguridad sobre el pago premium

`fundacion/premium-checkout.html` sigue siendo una **demostración**: valida el formato de la tarjeta en el navegador pero no cobra nada real. Solo guarda los últimos 4 dígitos (dato no sensible) para mostrarlos después. Para cobros reales, esa pantalla debe conectarse a un procesador de pagos de verdad (Stripe, PayPal, etc.) — el número completo de tarjeta y el CVC **nunca** deben pasar por tu base de datos de Supabase.

## 7. Lo que queda pendiente (cuando quieras seguir)

- Subir fotos de perfil/logo a **Supabase Storage** en vez de guardarlas como base64 en la base de datos (funciona igual, pero Storage es más eficiente para imágenes).
- Conectar `fundacion/premium-checkout.html` a un procesador de pagos real.
- La geocodificación usa Nominatim (gratis, sin API key) — funciona bien para volumen bajo/moderado. Si el proyecto crece mucho, conviene migrar a un servicio de pago con mejor límite de uso (Google Maps Geocoding, Mapbox, etc.).

