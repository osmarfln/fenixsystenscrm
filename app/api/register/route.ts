import { NextRequest, NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Cadastro indisponível." }, { status: 503 });

  const body = await request.json() as { name?: string; email?: string; phone?: string; password?: string };
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  if (!name || !email || phone.replace(/\D/g, "").length < 10 || password.length < 6) {
    return NextResponse.json({ error: "Preencha nome, e-mail, telefone com DDD e senha de no mínimo 6 caracteres." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const signupResponse = await fetch(`${supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(origin)}`, {
    method: "POST",
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { full_name: name, phone } }),
  });
  const signupData = await signupResponse.json() as { access_token?: string; refresh_token?: string; user?: { id?: string }; msg?: string; message?: string; error_description?: string };
  if (!signupResponse.ok) {
    return NextResponse.json({ error: signupData.msg || signupData.message || signupData.error_description || "Não foi possível concluir o cadastro." }, { status: signupResponse.status });
  }

  const userId = signupData.user?.id;
  let profileCreated = false;
  if (userId) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bearer = serviceKey || signupData.access_token || supabaseKey;
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: serviceKey || supabaseKey,
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ id: userId, full_name: name, email, phone, role: "user", status: "pending" }),
    });
    profileCreated = profileResponse.ok;
    if (profileCreated) {
      await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
        method: "POST",
        headers: { apikey: serviceKey || supabaseKey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "pending_user", module: "Gestão de Usuários", description: `Novo usuário pendente: ${name} (${email})` }),
      });
    }
  }

  let adminNotificationSent = false;
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (resendKey && adminEmail) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Fenix Systens CRM <noreply@fenixcrm.online>",
        to: [adminEmail],
        subject: `Novo cadastro pendente — ${name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17213a"><h2 style="color:#6554e8">Novo usuário aguardando autorização</h2><p>Um novo cadastro foi concluído no Fenix Systens CRM.</p><p><strong>Nome:</strong> ${escapeHtml(name)}<br><strong>E-mail:</strong> ${escapeHtml(email)}<br><strong>Telefone:</strong> ${escapeHtml(phone)}<br><strong>Status:</strong> Pendente</p><p>Acesse Gestão de Usuários para visualizar e permitir o acesso.</p></div>`,
      }),
    });
    adminNotificationSent = response.ok;
  }

  return NextResponse.json({
    registered: true,
    requiresEmailConfirmation: !signupData.access_token,
    adminNotificationSent,
    profileCreated,
    accessToken: signupData.access_token || null,
    refreshToken: signupData.refresh_token || null,
  });
}
