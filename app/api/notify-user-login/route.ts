import { NextRequest, NextResponse } from "next/server";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  status: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character);
}

function tokenSessionId(token: string) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(payload)).session_id || "session").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  } catch {
    return "session";
  }
}

async function sendEmail(apiKey: string, to: string, from: string, subject: string, html: string, idempotencyKey: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Resend respondeu com status ${response.status}`);
}

export async function POST(request: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Fenix Systens CRM <onboarding@resend.dev>";
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!resendKey || !adminEmail || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Notificações por e-mail ainda não configuradas." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!authResponse.ok) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const authUser = await authResponse.json() as { id: string; email?: string };

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,full_name,email,role,status`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const profiles = profileResponse.ok ? await profileResponse.json() as Profile[] : [];
  const profile = profiles[0];
  const name = escapeHtml(profile?.full_name || authUser.email || "Usuário");
  const email = escapeHtml(profile?.email || authUser.email || "E-mail não informado");
  const status = String(profile?.status || "pending").trim().toLowerCase();
  const pending = ["pending", "pendente", "aguardando"].includes(status);
  const connectedAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full", timeStyle: "medium", timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const sessionId = tokenSessionId(accessToken);
  const baseStyle = "font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17213a";

  await sendEmail(
    resendKey,
    adminEmail,
    fromEmail,
    `Novo usuário online — ${profile?.full_name || authUser.email || "Fenix CRM"}`,
    `<div style="${baseStyle}"><h2 style="color:#6554e8">Novo usuário online</h2><p>Um usuário acabou de entrar no Fenix Systens CRM.</p><p><strong>Nome:</strong> ${name}<br><strong>E-mail:</strong> ${email}<br><strong>Data e hora:</strong> ${escapeHtml(connectedAt)}</p></div>`,
    `fenix-online-${authUser.id}-${sessionId}`,
  );

  if (pending) {
    await sendEmail(
      resendKey,
      adminEmail,
      fromEmail,
      `Autorização pendente — ${profile?.full_name || authUser.email || "Novo usuário"}`,
      `<div style="${baseStyle}"><h2 style="color:#e58a17">Usuário aguardando autorização</h2><p>Existe um usuário pendente de liberação no Fenix Systens CRM.</p><p><strong>Nome:</strong> ${name}<br><strong>E-mail:</strong> ${email}<br><strong>Status:</strong> Pendente</p><p>Acesse <strong>Gestão de Usuários</strong> para autorizar ou bloquear o acesso.</p></div>`,
      `fenix-pending-${authUser.id}-${sessionId}`,
    );
  }

  return NextResponse.json({ sent: true, pending });
}
