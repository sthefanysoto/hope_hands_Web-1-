// ============================================================================
// HOPE HANDS · CLIENTE DE SUPABASE
// ============================================================================
// Este es el ÚNICO archivo donde va tu URL y tu llave (API key) de Supabase.
// Todas las demás páginas/scripts usan "window.supabase" que este archivo
// crea, así que si tu proyecto de Supabase cambia, solo editas ESTE archivo.
//
// DÓNDE CONSEGUIR ESTOS DATOS:
// 1. Entra a https://supabase.com/dashboard y abre tu proyecto.
// 2. Ve a "Project Settings" (ícono de engranaje) -> "API".
// 3. Copia "Project URL"  -> pégalo en SUPABASE_URL
// 4. Copia "anon public"  -> pégalo en SUPABASE_ANON_KEY
//    (NUNCA uses la "service_role" key aquí, esa es solo para el backend/servidor)
//
// Este script debe cargarse en TODAS las páginas ANTES que cualquier otro
// script que use Supabase (auth.js, campaigns.js, etc). Por eso siempre
// va primero en el <head> o al inicio del <body>:
//
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="/js/supabase-client.js"></script>
//   <script src="/js/auth.js"></script>
// ============================================================================

// --- 1. TUS CREDENCIALES DE SUPABASE (reemplaza estos dos valores) --------
const SUPABASE_URL = "https://ktzzupffpbavsgixcttm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Ou47F91N6I5cgo-W9AaRGw_UGlXyrew";       // <-- pega aquí tu anon public key

// --- 2. Creamos el cliente y lo dejamos disponible como window.supabase ---
// (la librería @supabase/supabase-js expone "supabase.createClient")
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3. Pequeña ayuda para detectar si ya se configuraron las credenciales -
// Si alguien olvida reemplazar los valores de arriba, avisamos en consola
// en vez de fallar en silencio.
if (SUPABASE_URL.includes("TU-PROYECTO") || SUPABASE_ANON_KEY.includes("TU-ANON-PUBLIC-KEY")) {
    console.warn(
        "[Hope Hands] Falta configurar Supabase: edita js/supabase-client.js " +
        "con tu Project URL y tu anon public key."
    );
}
