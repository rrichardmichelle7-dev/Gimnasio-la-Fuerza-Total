// Kilvio FIT - Supabase browser client.
// Valores publicos de Project Settings > API.
// TODO SECURITY: usa solo Project URL + Publishable Key en frontend. Nunca pegues service_role aqui.

const DEFAULT_APP_ENV = "";
const DEFAULT_SUPABASE_URL = "";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "";

const FITCONTROL_ENV = window.FITCONTROL_ENV || {};

const esPlaceholderEnv = (value) => {
    const text = String(value || "").trim();
    return !text ||
        text === "SUPABASE_URL" ||
        text === "SUPABASE_ANON_KEY" ||
        text === "SUPABASE_PUBLISHABLE_KEY" ||
        text === "PEGAR_PROJECT_URL" ||
        text === "PEGAR_PUBLISHABLE_KEY" ||
        text === "PEGAR_PROJECT_URL_STAGING" ||
        text === "PEGAR_PUBLISHABLE_KEY_STAGING";
};

const envDeclarado = !esPlaceholderEnv(FITCONTROL_ENV.APP_ENV)
    ? String(FITCONTROL_ENV.APP_ENV).trim()
    : DEFAULT_APP_ENV;

const tieneConfigExternaSupabase = !esPlaceholderEnv(FITCONTROL_ENV.SUPABASE_URL) &&
    !esPlaceholderEnv(FITCONTROL_ENV.SUPABASE_PUBLISHABLE_KEY);

const APP_ENV = envDeclarado || "sin_configurar";

const SUPABASE_URL = tieneConfigExternaSupabase
    ? String(FITCONTROL_ENV.SUPABASE_URL).trim()
    : DEFAULT_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY = tieneConfigExternaSupabase
    ? String(FITCONTROL_ENV.SUPABASE_PUBLISHABLE_KEY).trim()
    : DEFAULT_SUPABASE_PUBLISHABLE_KEY;

const supabaseClient = (() => {
    if (!window.supabase?.createClient) {
        console.error("Supabase JS no esta cargado. Revisa el orden de scripts antes de supabase-client.js.");
        return null;
    }

    if (!tieneConfigExternaSupabase) {
        console.warn("Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY reales en js/env.js. No se usara fallback automatico.");
        return null;
    }

    return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
})();

window.kilvioSupabase = supabaseClient;
window.supabaseClient = supabaseClient;
window.fitControlEnvironment = {
    appEnv: APP_ENV,
    supabaseUrl: SUPABASE_URL
};
