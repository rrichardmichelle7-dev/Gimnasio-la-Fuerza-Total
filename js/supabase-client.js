// Kilvio FIT - Supabase browser client.
// Valores publicos de Project Settings > API.
// TODO SECURITY: usa solo la anon key publica en frontend. Nunca pegues service_role aqui.

const SUPABASE_URL = "https://fpmybokqphpeoaszmolo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tkIVPSwAI_0KZFIH5rTvug_KUsC8kqc";

const supabaseClient = (() => {
    if (!window.supabase?.createClient) {
        console.warn("Supabase JS no esta cargado. Se usara el fallback local cuando aplique.");
        return null;
    }

    if (
        !SUPABASE_URL ||
        !SUPABASE_ANON_KEY ||
        SUPABASE_URL === "SUPABASE_URL" ||
        SUPABASE_ANON_KEY === "SUPABASE_ANON_KEY"
    ) {
        console.warn("Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase-client.js.");
        return null;
    }

    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
})();

window.kilvioSupabase = supabaseClient;
