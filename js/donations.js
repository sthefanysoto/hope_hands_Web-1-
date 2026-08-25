// ============================================================================
// HOPE HANDS · CAPA DE DATOS: DONACIONES / SOLICITUDES DE APOYO / GUARDADOS
// ============================================================================
// Tablas: donations, support_requests, saved_campaigns (ver sql/schema.sql).
// Todas estas funciones requieren un donador logueado.
// ============================================================================

// ---- Campañas guardadas ("favoritos" del donador) -------------------------

async function getSavedCampaignIds() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await window.supabase
        .from("saved_campaigns")
        .select("campaign_id")
        .eq("donor_id", user.id);
    if (error) { console.error(error); return []; }
    return data.map(r => r.campaign_id);
}

// Guarda o quita una campaña de favoritos. Devuelve true si quedó guardada,
// false si quedó quitada (útil para actualizar el ícono de corazón).
async function toggleSavedCampaign(campaignId) {
    const user = await getCurrentUser();
    if (!user) { showToast("You must be logged in to save campaigns."); return null; }

    const { data: existing } = await window.supabase
        .from("saved_campaigns")
        .select("campaign_id")
        .eq("donor_id", user.id)
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (existing) {
        await window.supabase.from("saved_campaigns").delete()
            .eq("donor_id", user.id).eq("campaign_id", campaignId);
        return false;
    } else {
        await window.supabase.from("saved_campaigns")
            .insert({ donor_id: user.id, campaign_id: campaignId });
        return true;
    }
}

// ---- Solicitudes de apoyo ("Offer support") --------------------------------

// data: { foundationId, campaignId, supportType, message }
async function createSupportRequest(data) {
    const user = await getCurrentUser();
    if (!user) { showToast("You must be logged in to send a support request."); return { ok: false }; }

    const { error } = await window.supabase.from("support_requests").insert({
        donor_id: user.id,
        foundation_id: data.foundationId,
        campaign_id: data.campaignId || null,
        support_type: data.supportType,
        message: data.message
    });

    if (error) { console.error(error); showToast("Could not send the request: " + error.message); return { ok: false, error }; }
    return { ok: true };
}

// Solicitudes de apoyo recibidas por la fundación logueada (para
// fundacion/donors.html, por ejemplo).
async function getFoundationSupportRequests() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await window.supabase
        .from("support_requests")
        .select("*, donor_profiles(full_name, email), campaigns(name)")
        .eq("foundation_id", user.id)
        .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
}

// ---- Donaciones -------------------------------------------------------------

// data: { foundationId, campaignId, productName, quantity }
async function createDonation(data) {
    const user = await getCurrentUser();
    if (!user) { showToast("You must be logged in to donate."); return { ok: false }; }

    const { error } = await window.supabase.from("donations").insert({
        donor_id: user.id,
        foundation_id: data.foundationId,
        campaign_id: data.campaignId || null,
        product_name: data.productName,
        quantity: data.quantity || 1
    });

    if (error) { console.error(error); showToast("Could not register the donation: " + error.message); return { ok: false, error }; }
    return { ok: true };
}

// Todas las donaciones hechas por el donador logueado (para
// donador/dashboard.html y donador/impact.html).
async function getDonorDonations() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await window.supabase
        .from("donations")
        .select("*, foundations(foundation_name), campaigns(name)")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
}

// Todas las donaciones recibidas por la fundación logueada (para
// fundacion/dashboard.html y fundacion/reports.html).
async function getFoundationDonations() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await window.supabase
        .from("donations")
        .select("*, donor_profiles(full_name, email), campaigns(name)")
        .eq("foundation_id", user.id)
        .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
}

// Top donadores del mes actual, agregando la cantidad total donada por
// cada uno (para donador/dashboard.html, "Top Donors This Month").
// No requiere sesión de fundación: es un ranking general de la plataforma.
async function getTopDonorsThisMonth(limit) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await window.supabase
        .from("donations")
        .select("donor_id, quantity, donor_profiles(full_name)")
        .gte("created_at", monthStart);

    if (error) { console.error(error); return []; }

    const totals = {};
    data.forEach(row => {
        const id = row.donor_id;
        if (!totals[id]) {
            totals[id] = { donorId: id, name: (row.donor_profiles && row.donor_profiles.full_name) || "Donor", total: 0 };
        }
        totals[id].total += row.quantity || 0;
    });

    return Object.values(totals)
        .sort((a, b) => b.total - a.total)
        .slice(0, limit || 5);
}
