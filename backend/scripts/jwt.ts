import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDevVars(): Record<string, string> {
  const envPath = path.join(__dirname, "..", ".dev.vars");
  const env: Record<string, string> = {};

  if (!fs.existsSync(envPath)) {
    console.error(`Error: .dev.vars not found at ${envPath}`);
    console.error("Please ensure .dev.vars exists in backend/ directory");
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
    console.error("Error: SUPABASE_URL not found in .dev.vars");
    process.exit(1);
  }

  switch (command) {
    case "signin": {
      const email = args[1];
      const password = args[2];

      if (!email || !password) {
        console.error(
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
        console.error("Sign in failed:", error.message);
        process.exit(1);
      }

      const accessToken = data.session?.access_token;
      const refreshToken = data.session?.refresh_token;
      const user = data.user;

      console.log("\n=== Supabase JWT ===");
      console.log("\nAccess Token:");
      console.log(accessToken);
      console.log("\nRefresh Token:");
      console.log(refreshToken);
      console.log("\nUser:");
      console.log(JSON.stringify(user, null, 2));
      console.log("\n=== Test the API ===");
      console.log(
        `curl -H "Authorization: Bearer ${accessToken}" http://localhost:8787/bookings`,
      );
      break;
    }

    case "signup": {
      const email = args[1];
      const password = args[2];

      if (!email || !password) {
        console.error(
          "Usage: npx tsx scripts/jwt.ts signup <email> <password>",
        );
        process.exit(1);
      }

      if (!SUPABASE_SECRET_KEY) {
        console.error("Error: SUPABASE_SECRET_KEY not found in .dev.vars");
        process.exit(1);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) {
        console.error("Sign up failed:", error.message);
        process.exit(1);
      }

      console.log("\n=== User Created ===");
      console.log(JSON.stringify(data.user, null, 2));
      console.log("\nNow sign in to get JWT:");
      console.log(`npx tsx scripts/jwt.ts signin ${email} ${password}`);
      break;
    }

    case "decode": {
      const token = args[1];
      if (!token) {
        console.error("Usage: npx tsx scripts/jwt.ts decode <jwt_token>");
        process.exit(1);
      }

      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("Invalid JWT format");
        process.exit(1);
      }

      try {
        const header = JSON.parse(
          Buffer.from(parts[0], "base64url").toString("utf-8"),
        );
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8"),
        );

        console.log("\n=== JWT Header ===");
        console.log(JSON.stringify(header, null, 2));
        console.log("\n=== JWT Payload ===");
        console.log(JSON.stringify(payload, null, 2));
      } catch {
        console.error("Failed to decode JWT");
        process.exit(1);
      }
      break;
    }

    default:
      console.log(`
Supabase JWT Helper Script

Usage:
  npx tsx scripts/jwt.ts <command> [args]

Commands:
  signin <email> <password>   Sign in and get access token
  signup <email> <password>   Create a new user (admin)
  decode <jwt_token>          Decode and display JWT contents
  help                         Show this help message

Examples:
  npx tsx scripts/jwt.ts signin test@example.com MyPass123!
  npx tsx scripts/jwt.ts decode eyJhbGciOiJFUzI1NiIs...

Note: Reads SUPABASE_URL and SUPABASE_SECRET_KEY from backend/.dev.vars
      `);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
