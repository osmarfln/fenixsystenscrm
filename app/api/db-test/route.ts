import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await import("cloudflare:workers");

    if (!env.DB) {
      return NextResponse.json(
        {
          ok: false,
          provider: "ChatGPT Sites D1",
          error: "Binding D1 DB não está disponível nesta publicação.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all<{ name: string }>();

    return NextResponse.json(
      {
        ok: true,
        provider: "ChatGPT Sites D1",
        database: "connected",
        tables: result.results.map((row) => row.name),
        tableCount: result.results.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[db-test] Falha ao acessar D1", error);
    return NextResponse.json(
      {
        ok: false,
        provider: "ChatGPT Sites D1",
        error: "Falha ao acessar o banco D1.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
