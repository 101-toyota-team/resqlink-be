import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { Logger } from "../src/utils/logger";

const scriptLogger = new Logger();
// Simple env loader for .dev.vars
const loadEnv = () => {
  try {
    const devVarsPath = join(process.cwd(), ".dev.vars.staging");
    const content = readFileSync(devVarsPath, "utf-8");
    content.split("\n").forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length > 0) {
        process.env[key] = rest.join("=").trim();
      }
    });
  } catch (e) {
    scriptLogger.info("No .dev.vars found or error reading it, using system env.");
  }
};

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  scriptLogger.error("SUPABASE_URL or SUPABASE_SECRET_KEY is missing");
  process.exit(1);
}

scriptLogger.info("Supabase client initialized");

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seed() {
  scriptLogger.info("Starting seed process...");

  // 1. Create Providers
  scriptLogger.info("Creating providers...");
  const providersData = [
    {
      name: "Rumah Sakit Sehat",
      provider_type: "rumah_sakit",
      address: "Jl. Kesehatan No. 1",
      city: "Jakarta",
      latitude: -6.2,
      longitude: 106.8,
      phone: "021-1111",
      h3_index: "872d424b6ffffff", // Dummy H3 (Resolution 7)
    },
    {
      name: "Klinik Cepat",
      provider_type: "klinik",
      address: "Jl. Kilat No. 2",
      city: "Jakarta",
      latitude: -6.21,
      longitude: 106.81,
      phone: "021-2222",
      h3_index: "872d424b5ffffff", // Dummy H3 (Resolution 7)
    },
  ];

  const providerIds: string[] = [];
  for (const p of providersData) {
    // Check if provider exists by name
    const { data: existingProvider } = await supabase
      .from("providers")
      .select("id")
      .eq("name", p.name)
      .maybeSingle();

    if (existingProvider) {
      scriptLogger.info(`Provider ${p.name} already exists with ID: ${existingProvider.id}`);
      providerIds.push(existingProvider.id);
      continue;
    }

    const { data, error } = await supabase
      .from("providers")
      .insert(p)
      .select("id")
      .single();

    if (error) {
      scriptLogger.error(`Error creating provider ${p.name}:`, error.message);
      continue;
    }
    providerIds.push(data.id);
    scriptLogger.info(`Provider ${p.name} created with ID: ${data.id}`);
  }

  if (providerIds.length < 2) {
    scriptLogger.error("Failed to create all providers. Aborting.");
    return;
  }

  const [p1Id, p2Id] = providerIds;

  // 2. Define Accounts
  const accounts = [
    { email: "admin1@test.com", password: "password123", role: "admin" },
    {
      email: "provider1@test.com",
      password: "password123",
      role: "provider",
      provider_id: p1Id,
    },
    {
      email: "provider2@test.com",
      password: "password123",
      role: "provider",
      provider_id: p2Id,
    },
    {
      email: "driver1@test.com",
      password: "password123",
      role: "driver",
      provider_id: p1Id,
      name: "Driver Satu",
      phone: "08111111111",
      license: "LIC001",
    },
    {
      email: "driver2@test.com",
      password: "password123",
      role: "driver",
      provider_id: p2Id,
      name: "Driver Dua",
      phone: "08222222222",
      license: "LIC002",
    },
    { email: "user1@test.com", password: "password123", role: "user" },
    { email: "user2@test.com", password: "password123", role: "user" },
  ];

  scriptLogger.info("Creating auth users...");
  for (const acct of accounts) {
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const found = existingUsers.users.find((u) => u.email === acct.email);

    let userId: string;

    if (found) {
      scriptLogger.info(`User ${acct.email} already exists. Updating metadata...`);
      const { data, error } = await supabase.auth.admin.updateUserById(
        found.id,
        {
          user_metadata: {
            role: acct.role,
            ...(acct.provider_id && { provider_id: acct.provider_id }),
          },
          app_metadata: {
            role: acct.role,
            ...(acct.provider_id && { provider_id: acct.provider_id }),
          },
        },
      );
      if (error) {
        scriptLogger.error(`Error updating user ${acct.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: acct.email,
        password: acct.password,
        email_confirm: true,
        user_metadata: {
          role: acct.role,
          ...(acct.provider_id && { provider_id: acct.provider_id }),
        },
        app_metadata: {
          role: acct.role,
          ...(acct.provider_id && { provider_id: acct.provider_id }),
        },
      });

      if (error) {
        scriptLogger.error(`Error creating user ${acct.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      scriptLogger.info(`User ${acct.email} created with ID: ${userId}`);
    }

    // 3. Create driver record if role is driver
    if (acct.role === "driver") {
      scriptLogger.info(`Creating driver record for ${acct.email}...`);
      const { error: driverError } = await supabase.from("drivers").upsert({
        id: userId,
        provider_id: acct.provider_id,
        name: acct.name,
        phone: acct.phone,
        license_number: acct.license,
        is_available: true,
        is_active: true,
      });

      if (driverError) {
        scriptLogger.error(
          `Error creating driver record for ${acct.email}:`,
          driverError.message,
        );
      } else {
        scriptLogger.info(`Driver record for ${acct.email} created/updated.`);
      }
    }
  }

  scriptLogger.info("Seed process completed.");
}

seed().catch((err) => scriptLogger.error(err));
