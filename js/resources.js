// ============================================================================
// HOPE HANDS · CAPA DE DATOS: RECURSOS / PRODUCTOS NECESITADOS
// ============================================================================
// Tabla: foundation_resources (ver sql/schema.sql). Corresponde a
// fundacion/add-resource.html y fundacion/products.html.
// ============================================================================

function _mapResourceRow(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        priority: row.priority,
        qty: row.quantity,
        unit: row.unit,
        notes: row.notes,
        received: row.received,
        created: row.created_at
    };
}

// Suma 1 a lo "recibido" de un recurso (botón "+1 received" en products.html).
async function incrementResourceReceived(id, currentReceived) {
    const { error } = await window.supabase
        .from("foundation_resources")
        .update({ received: (currentReceived || 0) + 1 })
        .eq("id", id);
    if (error) { console.error(error); return { ok: false }; }
    return { ok: true };
}

// Todos los recursos de la fundación logueada.
async function getFoundationResources() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await window.supabase
        .from("foundation_resources")
        .select("*")
        .eq("foundation_id", user.id)
        .order("created_at", { ascending: false });
    if (error) { console.error("[Hope Hands] Error leyendo foundation_resources:", error); return []; }
    return data.map(_mapResourceRow);
}

// Crea un recurso nuevo. "data": {name, category, priority, qty, unit, notes}
async function createResource(data) {
    const user = await getCurrentUser();
    if (!user) { showToast("You must be logged in as a foundation."); return { ok: false }; }

    const { error } = await window.supabase.from("foundation_resources").insert({
        foundation_id: user.id,
        name: data.name,
        category: data.category,
        priority: data.priority,
        quantity: data.qty || 1,
        unit: data.unit,
        notes: data.notes
    });

    if (error) { console.error(error); showToast("Could not add the product: " + error.message); return { ok: false, error }; }
    return { ok: true };
}

async function deleteResource(id) {
    const { error } = await window.supabase.from("foundation_resources").delete().eq("id", id);
    if (error) { console.error(error); showToast("Could not delete the product: " + error.message); return { ok: false }; }
    return { ok: true };
}

// Recursos/productos que necesita UNA fundación específica, para
// donador/foundation-profile.html. No requiere sesión (lectura pública).
async function getResourcesForFoundation(foundationId) {
    const { data, error } = await window.supabase
        .from("foundation_resources")
        .select("*")
        .eq("foundation_id", foundationId)
        .order("priority", { ascending: true });
    if (error) { console.error(error); return []; }
    return data.map(_mapResourceRow);
}
