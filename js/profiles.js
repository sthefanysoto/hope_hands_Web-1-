// ============================================================================
// HOPE HANDS · CAPA DE DATOS: PERFILES
// ============================================================================
// Funciones para leer/guardar el perfil del donador y el perfil de la
// fundación en Supabase (tablas donor_profiles y foundations, ver
// sql/schema.sql). Requiere que supabase-client.js y auth.js ya estén
// cargados antes que este archivo.
//
// Los nombres de los campos que devuelven estas funciones se mantienen
// IGUALES a los que ya usaban las páginas con localStorage (fullName,
// preferredContact, availabilitySelect, etc.) para no tener que reescribir
// toda la lógica de las páginas — solo cambia DE DÓNDE viene el dato.
// ============================================================================

// ----------------------------------------------------------------------------
// DONADOR
// ----------------------------------------------------------------------------

// Trae el perfil del donador actualmente logueado.
// Devuelve un objeto plano igual de forma al que antes vivía en
// localStorage('hopeHandsProfile'), para que el resto del código de la
// página no tenga que cambiar.
async function getDonorProfile() {
    const user = await getCurrentUser();
    if (!user) return {};

    const { data, error } = await window.supabase
        .from("donor_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("[Hope Hands] Error leyendo donor_profiles:", error);
        return {};
    }
    if (!data) return { email: user.email };

    // Traducimos nombres de columnas (snake_case en la BD) a los nombres
    // que ya usaba el HTML (camelCase / ids de los inputs).
    return {
        fullName: data.full_name || "",
        email: data.email || user.email || "",
        phone: data.phone || "",
        occupation: data.occupation || "",
        bio: data.bio || "",
        avatar: data.avatar_url || "",
        preferences: data.preferences || [],
        preferredContact: data.preferred_contact || "",
        city: data.city || "",
        area: data.neighborhood || "",
        availabilitySelect: data.availability || "",
        transport: data.transport || ""
    };
}

// Guarda (crea o actualiza) el perfil del donador logueado.
// "profile" trae los mismos nombres de campo que devuelve getDonorProfile().
async function saveDonorProfile(profile) {
    const user = await getCurrentUser();
    if (!user) {
        showToast("You must be logged in to save your profile.");
        return { ok: false };
    }

    const row = {
        user_id: user.id,
        full_name: profile.fullName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        occupation: profile.occupation || "",
        bio: profile.bio || "",
        avatar_url: profile.avatar || "",
        preferences: profile.preferences || [],
        preferred_contact: profile.preferredContact || "",
        city: profile.city || "",
        neighborhood: profile.area || "",
        availability: profile.availabilitySelect || "",
        transport: profile.transport || "",
        updated_at: new Date().toISOString()
    };

    // upsert = "insertar si no existe, actualizar si ya existe"
    const { error } = await window.supabase
        .from("donor_profiles")
        .upsert(row, { onConflict: "user_id" });

    if (error) {
        console.error("[Hope Hands] Error guardando donor_profiles:", error);
        showToast("Could not save your profile: " + error.message);
        return { ok: false, error };
    }
    return { ok: true };
}


// ----------------------------------------------------------------------------
// FUNDACIÓN
// ----------------------------------------------------------------------------

// Trae el perfil de la fundación actualmente logueada.
async function getFoundationProfile() {
    const user = await getCurrentUser();
    if (!user) return {};

    const { data, error } = await window.supabase
        .from("foundations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("[Hope Hands] Error leyendo foundations:", error);
        return {};
    }
    if (!data) return { email: user.email };

    return {
        foundationName: data.foundation_name || "",
        tagline: data.tagline || "",
        mission: data.mission || "",
        foundedYear: data.founded_year || "",
        category: data.category || "",
        schedule: data.schedule || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || user.email || "",
        website: data.website || "",
        legalId: data.legal_id || "",
        facebook: data.facebook || "",
        instagram: data.instagram || "",
        logo: data.logo_url || "",
        verified: !!data.verified,
        premium: !!data.premium
    };
}

// Guarda (crea o actualiza) el perfil de la fundación logueada.
async function saveFoundationProfile(profile) {
    const user = await getCurrentUser();
    if (!user) {
        showToast("You must be logged in to save your foundation profile.");
        return { ok: false };
    }

    const row = {
        user_id: user.id,
        foundation_name: profile.foundationName || "",
        tagline: profile.tagline || "",
        mission: profile.mission || "",
        founded_year: profile.foundedYear ? parseInt(profile.foundedYear) : null,
        category: profile.category || "",
        schedule: profile.schedule || "",
        address: profile.address || "",
        phone: profile.phone || "",
        email: profile.email || "",
        website: profile.website || "",
        legal_id: profile.legalId || "",
        facebook: profile.facebook || "",
        instagram: profile.instagram || "",
        logo_url: profile.logo || "",
        updated_at: new Date().toISOString()
    };

    const { error } = await window.supabase
        .from("foundations")
        .upsert(row, { onConflict: "user_id" });

    if (error) {
        console.error("[Hope Hands] Error guardando foundations:", error);
        showToast("Could not save the foundation profile: " + error.message);
        return { ok: false, error };
    }
    return { ok: true };
}

// Convierte una dirección de texto en coordenadas (lat/lng) usando el
// servicio gratuito de geocodificación de OpenStreetMap (Nominatim), y las
// guarda en la fundación logueada. No requiere ninguna API key.
// Se usa para que la fundación aparezca en el mapa de donador/foundations.html.
// Si la dirección no se puede ubicar, no falla — simplemente no guarda
// coordenadas y la fundación no aparece en el mapa (pero sí en el listado).
async function geocodeAndSaveFoundationLocation(address) {
    const user = await getCurrentUser();
    if (!user || !address) return { ok: false };

    try {
        const query = encodeURIComponent(address + ", Panama");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
        const results = await res.json();
        if (!results.length) return { ok: false, notFound: true };

        const { error } = await window.supabase
            .from("foundations")
            .update({ latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) })
            .eq("user_id", user.id);

        if (error) { console.error(error); return { ok: false, error }; }
        return { ok: true, lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    } catch (e) {
        console.error("[Hope Hands] Error geocodificando dirección:", e);
        return { ok: false, error: e };
    }
}

// Equipo (team members) de la fundación logueada.
async function getFoundationTeam(foundationId) {
    const { data, error } = await window.supabase
        .from("foundation_team_members")
        .select("*")
        .eq("foundation_id", foundationId)
        .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return data;
}
async function addFoundationTeamMember(foundationId, name, role, email) {
    return window.supabase.from("foundation_team_members")
        .insert({ foundation_id: foundationId, name, role, email });
}
async function deleteFoundationTeamMember(id) {
    return window.supabase.from("foundation_team_members").delete().eq("id", id);
}

// Voluntarios de la fundación logueada.
async function getFoundationVolunteers(foundationId) {
    const { data, error } = await window.supabase
        .from("foundation_volunteers")
        .select("*")
        .eq("foundation_id", foundationId)
        .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return data;
}
async function addFoundationVolunteer(foundationId, name, contact, role, status) {
    return window.supabase.from("foundation_volunteers")
        .insert({ foundation_id: foundationId, name, contact, role, status });
}
async function deleteFoundationVolunteer(id) {
    return window.supabase.from("foundation_volunteers").delete().eq("id", id);
}

// Ubicaciones (sedes / puntos de recepción) de la fundación logueada.
async function getFoundationLocations(foundationId) {
    const { data, error } = await window.supabase
        .from("foundation_locations")
        .select("*")
        .eq("foundation_id", foundationId)
        .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return data;
}
async function addFoundationLocation(foundationId, name, address) {
    return window.supabase.from("foundation_locations")
        .insert({ foundation_id: foundationId, name, address });
}
async function deleteFoundationLocation(id) {
    return window.supabase.from("foundation_locations").delete().eq("id", id);
}

// ----------------------------------------------------------------------------
// PREMIUM / VERIFIED PARTNER (fundacion/agent-of-change.html, premium-checkout.html)
// ----------------------------------------------------------------------------

// Trae la suscripción premium activa de la fundación logueada, si existe.
async function getActiveSubscription() {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await window.supabase
        .from("premium_subscriptions")
        .select("*")
        .eq("foundation_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .maybeSingle();
    if (error) { console.error(error); return null; }
    return data;
}

// Marca a la fundación como premium=true y registra la suscripción.
// NOTA: esto NO cobra nada ni valida ninguna tarjeta — eso debe hacerlo un
// procesador de pagos real (Stripe, etc). "cardLast4" son solo los últimos
// 4 dígitos que ese procesador te devuelva, jamás el número completo.
async function activatePremium(billingEmail, cardLast4) {
    const user = await getCurrentUser();
    if (!user) return { ok: false };

    const { error: e1 } = await window.supabase
        .from("foundations")
        .update({ premium: true })
        .eq("user_id", user.id);
    if (e1) { console.error(e1); return { ok: false, error: e1 }; }

    const { error: e2 } = await window.supabase
        .from("premium_subscriptions")
        .insert({ foundation_id: user.id, billing_email: billingEmail, card_last4: cardLast4, status: "active" });
    if (e2) { console.error(e2); return { ok: false, error: e2 }; }

    return { ok: true };
}

// Cancela la suscripción activa y quita el flag premium.
async function cancelPremium() {
    const user = await getCurrentUser();
    if (!user) return { ok: false };

    await window.supabase.from("premium_subscriptions")
        .update({ status: "cancelled" })
        .eq("foundation_id", user.id).eq("status", "active");

    const { error } = await window.supabase
        .from("foundations")
        .update({ premium: false })
        .eq("user_id", user.id);
    if (error) { console.error(error); return { ok: false, error }; }
    return { ok: true };
}

// ----------------------------------------------------------------------------
// FUNDACIONES REALES (donador/dashboard.html, "Recommended Foundations")
// ----------------------------------------------------------------------------

// Trae fundaciones reales para mostrar como "recomendadas". No hay todavía
// un algoritmo de match real, así que simplemente se muestran las más
// recientes/verificadas — sin porcentajes de compatibilidad inventados.
async function getRecommendedFoundations(limit) {
    const { data, error } = await window.supabase
        .from("foundations")
        .select("user_id, foundation_name, category, verified")
        .order("verified", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit || 4);
    if (error) { console.error(error); return []; }
    return data;
}

// Estadísticas globales reales de la plataforma (para el hero de home.html).
// No requiere sesión. Cuenta fundaciones registradas, campañas activas,
// total de productos donados (suma de "quantity" en donations) y donadores
// únicos que ya han hecho al menos una donación.
async function getPlatformStats() {
    const [{ count: foundationsCount }, { count: campaignsCount }, { data: donations }] = await Promise.all([
        window.supabase.from("foundations").select("*", { count: "exact", head: true }),
        window.supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "Active"),
        window.supabase.from("donations").select("donor_id, quantity")
    ]);

    const productsTotal = (donations || []).reduce((sum, d) => sum + (d.quantity || 0), 0);
    const donorCount = new Set((donations || []).map(d => d.donor_id)).size;

    return {
        foundations: foundationsCount || 0,
        campaigns: campaignsCount || 0,
        products: productsTotal,
        donors: donorCount
    };
}

// Perfil público de UNA fundación por su user_id, con conteo real de
// donadores únicos (para donador/foundation-profile.html). No requiere sesión.
async function getFoundationPublicProfile(foundationId) {
    const { data: f, error } = await window.supabase
        .from("foundations")
        .select("*")
        .eq("user_id", foundationId)
        .maybeSingle();
    if (error || !f) return null;

    const { data: donations } = await window.supabase
        .from("donations")
        .select("donor_id")
        .eq("foundation_id", foundationId);
    const donorCount = donations ? new Set(donations.map(d => d.donor_id)).size : 0;

    return {
        id: f.user_id,
        name: f.foundation_name,
        location: f.address || "Ciudad de Panamá, Panamá",
        desc: f.mission || f.tagline || "This foundation hasn't added a description yet.",
        category: f.category,
        donors: donorCount,
        verified: f.verified
    };
}

// Todas las fundaciones públicas, con conteo de campañas activas y
// donadores únicos (para foundations.html). No requiere sesión.
async function getPublicFoundationsWithStats() {
    const [{ data: foundations, error: e1 }, { data: campaigns, error: e2 }, { data: donations, error: e3 }, { data: resources }] =
        await Promise.all([
            window.supabase.from("foundations").select("*"),
            window.supabase.from("campaigns").select("foundation_id, status"),
            window.supabase.from("donations").select("foundation_id, donor_id"),
            window.supabase.from("foundation_resources").select("foundation_id, quantity")
        ]);

    if (e1) { console.error(e1); return []; }

    const activeCampaignCounts = {};
    (campaigns || []).forEach(c => {
        if (c.status === "Active") {
            activeCampaignCounts[c.foundation_id] = (activeCampaignCounts[c.foundation_id] || 0) + 1;
        }
    });

    const donorSets = {};
    (donations || []).forEach(d => {
        if (!donorSets[d.foundation_id]) donorSets[d.foundation_id] = new Set();
        donorSets[d.foundation_id].add(d.donor_id);
    });

    const productsNeeded = {};
    (resources || []).forEach(r => {
        productsNeeded[r.foundation_id] = (productsNeeded[r.foundation_id] || 0) + (r.quantity || 0);
    });

    return (foundations || []).map(f => ({
        userId: f.user_id,
        name: f.foundation_name,
        category: f.category,
        description: f.mission || f.tagline || "",
        verified: f.verified,
        address: f.address || "",
        latitude: f.latitude,
        longitude: f.longitude,
        activeCampaigns: activeCampaignCounts[f.user_id] || 0,
        donorCount: donorSets[f.user_id] ? donorSets[f.user_id].size : 0,
        productsNeeded: productsNeeded[f.user_id] || 0
    }));
}
