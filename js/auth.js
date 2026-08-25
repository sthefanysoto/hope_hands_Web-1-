// ============================================================================
// HOPE HANDS · AUTENTICACIÓN (login / registro / sesión)
// ============================================================================
// Este archivo conecta los formularios de login-donador.html,
// login-fundacion.html, signup-donador.html y signup-fundacion.html con
// Supabase Auth. Requiere que js/supabase-client.js ya se haya cargado
// antes (para que exista window.supabase).
//
// CÓMO FUNCIONA EL "ROL" (donador vs fundación):
// Cuando alguien se registra, le mandamos role: 'donador' o role: 'fundacion'
// dentro de options.data. Un trigger en la base de datos (ver sql/schema.sql,
// sección 13) lee ese dato y crea automáticamente la fila en la tabla
// "profiles". Así sabemos siempre qué tipo de cuenta es cada usuario.
// ============================================================================


// ----------------------------------------------------------------------------
// REGISTRO — DONADOR  (usado en signup-donador.html)
// ----------------------------------------------------------------------------
// fullName, idName: texto libre del formulario
// email, password: credenciales de acceso
async function signUpDonador(fullName, email, password) {
    const { data, error } = await window.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                role: "donador",
                full_name: fullName
            }
        }
    });

    if (error) {
        showToast(error.message);
        return { ok: false, error };
    }

    // Ya NO hacemos un insert manual aquí: la fila en donor_profiles la crea
    // automáticamente un trigger en la base de datos (ver sql/schema.sql,
    // sección 13), usando el "full_name" que mandamos arriba en options.data.
    // Esto funciona siempre, incluso si Supabase pide confirmar el correo
    // antes de crear una sesión (antes, el insert manual fallaba en ese caso).

    showToast("¡Cuenta creada! Revisa tu correo si se pide confirmación.");
    return { ok: true, data };
}


// ----------------------------------------------------------------------------
// REGISTRO — FUNDACIÓN  (usado en signup-fundacion.html)
// ----------------------------------------------------------------------------
async function signUpFundacion(repName, foundationName, email, phone, address, password) {
    const { data, error } = await window.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                role: "fundacion",
                full_name: repName,
                foundation_name: foundationName,
                phone: phone,
                address: address
            }
        }
    });

    if (error) {
        showToast(error.message);
        return { ok: false, error };
    }

    // Ya NO hacemos un insert manual aquí: la fila en "foundations" la crea
    // automáticamente el trigger de la base de datos (ver sql/schema.sql,
    // sección 13), usando foundation_name/phone/address que mandamos arriba
    // en options.data. Esto es lo que arregla el error de "foreign key
    // constraint" al crear una campaña justo después de registrarse.
    //
    // La geocodificación sí necesita una sesión activa (usa auth.uid()), así
    // que solo se intenta si Supabase ya creó la sesión en este mismo paso
    // (es decir, si no se exige confirmar el correo antes de iniciar sesión).
    if (data.session && address && typeof geocodeAndSaveFoundationLocation === "function") {
        geocodeAndSaveFoundationLocation(address);
    }

    showToast("¡Cuenta de fundación creada! Revisa tu correo si se pide confirmación.");
    return { ok: true, data };
}


// ----------------------------------------------------------------------------
// LOGIN — DONADOR  (usado en login-donador.html)
// ----------------------------------------------------------------------------
async function loginDonador(email, password) {
    const { data, error } = await window.supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showToast(error.message);
        return { ok: false, error };
    }

    // Redirige al dashboard del donador una vez logueado.
    window.location.href = "donador/dashboard.html";
    return { ok: true, data };
}


// ----------------------------------------------------------------------------
// LOGIN — FUNDACIÓN  (usado en login-fundacion.html)
// ----------------------------------------------------------------------------
async function loginFundacion(email, password) {
    const { data, error } = await window.supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showToast(error.message);
        return { ok: false, error };
    }

    window.location.href = "fundacion/dashboard.html";
    return { ok: true, data };
}


// ----------------------------------------------------------------------------
// LOGOUT — usado en el botón "Sign out" de settings/profile
// ----------------------------------------------------------------------------
async function logout(redirectTo) {
    await window.supabase.auth.signOut();
    window.location.href = redirectTo || "../login.html";
}


// ----------------------------------------------------------------------------
// OBTENER EL USUARIO ACTUAL (útil en dashboards para saber quién es)
// ----------------------------------------------------------------------------
async function getCurrentUser() {
    // getSession() (no getUser()): igual que en requireAuth() más abajo,
    // esto evita fallos al azar por una conexión lenta o inestable.
    const { data: { session } } = await window.supabase.auth.getSession();
    return session ? session.user : null;
}


// ----------------------------------------------------------------------------
// PROTEGER UNA PÁGINA (route guard)
// ----------------------------------------------------------------------------
// Llama esta función al inicio de cualquier página de dashboard para que,
// si no hay sesión activa, se redirija automáticamente al login.
// Ejemplo de uso en donador/dashboard.html:
//   requireAuth('donador', '../login-donador.html');
async function requireAuth(expectedRole, loginPageUrl) {
    // Usamos getSession() en vez de getUser(): getSession() lee la sesión
    // que YA está guardada en este navegador (rápido, sin depender de
    // internet). getUser() en cambio pregunta a los servidores de Supabase
    // "¿esta sesión sigue siendo válida?" cada vez — si en ese instante hay
    // un pestañeo de wifi/datos, esa pregunta puede fallar y antes hacía que
    // la app pensara "ya no hay sesión" y te mandara al login sin motivo.
    // Con getSession() eso ya no pasa: si la sesión existe localmente,
    // se confía en ella (y Supabase la renueva sola en segundo plano antes
    // de que expire de verdad).
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        window.location.href = loginPageUrl;
        return null;
    }
    const user = session.user;

    if (expectedRole) {
        const { data: profile } = await window.supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profile && profile.role !== expectedRole) {
            window.location.href = loginPageUrl;
            return null;
        }
    }

    return user;
}


// ----------------------------------------------------------------------------
// Pequeño helper de respaldo por si showToast() aún no existe en la página
// (algunas páginas del proyecto ya definen su propio showToast en el HTML;
// si ya existe, esta línea NO lo sobreescribe)
// ----------------------------------------------------------------------------
if (typeof window.showToast !== "function") {
    window.showToast = function (msg) {
        alert(msg);
    };
}
