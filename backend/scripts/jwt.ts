import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Logger } from "../src/utils/logger";

const logger = new Logger();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDevVars(): Record<string, string> {
  const envPath = path.join(__dirname, "..", ".dev.vars");
  const env: Record<string, string> = {};

  if (!fs.existsSync(envPath)) {
    logger.error(`Error: .dev.vars not found at ${envPath}`);
    logger.error("Please ensure .dev.vars exists in backend/ directory");
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  return env;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const env = loadDevVars();

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;

  if (!SUPABASE_URL) {
    logger.error("Error: SUPABASE_URL not found in .dev.vars");
    process.exit(1);
  }

  switch (command) {
    case "signin": {
      const email = args[1];
      const password = args[2];

      if (!email || !password) {
        logger.error(
          "Usage: npx tsx scripts/jwt.ts signin <email> <password>",
        );
        process.exit(1);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error("Sign in failed:", error.message);
        process.exit(1);
      }

      const accessToken = data.session?.access_token;
      const refreshToken = data.session?.refresh_token;
      const user = data.user;

      logger.info("\n=== Supabase JWT ===");
      logger.info("\nAccess Token:");
      logger.info(accessToken);
      logger.info("\nRefresh Token:");
      logger.info(refreshToken);
      logger.info("\nUser:");
      logger.info(JSON.stringify(user, null, 2));
      logger.info("\n=== Test the API ===");
      logger.info(
        `curl -H "Authorization: Bearer ${accessToken}" http://localhost:8787/bookings`,
      );
      break;
    }

    case "signup": {
      const email = args[1];
      const password = args[2];
      const role = args[3];
      const provider_id = args[4];

      if (!email || !password) {
        logger.error(
          "Usage: npx tsx scripts/jwt.ts signup <email> <password> [role] [provider_id]",
        );
        process.exit(1);
      }

      if (!SUPABASE_SECRET_KEY) {
        logger.error("Error: SUPABASE_SECRET_KEY not found in .dev.vars");
        process.exit(1);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const metadata: { role?: string; provider_id?: string } = {};
      if (role) metadata.role = role;
      if (provider_id) metadata.provider_id = provider_id;

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        app_metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      if (error) {
        logger.error("Sign up failed:", error.message);
        process.exit(1);
      }

      logger.info("\n=== User Created ===");
      logger.info(JSON.stringify(data.user, null, 2));
      logger.info("\nNow sign in to get JWT:");
      logger.info(`npx tsx scripts/jwt.ts signin ${email} ${password}`);
      break;
    }

    case "decode": {
      const token = args[1];
      if (!token) {
        logger.error("Usage: npx tsx scripts/jwt.ts decode <jwt_token>");
        process.exit(1);
      }

      const parts = token.split(".");
      if (parts.length !== 3) {
        logger.error("Invalid JWT format");
        process.exit(1);
      }

      try {
        const header = JSON.parse(
          Buffer.from(parts[0], "base64url").toString("utf-8"),
        );
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8"),
        );

        logger.info("\n=== JWT Header ===");
        logger.info(JSON.stringify(header, null, 2));
        logger.info("\n=== JWT Payload ===");
        logger.info(JSON.stringify(payload, null, 2));
      } catch {
        logger.error("Failed to decode JWT");
        process.exit(1);
      }
      break;
    }

    default:
      logger.info(`
Supabase JWT Helper Script
...
      `);

  }
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
