import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

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
