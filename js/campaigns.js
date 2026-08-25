// ============================================================================
// HOPE HANDS · CAPA DE DATOS: CAMPAÑAS
// ============================================================================
// Funciones para crear, leer, actualizar y borrar campañas (tabla
// "campaigns") y los productos que cada campaña necesita (tabla
// "campaign_products"). Ver sql/schema.sql.
//
// Los objetos que devuelven estas funciones usan los mismos nombres de
// campo que ya usaba el código con localStorage (name, category, endDate,
// goalType, goal, status, featured, desc, products[]) para minimizar los
// cambios en las páginas existentes.
// ============================================================================

// Convierte una fila de la tabla "campaigns" (+ sus productos) al formato
// que ya esperaba el HTML original.
function _mapCampaignRow(row, products) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        endDate: row.end_date,
        goalType: row.goal_type,
        goal: row.goal,
        raised: row.raised,
        status: row.status,
        featured: row.featured,
        desc: row.description,
        created: row.created_at,
        foundationId: row.foundation_id,
        products: (products || []).map(p => ({ name: p.product_name, qty: p.quantity }))
    };
}

// ----------------------------------------------------------------------------
// LECTURA
// ----------------------------------------------------------------------------

// Todas las campañas de la fundación actualmente logueada (para
// fundacion/campaigns.html y fundacion/add-campaign.html en modo edición).
async function getFoundationCampaigns() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data: campaigns, error } = await window.supabase
        .from("campaigns")
        .select("*, campaign_products(*)")
        .eq("foundation_id", user.id)
        .order("created_at", { ascending: false });

    if (error) { console.error("[Hope Hands] Error leyendo campaigns:", error); return []; }

    return campaigns.map(c => _mapCampaignRow(c, c.campaign_products));
}

// Todas las campañas activas de TODAS las fundaciones (para la página
// pública campaigns.html y donador/campaigns.html). No requiere sesión.
async function getPublicCampaigns() {
    const { data: campaigns, error } = await window.supabase
        .from("campaigns")
        .select("*, campaign_products(*), foundations(foundation_name, logo_url, verified)")
        .eq("status", "Active")
        .order("created_at", { ascending: false });

    if (error) { console.error("[Hope Hands] Error leyendo campaigns públicas:", error); return []; }

    return campaigns.map(c => ({
        ..._mapCampaignRow(c, c.campaign_products),
        foundationName: c.foundations ? c.foundations.foundation_name : "",
        foundationLogo: c.foundations ? c.foundations.logo_url : "",
        foundationVerified: c.foundations ? c.foundations.verified : false
    }));
}

// Una sola campaña por id (para pantallas de detalle).
async function getCampaignById(id) {
    const { data: row, error } = await window.supabase
        .from("campaigns")
        .select("*, campaign_products(*)")
        .eq("id", id)
        .maybeSingle();
    if (error || !row) return null;
    return _mapCampaignRow(row, row.campaign_products);
}

// Campañas activas de UNA fundación específica, para
// donador/foundation-profile.html. No requiere sesión (lectura pública).
async function getActiveCampaignsForFoundation(foundationId) {
    const { data: campaigns, error } = await window.supabase
        .from("campaigns")
        .select("*, campaign_products(*)")
        .eq("foundation_id", foundationId)
        .eq("status", "Active")
        .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return campaigns.map(c => _mapCampaignRow(c, c.campaign_products));
}

// ----------------------------------------------------------------------------
// ESCRITURA
// ----------------------------------------------------------------------------

// Crea una campaña nueva. "data" trae los mismos campos que usaba
// add-campaign.html: name, category, endDate, goalType, goal, status,
// featured, desc, products: [{name, qty}].
async function createCampaign(data) {
    const user = await getCurrentUser();
    if (!user) { showToast("You must be logged in as a foundation."); return { ok: false }; }

    const { data: inserted, error } = await window.supabase
        .from("campaigns")
        .insert({
            foundation_id: user.id,
            name: data.name,
            category: data.category,
            end_date: data.endDate || null,
            goal_type: data.goalType || "products",
            goal: data.goal || 0,
            status: data.status || "Active",
            featured: !!data.featured,
            description: data.desc
        })
        .select()
        .single();

    if (error) { console.error(error); showToast("Could not create the campaign: " + error.message); return { ok: false, error }; }

    await _replaceCampaignProducts(inserted.id, data.products || []);
    return { ok: true, id: inserted.id };
}

// Actualiza una campaña existente (modo edición en add-campaign.html).
async function updateCampaign(id, data) {
    const { error } = await window.supabase
        .from("campaigns")
        .update({
            name: data.name,
            category: data.category,
            end_date: data.endDate || null,
            goal_type: data.goalType || "products",
            goal: data.goal || 0,
            status: data.status || "Active",
            featured: !!data.featured,
            description: data.desc
        })
        .eq("id", id);

    if (error) { console.error(error); showToast("Could not update the campaign: " + error.message); return { ok: false, error }; }

    await _replaceCampaignProducts(id, data.products || []);
    return { ok: true, id };
}

// Borra y vuelve a insertar los productos de una campaña (más simple que
// calcular diffs para un formulario pequeño como este).
async function _replaceCampaignProducts(campaignId, products) {
    await window.supabase.from("campaign_products").delete().eq("campaign_id", campaignId);
    const rows = (products || [])
        .filter(p => p.name)
        .map(p => ({ campaign_id: campaignId, product_name: p.name, quantity: p.qty || 1 }));
    if (rows.length) {
        await window.supabase.from("campaign_products").insert(rows);
    }
}

async function deleteCampaign(id) {
    const { error } = await window.supabase.from("campaigns").delete().eq("id", id);
    if (error) { console.error(error); showToast("Could not delete the campaign: " + error.message); return { ok: false }; }
    return { ok: true };
}
