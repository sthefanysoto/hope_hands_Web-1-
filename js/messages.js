// ============================================================================
// HOPE HANDS · CAPA DE DATOS: MENSAJES (CHAT)
// ============================================================================
// Tabla: messages (ver sql/schema.sql o sql/messages_addon.sql).
// Una "conversación" es simplemente el conjunto de mensajes entre UN
// donador y UNA fundación (opcionalmente ligados a una campaña).
// ============================================================================

// Envía un mensaje. role: 'donador' o 'fundacion' (quién lo envía).
async function sendMessage(donorId, foundationId, campaignId, role, body) {
    const { error } = await window.supabase.from("messages").insert({
        donor_id: donorId,
        foundation_id: foundationId,
        campaign_id: campaignId || null,
        sender_role: role,
        body: body
    });
    if (error) { console.error(error); showToast("Could not send the message: " + error.message); return { ok: false, error }; }
    return { ok: true };
}

// Todos los mensajes entre un donador y una fundación específicos,
// ordenados del más viejo al más nuevo (para pintar el chat de arriba a abajo).
async function getThreadMessages(donorId, foundationId) {
    const { data, error } = await window.supabase
        .from("messages")
        .select("*")
        .eq("donor_id", donorId)
        .eq("foundation_id", foundationId)
        .order("created_at", { ascending: true });
    if (error) { console.error(error); return []; }
    return data;
}

// Marca como leídos todos los mensajes de una conversación que NO fueron
// enviados por "myRole" (o sea, marca como leído lo que me mandaron a mí).
async function markThreadAsRead(donorId, foundationId, myRole) {
    const otherRole = myRole === "donador" ? "fundacion" : "donador";
    await window.supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("donor_id", donorId)
        .eq("foundation_id", foundationId)
        .eq("sender_role", otherRole)
        .is("read_at", null);
}

// ---- Bandeja de la FUNDACIÓN: una fila por cada donador con quien ha
// conversado, con el último mensaje y si tiene algo sin leer. ----
async function getFoundationConversations() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await window.supabase
        .from("messages")
        .select("*, donor_profiles(full_name, email)")
        .eq("foundation_id", user.id)
        .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }

    const byDonor = {};
    data.forEach(m => {
        if (!byDonor[m.donor_id]) {
            byDonor[m.donor_id] = {
                donorId: m.donor_id,
                donorName: (m.donor_profiles && m.donor_profiles.full_name) || "Donor",
                donorEmail: (m.donor_profiles && m.donor_profiles.email) || "",
                lastMessage: m.body,
                lastMessageAt: m.created_at,
                unread: 0
            };
        }
        if (m.sender_role === "donador" && !m.read_at) byDonor[m.donor_id].unread++;
    });

    return Object.values(byDonor).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

// ---- Bandeja del DONADOR: una fila por cada fundación con quien ha
// conversado. ----
async function getDonorConversations() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await window.supabase
        .from("messages")
        .select("*, foundations(foundation_name, email)")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false });
    if (error) { console.error(error); return []; }

    const byFoundation = {};
    data.forEach(m => {
        if (!byFoundation[m.foundation_id]) {
            byFoundation[m.foundation_id] = {
                foundationId: m.foundation_id,
                foundationName: (m.foundations && m.foundations.foundation_name) || "Foundation",
                lastMessage: m.body,
                lastMessageAt: m.created_at,
                unread: 0
            };
        }
        if (m.sender_role === "fundacion" && !m.read_at) byFoundation[m.foundation_id].unread++;
    });

    return Object.values(byFoundation).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

// Conteo total de mensajes sin leer para la campanita de notificaciones.
// myRole: 'donador' o 'fundacion'.
async function getUnreadMessageCount(myRole) {
    const user = await getCurrentUser();
    if (!user) return 0;

    const otherRole = myRole === "donador" ? "fundacion" : "donador";
    const column = myRole === "donador" ? "donor_id" : "foundation_id";

    const { count, error } = await window.supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq(column, user.id)
        .eq("sender_role", otherRole)
        .is("read_at", null);

    if (error) { console.error(error); return 0; }
    return count || 0;
}
