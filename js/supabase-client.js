// Kilvio FIT - Cliente global de Supabase.
// TODO SUPABASE: reemplaza estos placeholders por Project URL y anon public key desde Supabase > Project Settings > API.
// TODO SECURITY: no uses service_role key en frontend.

const SUPABASE_URL = "https://fpmybokqphpeoaszmolo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tkIVPSwAI_0KZFIH5rTvug_KUsC8kqc";

window.kilvioSupabase = null;

try {
    if (!window.supabase?.createClient) {
        console.error("Supabase JS no esta cargado. Revisa el orden de scripts en index.html.");
    } else {
        window.kilvioSupabase = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

        console.log("Cliente Supabase disponible en window.kilvioSupabase");
    }
} catch (error) {
    console.error("No se pudo crear el cliente Supabase:", error);
}

async function testSupabaseConnection() {
    if (!window.kilvioSupabase) {
        console.error("window.kilvioSupabase no existe. Configura js/supabase-client.js.");
        return { success: false, error: "Cliente Supabase no disponible" };
    }

    const tableCandidates = ["miembros", "Miembros"];

    for (const tableName of tableCandidates) {
        const { data, error } = await window.kilvioSupabase
            .from(tableName)
            .select("*")
            .limit(1);

        if (!error) {
            console.log("Supabase conectado correctamente", { table: tableName, rows: data?.length || 0 });
            return { success: true, table: tableName, data };
        }

        if (tableName === tableCandidates[tableCandidates.length - 1]) {
            console.error("Supabase respondio, pero no se pudo consultar miembros/Miembros:", error.message);
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: "No se encontro tabla de miembros" };
}

window.testSupabaseConnection = testSupabaseConnection;

