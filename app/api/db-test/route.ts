import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

function classifyDatabaseError(error: unknown) {
  const candidate = error as { code?: unknown; name?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : null;
  const name = typeof candidate?.name === "string" ? candidate.name : "Error";
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";

  let category = "unknown";
  if (code === "ETIMEDOUT" || message.includes("timeout") || message.includes("timed out")) category = "timeout";
  else if (code === "ENOTFOUND" || message.includes("getaddrinfo") || message.includes("dns")) category = "dns";
  else if (code === "ECONNREFUSED" || message.includes("connection refused")) category = "connection_refused";
  else if (code === "28P01" || message.includes("password authentication") || message.includes("authentication failed")) category = "authentication";
  else if (message.includes("pg_hba") || message.includes("allowlist") || message.includes("not allowed")) category = "network_acl";
  else if (message.includes("certificate") || message.includes("ssl") || message.includes("tls") || message.includes("self signed")) category = "tls";
  else if (message.includes("socket") || message.includes("tcp") || message.includes("connect")) category = "socket_runtime";

  return { category, code, name };
}

export async function GET() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL não está configurada no ambiente do Site.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
  });

  try {
    const [result] = await sql<
      Array<{
        server_time: string;
        database_name: string;
      }>
    >`
      SELECT
        NOW()::text AS server_time,
        current_database() AS database_name
    `;

    return NextResponse.json(
      {
        ok: true,
        provider: "Aiven PostgreSQL",
        database: result.database_name,
        serverTime: result.server_time,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[db-test] Falha ao conectar ao Aiven PostgreSQL", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao conectar ao Aiven PostgreSQL.",
        diagnostic: classifyDatabaseError(error),
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}
