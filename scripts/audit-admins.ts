/**
 * Star Press — Admin Audit & Demotion Script
 *
 * Scans the database for all users with role 'ADMIN', compares against the
 * ADMIN_EMAILS whitelist, and demotes unauthorized admins to 'CUSTOMER'.
 *
 * Usage:
 *   Dry-run (default, list-only, read-only):
 *     npx tsx scripts/audit-admins.ts
 *
 *   Execute Demotion:
 *     npx tsx scripts/audit-admins.ts --demote
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function fetchSupabaseAdmin(path: string, method: string = "GET", body?: any) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase URL or Service Key");
  const url = `${SUPABASE_URL}/auth/v1/${path}`;
  const options: RequestInit = {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const shouldDemote = args.includes("--demote");
  const isDryRun = !shouldDemote;

  console.log("===============================================================");
  console.log("🛡️  STAR PRESS — ADMIN ROLE AUDIT SCRIPT");
  console.log(`MODE: ${isDryRun ? "🔍 DRY-RUN (Read-only, no database writes)" : "⚡ LIVE DEMOTION (--demote flag enabled)"}`);
  console.log("===============================================================\n");

  const adminEnv = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  const whitelistedEmails = adminEnv
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  console.log("📋 Configured ADMIN_EMAILS Whitelist:");
  if (whitelistedEmails.length === 0) {
    console.log("  ⚠️  WARNING: No ADMIN_EMAILS configured in environment variables!");
  } else {
    whitelistedEmails.forEach((email, i) => console.log(`  ${i + 1}. ${email}`));
  }
  console.log("");

  const adminUsers = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`🔎 Total Database Users with role 'ADMIN': ${adminUsers.length}\n`);

  if (adminUsers.length === 0) {
    console.log("✅ No users found with role ADMIN in the database.");
    return;
  }

  const authorizedAdmins: typeof adminUsers = [];
  const unauthorizedAdmins: typeof adminUsers = [];

  for (const user of adminUsers) {
    const normalizedEmail = (user.email || "").toLowerCase().trim();
    if (whitelistedEmails.includes(normalizedEmail)) authorizedAdmins.push(user);
    else unauthorizedAdmins.push(user);
  }

  console.log("---------------------------------------------------------------");
  console.log("USER DETAILS (Database & Supabase App Metadata):");
  console.log("---------------------------------------------------------------");

  const supabaseUsersToDemote: { id: string; email: string }[] = [];

  for (const user of adminUsers) {
    const normalizedEmail = (user.email || "").toLowerCase().trim();
    const isWhitelisted = whitelistedEmails.includes(normalizedEmail);
    const statusTag = isWhitelisted ? "✅ AUTHORIZED (Whitelisted)" : "❌ UNAUTHORIZED (Candidate for Demotion)";
    const createdStr = user.createdAt.toISOString().replace("T", " ").substring(0, 19);

    console.log(`• ID:        ${user.id}`);
    console.log(`  Email:     ${user.email}`);
    console.log(`  Name:      ${user.name}`);
    console.log(`  Created:   ${createdStr}`);
    console.log(`  Status:    ${statusTag}`);

    // Fetch Supabase app_metadata
    try {
      const supaUser = await fetchSupabaseAdmin(`admin/users/${user.id}`);
      if (supaUser) {
        const appRole = supaUser.app_metadata?.role;
        console.log(`  Supabase:  app_metadata.role = ${appRole || "undefined"}`);
        if (!isWhitelisted && appRole === "ADMIN") {
          console.log(`  ⚠️ Warning: User has app_metadata.role='ADMIN' in Supabase! They will retain access unless this is cleared.`);
          supabaseUsersToDemote.push({ id: user.id, email: user.email });
        }
      }
    } catch (e: any) {
      console.log(`  Supabase:  Failed to fetch (${e.message})`);
    }

    console.log("---------------------------------------------------------------");
  }

  let demotedCount = 0;

  if (shouldDemote) {
    if (unauthorizedAdmins.length === 0 && supabaseUsersToDemote.length === 0) {
      console.log("\n✅ All existing admin accounts are legitimately whitelisted. Nothing to demote.");
    } else {
      console.log(`\n⏳ Demoting ${unauthorizedAdmins.length} unauthorized admin(s) in Database...`);
      for (const user of unauthorizedAdmins) {
        await prisma.user.update({ where: { id: user.id }, data: { role: Role.CUSTOMER } });
        console.log(`  ⬇️ Demoted DB: ${user.email} (${user.id}) -> Role: CUSTOMER`);
        demotedCount++;
      }

      console.log(`\n⏳ Clearing app_metadata.role for ${supabaseUsersToDemote.length} user(s) in Supabase...`);
      for (const supa of supabaseUsersToDemote) {
        await fetchSupabaseAdmin(`admin/users/${supa.id}`, "PUT", { app_metadata: { role: null } });
        console.log(`  ⬇️ Cleared Supabase app_metadata.role: ${supa.email} (${supa.id})`);
      }

      console.log("\n✅ Demotions completed successfully.");
    }
  } else {
    console.log("\n💡 DRY-RUN COMPLETE: No changes were committed to DB or Supabase.");
    if (unauthorizedAdmins.length > 0 || supabaseUsersToDemote.length > 0) {
      console.log(`   To execute demotions, re-run with: npx tsx scripts/audit-admins.ts --demote`);
    }
  }

  console.log("\n===============================================================");
  console.log("📊 AUDIT SUMMARY");
  console.log("===============================================================");
  console.log(`Total ADMIN users evaluated:       ${adminUsers.length}`);
  console.log(`Whitelisted ADMINs (retained):     ${authorizedAdmins.length}`);
  console.log(`Unauthorized ADMINs (DB):          ${unauthorizedAdmins.length}`);
  console.log(`Unauthorized ADMINs (Supabase):    ${supabaseUsersToDemote.length}`);
  console.log(`Action taken:                      ${shouldDemote ? "Demotions Executed" : "Dry-run only"}`);
  console.log("===============================================================\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Fatal error running audit-admins script:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
