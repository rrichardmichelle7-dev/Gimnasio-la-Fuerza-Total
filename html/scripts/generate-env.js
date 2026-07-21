const fs = require("fs");
const path = require("path");

const REQUIRED_ENV_VARS = [
  "APP_ENV",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY"
];

const FORBIDDEN_ENV_VARS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE",
  "SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "JWT_SECRET",
  "SUPABASE_JWT_SECRET"
];

const FORBIDDEN_VALUE_PATTERNS = [
  /service[_-]?role/i,
  /sb_secret/i,
  /jwt[_-]?secret/i,
  /private[_-]?key/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
];

const PLACEHOLDER_PATTERNS = [
  /^PEGAR_/i,
  /^TU_/i,
  /<.*>/,
  /proyecto-staging/i
];

function readRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Falta la variable requerida ${name}.`);
  }

  const normalizedValue = value.trim();

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalizedValue))) {
    throw new Error(`${name} contiene un placeholder y no un valor real.`);
  }

  if (FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(normalizedValue))) {
    throw new Error(`${name} parece contener una clave privada o service_role.`);
  }

  return normalizedValue;
}

function assertForbiddenEnvVarsAreAbsent() {
  const presentForbiddenVars = FORBIDDEN_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return value && value.trim();
  });

  if (presentForbiddenVars.length > 0) {
    throw new Error(
      `No se aceptan variables secretas en este build: ${presentForbiddenVars.join(", ")}.`
    );
  }
}

function assertValidSupabaseUrl(value) {
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch (error) {
    throw new Error("SUPABASE_URL no es una URL valida.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("SUPABASE_URL debe usar https.");
  }

  if (!parsedUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("SUPABASE_URL debe ser el Project URL de Supabase.");
  }
}

function generateEnvFile(env) {
  const targetPath = path.join(process.cwd(), "js", "env.js");
  const contents = `window.FITCONTROL_ENV = ${JSON.stringify(env, null, 2)};\n`;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents, "utf8");

  console.info(`Generado ${path.relative(process.cwd(), targetPath)} para ${env.APP_ENV}.`);
}

function main() {
  assertForbiddenEnvVarsAreAbsent();

  const env = Object.fromEntries(
    REQUIRED_ENV_VARS.map((name) => [name, readRequiredEnv(name)])
  );

  assertValidSupabaseUrl(env.SUPABASE_URL);
  generateEnvFile(env);
}

try {
  main();
} catch (error) {
  console.error(`Error generando js/env.js: ${error.message}`);
  process.exit(1);
}
