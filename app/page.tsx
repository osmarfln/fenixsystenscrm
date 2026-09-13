"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  Eye,
  Pencil,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";

type Module =
  | "Dashboard"
  | "Estoque"
  | "Financeiro"
  | "Clientes"
  | "Fornecedores"
  | "Produtos"
  | "Gestão de Usuários"
  | "Relatórios"
  | "Configurações";
type Notification = {
  id: string;
  action: string;
  module: string;
  description: string;
  created_at: string;
};
type UserProfile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  status: string;
  created_at?: string | null;
  last_seen_at?: string | null;
  phone?: string | null;
};
const menu: {
  label: Module;
  icon: typeof LayoutDashboard;
  section?: string;
}[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Estoque", icon: Boxes },
  { label: "Financeiro", icon: CircleDollarSign },
  { label: "Clientes", icon: Users, section: "Cadastro" },
  { label: "Fornecedores", icon: Building2 },
  { label: "Produtos", icon: Package },
  { label: "Relatórios", icon: FileBarChart },
  { label: "Gestão de Usuários", icon: UserRound, section: "Gestão" },
  { label: "Configurações", icon: Settings2 },
];
const adminModules = new Set<Module>(["Gestão de Usuários", "Configurações"]);
function supabaseConfig(url?: string, key?: string) {
  return url && key ? createClient(url, key) : null;
}

export default function Home() {
  const [active, setActive] = useState<Module>("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [clock, setClock] = useState(new Date());
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [configured, setConfigured] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    let listener: { subscription: { unsubscribe: () => void } } | undefined;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((config) => {
        const sb = supabaseConfig(config.url, config.key);
        setConfigured(Boolean(sb));
        setClient(sb);
        if (!sb) {
          setLoading(false);
          return;
        }
        const loadAuthenticatedUser = async (session: Awaited<ReturnType<typeof sb.auth.getSession>>["data"]["session"]) => {
          const authUser = session?.user ?? null;
          setEmail(authUser?.email ?? null);
          setDisplayName(authUser?.user_metadata?.full_name ?? null);
          setProfile(null);
          if (!authUser) {
            setLoading(false);
            return;
          }
          setLoading(true);
          const { data: currentUser, error: userError } = await sb.auth.getUser();
          if (userError || !currentUser.user) {
            console.error("Não foi possível validar a sessão:", userError);
            setLoading(false);
            return;
          }
          const notifyAdmin = (userProfile: UserProfile) => {
            if (!session?.access_token) return;
            const notificationKey = `fenix-login-notified:${session.user.id}:${session.access_token.slice(-16)}`;
            if (window.sessionStorage.getItem(notificationKey)) return;
            window.sessionStorage.setItem(notificationKey, "sending");
            void fetch("/api/notify-user-login", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ status: userProfile.status }),
            }).then((response) => {
              if (!response.ok) window.sessionStorage.removeItem(notificationKey);
              else window.sessionStorage.setItem(notificationKey, "sent");
            }).catch(() => window.sessionStorage.removeItem(notificationKey));
          };
          const { data: profileData, error } = await sb
            .from("profiles")
            .select("id, full_name, email, role, status")
            .eq("id", currentUser.user.id)
            .maybeSingle();
          if (error) {
            console.error("Falha ao carregar perfil do usuário:", error);
            console.error("Detalhes do erro de perfil:", error.message);
            notifyAdmin({
              id: currentUser.user.id,
              full_name: currentUser.user.user_metadata?.full_name ?? null,
              email: currentUser.user.email ?? "",
              role: "user",
              status: "pending",
            });
          } else if (!profileData) {
            console.warn("Login autenticado sem perfil vinculado ao UUID.");
            const newProfile: UserProfile = {
              id: currentUser.user.id,
              full_name: currentUser.user.user_metadata?.full_name ?? null,
              email: currentUser.user.email ?? "",
              role: "user",
              status: "pending",
              last_seen_at: new Date().toISOString(),
            };
            const { error: createProfileError } = await sb.from("profiles").insert(newProfile);
            notifyAdmin(newProfile);
            if (createProfileError) {
              console.error("Não foi possível criar o perfil do usuário autenticado:", createProfileError);
            } else {
              setProfile(newProfile);
              setEmail(newProfile.email);
              setDisplayName(newProfile.full_name);
            }
          } else {
            const normalized = {
              ...(profileData as UserProfile),
              role: String(profileData.role || "").trim().toLowerCase(),
              status: String(profileData.status || "").trim().toLowerCase(),
            };
            setProfile(normalized);
            setEmail(normalized.email || currentUser.user.email || null);
            setDisplayName(normalized.full_name || currentUser.user.user_metadata?.full_name || null);
            notifyAdmin(normalized);
          }
          setLoading(false);
        };
        void sb.auth.getSession().then(({ data }) => loadAuthenticatedUser(data.session));
        listener = sb.auth.onAuthStateChange((_event, session) => {
          window.setTimeout(() => void loadAuthenticatedUser(session), 0);
        });
      })
      .catch(() => setLoading(false));
    return () => {
      window.clearInterval(timer);
      listener?.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!client) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (code)
      client.auth.exchangeCodeForSession(code).then(({ data }) => {
        if (data.session?.user.email) {
          setEmail(data.session.user.email);
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      });
  }, [client]);
  useEffect(() => {
    if (!client || !email) return;
    let mounted = true;
    const load = async () => {
      const [{ data: logs }, { data: pendingProfiles }] = await Promise.all([
        client.from("audit_logs").select("id, action, module, description, created_at").order("created_at", { ascending: false }).limit(8),
        client.from("profiles").select("id, full_name, email, created_at, status").in("status", ["pending", "pendente", "aguardando"]).order("created_at", { ascending: false }).limit(20),
      ]);
      const pendingNotices = (pendingProfiles ?? []).map((user) => ({ id: `pending-${user.id}`, action: "Autorização pendente", module: "Gestão de Usuários", description: `${user.full_name || user.email || "Novo usuário"} aguarda liberação`, created_at: user.created_at || new Date().toISOString() }));
      if (mounted) setNotifications([...pendingNotices, ...((logs ?? []) as Notification[])].slice(0, 20));
    };
    void load();
    const channel = client
      .channel("crm-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        () => void load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      void client.removeChannel(channel);
    };
  }, [client, email]);
  useEffect(() => {
    if (!client || !profile?.id) return;
    const updatePresence = () => {
      void client.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id);
    };
    updatePresence();
    const presenceTimer = window.setInterval(updatePresence, 45_000);
    const onVisibility = () => { if (document.visibilityState === "visible") updatePresence(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(presenceTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [client, profile?.id]);
  const greeting = useMemo(() => {
    const hour = clock.getHours();
    return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  }, [clock]);
  const firstName = (displayName || email?.split("@")[0] || "Visitante")
    .trim()
    .split(/\s+/)[0];
  const date = clock.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const time = clock.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  async function logout() {
    await client?.auth.signOut();
  }
  const isAdmin = profile?.role === "admin" || profile?.role === "administrador";
  const visibleMenu = menu.filter((item) => isAdmin || !adminModules.has(item.label));
  useEffect(() => {
    if (!isAdmin && adminModules.has(active)) {
      setActive("Dashboard");
      setMobileMenu(false);
    }
  }, [active, isAdmin]);
  // A autenticação do Supabase libera o acesso. O perfil complementa nome e
  // permissão; ele só impede a entrada quando o administrador o bloqueou de
  // forma explícita. Assim, contas novas, antigas, por senha ou Google entram.
  const deniedStatuses = new Set([
    "blocked",
    "bloqueado",
    "disabled",
    "desativado",
  ]);
  const isBlocked = Boolean(!isAdmin && profile && deniedStatuses.has(profile.status));
  if (configured && loading)
    return <AccessStatus title="Carregando usuário..." message="Validando sua sessão e suas permissões no Supabase." />;
  if (configured && !loading && !email)
    return <AuthScreenFields client={client} />;
  if (configured && email && isBlocked)
    return <AccessStatus title="Acesso bloqueado" message="Este usuário foi bloqueado pelo administrador." onLogout={logout} />;
  return (
    <main className="crm-shell">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <strong>FENIX</strong>
            <span>SYSTENS CRM</span>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileMenu(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <div className="workspace-icon">
            <BriefcaseBusiness size={16} />
          </div>
          <div>
            <small>ESPAÇO DE TRABALHO</small>
            <b>Operação principal</b>
            <span className="workspace-online">
              <i /> Online
            </span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {visibleMenu.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label}>
                {item.section && (
                  <div className="nav-section">{item.section}</div>
                )}
                {!item.section && index === 0 && (
                  <div className="nav-section">Visão geral</div>
                )}
                <button
                  className={`nav-item ${active === item.label ? "active" : ""}`}
                  onClick={() => {
                    setActive(item.label);
                    setMobileMenu(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.label === "Configurações" && (
                    <ShieldCheck size={14} className="admin-icon" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure">
            <ShieldCheck size={16} />
            <span>Dados protegidos por RLS</span>
          </div>
          <div className="version">
            Fenix Systens CRM <b>v10</b>
          </div>
        </div>
      </aside>
      {mobileMenu && (
        <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />
      )}
      <section className="main-area">
        <header className="topbar">
          <button
            className="icon-btn menu-trigger"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={21} />
          </button>
          <div className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                active === "Clientes" || active === "Fornecedores"
                  ? "Pesquisar por nome, empresa, CPF ou CNPJ..."
                  : "Pesquisar no CRM..."
              }
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <div className="notification-wrap">
              <button
                className="icon-btn notification"
                aria-label="Notificações"
                onClick={() => setNotificationOpen((value) => !value)}
              >
                <Bell size={19} />
                {notifications.length > 0 && (
                  <span className="notification-count">
                    {notifications.length}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <NotificationsPanel notifications={notifications} />
              )}
            </div>
            <div className="divider" />
            <div className="user-chip">
              <div className="avatar">
                {email ? email.slice(0, 1).toUpperCase() : "?"}
              </div>
              <div className="user-copy">
                <b>{firstName}</b>
                <span>{email || "Sem e-mail"}</span>
                <small>{isAdmin ? "Administrador" : "Usuário"}</small>
                <em>
                  <span className="connected-dot" /> Conectado
                </em>
              </div>
              <ChevronDown size={15} />
            </div>
            <button className="logout" onClick={logout}>
              <LogOut size={16} /> Sair
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <Sparkles size={14} /> CENTRAL DE OPERAÇÕES
              </div>
              <h1>
                {active === "Dashboard" ? `${greeting}, ${firstName}.` : active}
              </h1>
              <p>
                {active === "Dashboard"
                  ? "Acompanhe a operação da sua empresa em um só lugar."
                  : `Gerencie ${active.toLowerCase()} com dados reais e rastreáveis.`}
              </p>
            </div>
            <div className="heading-meta">
              <div className="date">
                <CalendarDays size={16} />
                <span>{date}</span>
              </div>
              <div className="clock">
                <span className="live-dot" /> {time}
              </div>
            </div>
          </div>
          {active === "Dashboard" ? (
            <Dashboard
              client={client}
              configured={configured}
              loading={loading}
              query={query}
            />
          ) : (
            <ModuleView
              client={client}
              active={active}
              configured={configured}
              query={query}
              isAdmin={isAdmin}
            />
          )}
        </div>
        <SiteFooter />
      </section>
    </main>
  );
}

function NotificationsPanel({
  notifications,
}: {
  notifications: Notification[];
}) {
  return (
    <div className="notifications-panel">
      <div className="notifications-head">
        <b>Notificações</b>
        <span>{notifications.length} recentes</span>
      </div>
      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <Bell size={18} />
          <span>Nenhuma notificação registrada.</span>
        </div>
      ) : (
        notifications.map((item) => (
          <div className="notification-item" key={item.id}>
            <span className="notification-dot" />
            <div>
              <b>{item.module || "Plataforma"}</b>
              <p>{item.description || item.action}</p>
              <small>{new Date(item.created_at).toLocaleString("pt-BR")}</small>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
function AuthScreen({ client }: { client: SupabaseClient | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setBusy(true);
    setError("");
    const { error: authError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) setError(authError.message);
    setBusy(false);
  }
  async function google() {
    await client?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <strong>FENIX</strong>
            <span>SYSTENS CRM</span>
          </div>
        </div>
        <div className="eyebrow">
          <ShieldCheck size={14} /> ACESSO SEGURO
        </div>
        <h1>Entre no seu CRM.</h1>
        <p className="auth-sub">Acesse seu painel administrativo.</p>
        <form onSubmit={login}>
          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary-btn auth-submit" disabled={busy}>
            {busy ? "Entrando..." : "Entrar no CRM"}
          </button>
        </form>
        <button className="google-btn" onClick={google}>
          Continuar com Google
        </button>
        <a className="forgot" href="#recuperar">
          Esqueci minha senha
        </a>
      </div>
    </main>
  );
}
function AuthScreenModern({ client }: { client: SupabaseClient | null }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setBusy(true);
    setError("");
    const result =
      mode === "login"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === "signup")
      setError(
        "Cadastro enviado. Verifique seu e-mail para confirmar o acesso.",
      );
    setBusy(false);
  }
  async function google() {
    await client?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }
  return (
    <main className="auth-shell modern-auth">
      <div className="auth-visual">
        <img src="/fenix-logo.png" alt="" className="watermark-logo" />
        <div className="visual-copy">
          <div className="brand">
            <div className="brand-mark">
              <Zap size={18} fill="currentColor" />
            </div>
            <div>
              <strong>FENIX</strong>
              <span>SYSTENS CRM</span>
            </div>
          </div>
          <div className="eyebrow light">
            <Sparkles size={14} /> GESTÃO INTELIGENTE
          </div>
          <h1>
            Controle sua operação
            <br />
            com clareza.
          </h1>
          <p>
            Clientes, oportunidades, atividades e segurança em um único painel
            administrativo.
          </p>
          <div className="visual-pills">
            <span>Dados reais</span>
            <span>Segurança RLS</span>
            <span>Visão completa</span>
          </div>
        </div>
      </div>
      <div className="auth-card modern-card">
        <div className="auth-mobile-brand">
          <div className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </div>
          <b>FENIX SYSTENS CRM</b>
        </div>
        <div className="auth-tabs">
          <button
            className={mode === "login" ? "selected" : ""}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            className={mode === "signup" ? "selected" : ""}
            onClick={() => setMode("signup")}
          >
            Criar acesso
          </button>
        </div>
        <h2>{mode === "login" ? "Bem-vindos" : "Crie seu acesso"}</h2>
        <p className="auth-sub">
          {mode === "login"
            ? "Acesse seu painel administrativo."
            : "Seu acesso será liberado conforme as permissões do administrador."}
        </p>
        <form onSubmit={submit}>
          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary-btn auth-submit" disabled={busy}>
            {busy
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar no CRM"
                : "Solicitar acesso"}
          </button>
        </form>
        <button className="google-btn" onClick={google}>
          Continuar com Google
        </button>
        {mode === "login" && (
          <a className="forgot" href="#recuperar">
            Esqueci minha senha
          </a>
        )}
      </div>
    </main>
  );
}
function Dashboard({
  client,
  configured,
  loading,
  query,
}: {
  client: SupabaseClient | null;
  configured: boolean;
  loading: boolean;
  query: string;
}) {
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [finance, setFinance] = useState({ revenue: 0, expenses: 0 });
  const [financeRows, setFinanceRows] = useState<
    { amount: number; type: string; created_at: string }[]
  >([]);
  const [recent, setRecent] = useState<Notification[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; document?: string; kind: string }[]>([]);
  useEffect(() => {
    if (!client) return;
    let mounted = true;
    const load = async () => {
      const [{ count }, { data: entries }, { data: logs }] = await Promise.all([
        client.from("customers").select("id", { count: "exact", head: true }),
        client
          .from("financial_entries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        client
          .from("audit_logs")
          .select("id, action, module, description, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (!mounted) return;
      setClientCount(count ?? 0);
      const rows = (entries ?? []).map((row) => ({ ...row, type: row.type ?? row.entry_type })) as {
        amount: number;
        type: string;
        created_at: string;
      }[];
      setFinanceRows(rows);
      setFinance({
        revenue: rows
          .filter((row) => /receita|income|entrada/i.test(row.type))
          .reduce((sum, row) => sum + Number(row.amount || 0), 0),
        expenses: rows
          .filter((row) => /despesa|expense|sa[ií]da/i.test(row.type))
          .reduce((sum, row) => sum + Number(row.amount || 0), 0),
      });
      setRecent((logs ?? []) as Notification[]);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [client]);
  useEffect(() => {
    if (!client || !query.trim()) { setSearchResults([]); return; }
    let activeSearch = true;
    const term = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    void Promise.all([
      client.from("customers").select("*").limit(100),
      client.from("suppliers").select("*").limit(100),
    ]).then(([customers, suppliers]) => {
      if (!activeSearch) return;
      const combined = [
        ...((customers.data ?? []).map((row) => ({ ...row, kind: "Cliente" }))),
        ...((suppliers.data ?? []).map((row) => ({ ...row, kind: "Fornecedor/empresa" }))),
      ];
      setSearchResults(combined.filter((row) => {
        const name = String(row.name ?? row.company_name ?? row.corporate_name ?? row.trade_name ?? "");
        const document = String(row.document ?? row.cpf ?? row.cnpj ?? "");
        return `${name} ${document}`.toLowerCase().includes(term) || (!!digits && document.replace(/\D/g, "").includes(digits));
      }).slice(0, 20).map((row) => ({ id: String(row.id), name: String(row.name ?? row.company_name ?? row.corporate_name ?? row.trade_name ?? "Sem nome"), document: String(row.document ?? row.cpf ?? row.cnpj ?? ""), kind: String(row.kind) })));
    });
    return () => { activeSearch = false; };
  }, [client, query]);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: date
        .toLocaleDateString("pt-BR", { weekday: "short" })
        .replace(".", ""),
      value: financeRows
        .filter((row) => row.created_at?.slice(0, 10) === key)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  });
  const maxValue = Math.max(...chartDays.map((day) => day.value), 1);
  const stats = [
    {
      label: "Receitas",
      value: finance.revenue
        ? `R$ ${finance.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "R$ 0,00",
      icon: ArrowUpRight,
    },
    {
      label: "Despesas",
      value: finance.expenses
        ? `R$ ${finance.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : "R$ 0,00",
      icon: ArrowDownToLine,
    },
    {
      label: "Saldo em caixa",
      value: `R$ ${(finance.revenue - finance.expenses).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: WalletCards,
    },
    {
      label: "Clientes",
      value:
        clientCount === null || loading
          ? "..."
          : clientCount.toLocaleString("pt-BR"),
      icon: Users,
    },
  ];
  return (
    <>
      {query.trim() && <section className="panel records-panel dashboard-search-results"><div className="records-header"><div><h2>Resultado da pesquisa geral</h2><p>Clientes e fornecedores por nome, empresa, CPF ou CNPJ</p></div><Search size={20}/></div>{searchResults.length ? <div className="finance-rows">{searchResults.map((item) => <div className="finance-row" key={`${item.kind}-${item.id}`}><div><b>{item.name}</b><span>{item.kind} • {item.document || "Documento não informado"}</span></div></div>)}</div> : <EmptyState icon={Search} title="Nenhum cadastro encontrado" text="Confira o nome, CPF ou CNPJ digitado."/>}</section>}
      {!configured && (
        <div className="setup-alert">
          <div className="alert-icon">
            <Zap size={18} />
          </div>
          <div>
            <b>Conexão Supabase pendente</b>
            <p>
              Configure NEXT_PUBLIC_SUPABASE_URL e
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para liberar autenticação e
              dados reais.
            </p>
          </div>
          <span className="status-pill">Aguardando configuração</span>
        </div>
      )}
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon }, i) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon i${i}`}>
              <Icon size={18} />
            </div>
            <div className="stat-label">
              {label}
              <span className="real-tag">REAL</span>
            </div>
            <strong>{value}</strong>
            <small>
              {label === "Clientes"
                ? "Cadastros no Supabase"
                : "Dados do Supabase"}
            </small>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h2>Visão financeira</h2>
              <p>Movimentações reais dos últimos 7 dias</p>
            </div>
            <BarChart3 size={20} />
          </div>
          <div className="finance-chart">
            {chartDays.map((day) => (
              <div className="chart-column" key={day.label}>
                <div
                  className="chart-bar"
                  style={{
                    height: `${Math.max((day.value / maxValue) * 100, day.value ? 10 : 3)}%`,
                  }}
                  title={`R$ ${day.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                />
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          <div className="chart-total">
            <span>
              Receitas{" "}
              <b>
                R${" "}
                {finance.revenue.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </b>
            </span>
            <span>
              Despesas{" "}
              <b>
                R${" "}
                {finance.expenses.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </b>
            </span>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Movimentações recentes</h2>
              <p>Últimas ações registradas na auditoria</p>
            </div>
            <Activity size={20} />
          </div>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((item) => (
                <div className="recent-row" key={item.id}>
                  <span className="notification-dot" />
                  <div>
                    <b>{item.module || "Plataforma"}</b>
                    <p>{item.description || item.action}</p>
                    <small>
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma movimentação"
              text="As operações realizadas aparecerão aqui."
            />
          )}
        </section>
      </div>
      <div className="grid-3">
        <section className="panel compact">
          <div className="panel-head">
            <h2>Estoque baixo</h2>
            <Package size={20} />
          </div>
          <EmptyState
            icon={Boxes}
            title="Estoque em dia"
            text="Nenhum alerta disponível."
          />
        </section>
        <section className="panel compact">
          <div className="panel-head">
            <h2>Contas pendentes</h2>
            <Receipt size={20} />
          </div>
          <EmptyState
            icon={CircleDollarSign}
            title="Nenhuma conta"
            text="Sem lançamentos pendentes."
          />
        </section>
        <section className="panel compact">
          <div className="panel-head">
            <h2>Atividades</h2>
            <CalendarDays size={20} />
          </div>
          <EmptyState
            icon={CalendarDays}
            title="Agenda vazia"
            text="Crie uma atividade para acompanhar."
          />
        </section>
      </div>
    </>
  );
}
function FinanceWorkspace({
  client,
  configured,
}: {
  client: SupabaseClient | null;
  configured: boolean;
}) {
  const [tab, setTab] = useState("Visão geral");
  const [rows, setRows] = useState<
    {
      id: string;
      type?: string;
      amount?: number;
      description?: string;
      category?: string;
      status?: string;
      due_date?: string;
      created_at?: string;
    }[]
  >([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [financeMode, setFinanceMode] = useState<"launch" | "payable" | "receivable">("launch");
  const [editing, setEditing] = useState<(typeof rows)[number] | null>(null);
  const [viewing, setViewing] = useState<(typeof rows)[number] | null>(null);
  const [financeError, setFinanceError] = useState("");
  const [financeQuery, setFinanceQuery] = useState("");
  const [accountNotes, setAccountNotes] = useState({ payable: "", receivable: "" });
  const tabs = [
    "Visão geral",
    "Lançamentos",
    "Contas a pagar",
    "Contas a receber",
    "Fluxo financeiro",
    "Relatórios",
  ];
  async function load() {
    if (!client) return;
    const { data } = await client
      .from("financial_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []).map((row) => ({
      ...row,
      type: row.type ?? row.entry_type,
    })) as typeof rows);
  }
  useEffect(() => {
    void load();
  }, [client]);
  useEffect(() => {
    const saved = window.localStorage.getItem("fenix-account-notes");
    if (saved) try { setAccountNotes(JSON.parse(saved)); } catch {}
  }, []);
  const filtered = rows.filter(
    (row) =>
      (!from || (row.due_date || row.created_at || "").slice(0, 10) >= from) &&
      (!to || (row.due_date || row.created_at || "").slice(0, 10) <= to) &&
      (!financeQuery.trim() || `${row.description ?? ""} ${row.category ?? ""} ${row.status ?? ""} ${row.type ?? ""}`.toLowerCase().includes(financeQuery.trim().toLowerCase())),
  );
  const revenues = filtered.filter((row) =>
    /income|receita|entrada/i.test(row.type || ""),
  );
  const expenses = filtered.filter((row) =>
    /expense|despesa|saída|saida/i.test(row.type || ""),
  );
  const total = (items: typeof rows) =>
    items.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const revenueTotal = total(revenues);
  const expenseTotal = total(expenses);
  const pending = filtered.filter((row) =>
    /pending|previst|pendente/i.test(row.status || ""),
  );
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      label: date
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", ""),
      revenue: total(
        revenues.filter(
          (row) => (row.due_date || row.created_at || "").slice(0, 7) === key,
        ),
      ),
      expense: total(
        expenses.filter(
          (row) => (row.due_date || row.created_at || "").slice(0, 7) === key,
        ),
      ),
    };
  });
  const max = Math.max(
    ...months.flatMap((month) => [month.revenue, month.expense]),
    1,
  );
  function printReport() {
    window.print();
  }
  function setReportPeriod(period: "daily" | "weekly" | "monthly" | "annual") {
    const end = new Date();
    const start = new Date(end);
    if (period === "weekly") start.setDate(end.getDate() - 6);
    if (period === "monthly") start.setDate(1);
    if (period === "annual") start.setMonth(0, 1);
    const localDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setFrom(localDate(start));
    setTo(localDate(end));
  }
  function openFinanceForm(mode: "launch" | "payable" | "receivable", row: (typeof rows)[number] | null = null) {
    setFinanceMode(mode);
    setEditing(row);
    setFormOpen(true);
  }
  async function removeFinance(row: (typeof rows)[number]) {
    if (!client || !window.confirm(`Excluir o lançamento “${row.description || "sem descrição"}”?`)) return;
    const { error } = await client.from("financial_entries").delete().eq("id", row.id);
    if (error) setFinanceError(`Não foi possível excluir: ${error.message}`);
    else { setFinanceError(""); await load(); }
  }
  async function settleFinance(row: (typeof rows)[number], kind: "payable" | "receivable") {
    if (!client) return;
    const nextStatus = kind === "payable" ? "paid" : "received";
    const { error } = await client.from("financial_entries").update({ status: nextStatus }).eq("id", row.id);
    if (error) setFinanceError(`Não foi possível concluir: ${error.message}`);
    else { setFinanceError(""); await load(); }
  }
  function financeActions(row: (typeof rows)[number], mode: "launch" | "payable" | "receivable" = "launch") {
    return <div className="row-actions">
      <button title="Visualizar" aria-label="Visualizar lançamento" onClick={() => setViewing(row)}><Eye size={16}/></button>
      <button title="Editar" aria-label="Editar lançamento" onClick={() => openFinanceForm(mode, row)}><Pencil size={16}/></button>
      <button className="danger" title="Excluir" aria-label="Excluir lançamento" onClick={() => void removeFinance(row)}><Trash2 size={16}/></button>
    </div>;
  }
  function rowsView(items: typeof rows, empty: string, showCategory = true) {
    return items.length ? (
      <div className="finance-rows">
        {items.map((row) => (
          <div className="finance-row" key={row.id}>
            <div>
              <b>{row.description || "Lançamento sem descrição"}</b>
              <span>
                {showCategory && `${row.category || "Sem categoria"} • `}
                {row.status || "Sem status"}
              </span>
            </div>
            <strong
              className={
                /expense|despesa|saída|saida/i.test(row.type || "")
                  ? "negative"
                  : "positive"
              }
            >
              {/expense|despesa|saída|saida/i.test(row.type || "") ? "-" : "+"}{" "}
              R${" "}
              {Number(row.amount || 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </strong>
            <small>
              {row.due_date
                ? new Date(`${row.due_date}T12:00:00`).toLocaleDateString(
                    "pt-BR",
                  )
                : row.created_at
                  ? new Date(row.created_at).toLocaleString("pt-BR")
                  : "—"}
            </small>
            {financeActions(row)}
          </div>
        ))}
      </div>
    ) : (
      <EmptyState
        icon={CircleDollarSign}
        title={empty}
        text="Nenhum lançamento real encontrado neste período."
      />
    );
  }
  function accountWorkspace(items: typeof rows, kind: "payable" | "receivable") {
    const title = kind === "payable" ? "Contas a pagar" : "Contas a receber";
    const itemTotal = total(items);
    const monthTotals = months.map((month) => ({
      label: month.label,
      value: total(items.filter((row) => (row.due_date || row.created_at || "").slice(0, 7) === (() => { const d = new Date(); d.setMonth(d.getMonth() - (5 - months.indexOf(month))); return d.toISOString().slice(0, 7); })())),
    }));
    const chartMax = Math.max(...monthTotals.map((month) => month.value), 1);
    return <div className="account-workspace">
      <div className="account-summary">
        <div><span>Total cadastrado</span><strong>R$ {itemTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
        <div><span>Contas pendentes</span><strong>{items.filter((row) => /pending|previst|pendente/i.test(row.status || "")).length}</strong></div>
        <div><span>Próximo vencimento</span><strong>{items[0]?.due_date ? new Date(`${items[0].due_date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</strong></div>
      </div>
      <div className="account-grid">
        <section className="panel account-chart"><div className="records-header"><div><h2>Gráfico mensal</h2><p>Valores por vencimento</p></div><BarChart3 size={20} /></div><div className="mini-bars">{monthTotals.map((month) => <div key={month.label}><i style={{ height: `${Math.max((month.value / chartMax) * 100, month.value ? 8 : 3)}%` }} /><span>{month.label}</span></div>)}</div></section>
        <section className="panel account-notes"><h2>Notas</h2><textarea value={accountNotes[kind]} onChange={(event) => { const updated = { ...accountNotes, [kind]: event.target.value }; setAccountNotes(updated); window.localStorage.setItem("fenix-account-notes", JSON.stringify(updated)); }} placeholder={`Adicione notas sobre ${title.toLowerCase()}...`} /><small>Salvo automaticamente neste dispositivo.</small></section>
      </div>
      <section className="panel account-sheet"><div className="records-header"><div><h2>Planilha — {title}</h2><p>Lista organizada de valores, vencimentos e status.</p></div></div>{items.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Descrição</th><th>Vencimento</th><th>Status</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{items.map((row) => <tr key={row.id}><td>{row.description || "Sem descrição"}</td><td>{row.due_date ? new Date(`${row.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td>{row.status || "Pendente"}</td><td>R$ {Number(row.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td><td><div className="row-actions">{/pending|previst|pendente/i.test(row.status || "") && <button className="success" title={kind === "payable" ? "Marcar como paga" : "Marcar como recebida"} onClick={() => void settleFinance(row, kind)}><CheckCircle2 size={16}/></button>}{financeActions(row, kind)}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={Receipt} title={`Nenhuma ${title.toLowerCase()}`} text="Use o botão acima para adicionar." />}</section>
    </div>;
  }
  return (
    <div className="finance-workspace">
      {["Visão geral", "Relatórios"].includes(tab) && <div className="finance-filters">
        <div>
          <label>
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <button className="google-btn" onClick={printReport}>
          <FileBarChart size={15} /> Baixar relatório em PDF
        </button>
      </div>}
      <div className="finance-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "selected" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="module-toolbar">
        <div className="module-description">
          <span className="real-tag">DADOS REAIS</span>
          <p>{tab === "Lançamentos" ? "Receitas e despesas com categorias." : tab === "Contas a pagar" ? "Controle de contas, vencimentos e pagamentos." : tab === "Contas a receber" ? "Controle de cobranças, vencimentos e recebimentos." : tab === "Fluxo financeiro" ? "Acompanhamento automático das movimentações e do saldo." : tab === "Relatórios" ? "Consulta e emissão de relatórios financeiros." : "Resumo geral do financeiro."}</p>
        </div>
        {tab === "Lançamentos" && <button className="primary-btn" onClick={() => openFinanceForm("launch")}><Plus size={17} /> Novo lançamento</button>}
        {tab === "Contas a pagar" && <button className="primary-btn" onClick={() => openFinanceForm("payable")}><Plus size={17} /> Nova conta a pagar</button>}
        {tab === "Contas a receber" && <button className="primary-btn" onClick={() => openFinanceForm("receivable")}><Plus size={17} /> Nova conta a receber</button>}
        {tab === "Fluxo financeiro" && <button className="google-btn" onClick={() => void load()}><Activity size={17} /> Atualizar fluxo</button>}
        {tab === "Relatórios" && <button className="google-btn" onClick={printReport}><FileBarChart size={17} /> Exportar relatório</button>}
      </div>
      {financeError && <div className="auth-error" role="alert">{financeError}</div>}
      {tab === "Visão geral" && (
        <>
          <div className="stock-cards finance-cards">
            <div className="stat-card">
              <div className="stat-icon i1">
                <ArrowUpRight size={18} />
              </div>
              <div className="stat-label">Receitas</div>
              <strong>
                R${" "}
                {revenueTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <small>Entradas no período</small>
            </div>
            <div className="stat-card">
              <div className="stat-icon i2">
                <ArrowDownToLine size={18} />
              </div>
              <div className="stat-label">Despesas</div>
              <strong>
                R${" "}
                {expenseTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <small>Saídas no período</small>
            </div>
            <div className="stat-card">
              <div className="stat-icon i3">
                <WalletCards size={18} />
              </div>
              <div className="stat-label">Saldo</div>
              <strong>
                R${" "}
                {(revenueTotal - expenseTotal).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <small>Receitas menos despesas</small>
            </div>
            <div className="stat-card">
              <div className="stat-icon i0">
                <Receipt size={18} />
              </div>
              <div className="stat-label">Pendentes</div>
              <strong>{pending.length}</strong>
              <small>Contas previstas</small>
            </div>
          </div>
          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Visão financeira</h2>
                  <p>Receitas e despesas por mês</p>
                </div>
                <BarChart3 size={20} />
              </div>
              <div className="finance-chart">
                <div className="finance-legend">
                  <span>
                    <i className="legend-revenue" /> Receitas
                  </span>
                  <span>
                    <i className="legend-expense" /> Despesas
                  </span>
                </div>
                {months.map((month) => (
                  <div className="chart-column" key={month.label}>
                    <div className="finance-bars">
                      <div
                        className="chart-bar revenue-bar"
                        style={{
                          height: `${Math.max((month.revenue / max) * 100, month.revenue ? 8 : 3)}%`,
                        }}
                      />
                      <div
                        className="chart-bar expense-bar"
                        style={{
                          height: `${Math.max((month.expense / max) * 100, month.expense ? 8 : 3)}%`,
                        }}
                      />
                    </div>
                    <span>{month.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel flow-panel">
              <div className="panel-head">
                <div>
                  <h2>Fluxo financeiro</h2>
                  <p>Fluxo real do lançamento ao fechamento</p>
                </div>
                <ArrowUpRight size={20} />
              </div>
              <div className="finance-flow">
                <span>Cadastro</span>
                <b>→</b>
                <span>Classificação</span>
                <b>→</b>
                <span>Vencimento</span>
                <b>→</b>
                <span>Pagamento</span>
                <b>→</b>
                <span>Conciliação</span>
              </div>
              <small className="flow-note">
                O relatório considera somente lançamentos existentes no
                Supabase.
              </small>
            </section>
          </div>
        </>
      )}
      {tab === "Lançamentos" && (
        <section className="panel records-panel">
          <div className="records-header">
            <div>
              <h2>Lançamentos</h2>
              <p>
                Todas as entradas e saídas registradas no financeiro.
              </p>
            </div>
            <CircleDollarSign size={20} />
          </div>
          {rowsView(filtered, "Nenhum lançamento")}
        </section>
      )}
      {tab === "Contas a pagar" && (
        accountWorkspace(expenses, "payable")
      )}
      {tab === "Contas a receber" && (
        accountWorkspace(revenues, "receivable")
      )}
      {tab === "Fluxo financeiro" && (
        <section className="panel records-panel flow-report">
          <div className="records-header">
            <div>
              <h2>Fluxograma financeiro completo</h2>
              <p>Documento explicativo do ciclo financeiro selecionado.</p>
            </div>
            <button className="primary-btn" onClick={printReport}>
              <FileBarChart size={15} /> Baixar PDF
            </button>
          </div>
          <div className="finance-flow large-flow">
            <span>1. Lançamento</span>
            <b>→</b>
            <span>2. Tipo automático</span>
            <b>→</b>
            <span>3. Categoria</span>
            <b>→</b>
            <span>4. Vencimento</span>
            <b>→</b>
            <span>5. Pagamento</span>
            <b>→</b>
            <span>6. Relatório</span>
          </div>
          <div className="report-meta">
            Gerado em {new Date().toLocaleString("pt-BR")} • Período:{" "}
            {from || "início"} até {to || "hoje"} • Registros: {filtered.length}
          </div>
          {rowsView(filtered, "Nenhuma movimentação no fluxo", false)}
        </section>
      )}
      {tab === "Relatórios" && (
        <section className="panel records-panel finance-report">
          <div className="records-header">
            <div>
              <h2>Relatório financeiro detalhado</h2>
              <p>Todos os registros do financeiro, organizados por data e horário.</p>
            </div>
            <button className="primary-btn" onClick={printReport}>
              <FileBarChart size={15} /> Imprimir / PDF
            </button>
          </div>
          <div className="report-periods" aria-label="Período do relatório">
            <button onClick={() => setReportPeriod("daily")}>Diário</button>
            <button onClick={() => setReportPeriod("weekly")}>Semanal</button>
            <button onClick={() => setReportPeriod("monthly")}>Mensal</button>
            <button onClick={() => setReportPeriod("annual")}>Anual</button>
          </div>
          <div className="report-date-search">
            <div className="report-calendar-title">
              <CalendarDays size={20} />
              <div><b>Calendário para consulta</b><span>Selecione o período exato do relatório</span></div>
            </div>
            <div className="report-date-fields">
              <label>Data inicial<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
              <label>Data final<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <label>Descrição ou categoria<input type="search" value={financeQuery} onChange={(event) => setFinanceQuery(event.target.value)} placeholder="Pesquisar lançamento..." /></label>
              <button className="primary-btn" type="button" onClick={() => void load()}><Search size={16} /> Pesquisar</button>
              <button className="google-btn" type="button" onClick={() => { setFrom(""); setTo(""); }}>Limpar consulta</button>
            </div>
            <small>{from || to ? `Consultando de ${from || "início"} até ${to || "hoje"}` : "Selecione as datas ou use um período rápido acima."}</small>
          </div>
          <div className="report-summary">
            <div><span>Total de entradas</span><strong className="positive">R$ {revenueTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
            <div><span>Total de saídas</span><strong className="negative">R$ {expenseTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
            <div><span>Saldo do período</span><strong>R$ {(revenueTotal - expenseTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
            <div><span>Registros</span><strong>{filtered.length}</strong></div>
          </div>
          {filtered.length ? (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead><tr><th>Data e hora</th><th>Dia</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Status</th><th>Valor</th><th>Ações</th></tr></thead>
                <tbody>{filtered.map((row) => {
                  const rawDate = row.created_at || (row.due_date ? `${row.due_date}T12:00:00` : "");
                  const date = rawDate ? new Date(rawDate) : null;
                  const expense = /expense|despesa|saída|saida/i.test(row.type || "");
                  return <tr key={row.id}>
                    <td>{date ? date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</td>
                    <td>{date ? date.toLocaleDateString("pt-BR", { weekday: "long" }) : "—"}</td>
                    <td>{row.description || "Sem descrição"}</td>
                    <td>{expense ? "Saída" : "Entrada"}</td>
                    <td>{row.category || "Sem categoria"}</td>
                    <td>{row.status || "Sem status"}</td>
                    <td className={expense ? "negative" : "positive"}>{expense ? "-" : "+"} R$ {Number(row.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td>{financeActions(row)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          ) : <EmptyState icon={FileBarChart} title="Nenhum registro no período" text="Escolha outras datas no calendário para pesquisar." />}
          <div className="report-footer-line">Período: {from || "início"} até {to || "hoje"} • Gerado em {new Date().toLocaleString("pt-BR")}</div>
        </section>
      )}
      {formOpen && (
        <RecordForm
          client={client}
          active="Financeiro"
          financeMode={financeMode}
          initialData={editing}
          recordId={editing?.id}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            void load();
          }}
        />
      )}
      {viewing && <div className="modal-backdrop"><div className="record-modal detail-modal"><div className="modal-head"><div><span className="real-tag">LANÇAMENTO FINANCEIRO</span><h2>{viewing.description || "Detalhes do lançamento"}</h2></div><button className="icon-btn" onClick={() => setViewing(null)}>×</button></div><div className="detail-grid"><div><span>Tipo</span><b>{/expense|despesa/i.test(viewing.type || "") ? "Despesa" : "Receita"}</b></div><div><span>Valor</span><b>R$ {Number(viewing.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div><div><span>Categoria</span><b>{viewing.category || "Sem categoria"}</b></div><div><span>Status</span><b>{viewing.status || "Pendente"}</b></div><div><span>Vencimento</span><b>{viewing.due_date ? new Date(`${viewing.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado"}</b></div></div><div className="modal-actions"><button className="primary-btn" onClick={() => { const row = viewing; setViewing(null); openFinanceForm(/expense|despesa/i.test(row.type || "") ? "payable" : "receivable", row); }}><Pencil size={16}/> Editar lançamento</button><button className="google-btn" onClick={() => { const row = viewing; setViewing(null); void removeFinance(row); }}><Trash2 size={16}/> Excluir</button></div></div></div>}
    </div>
  );
}
function StockWorkspace({
  client,
  configured,
}: {
  client: SupabaseClient | null;
  configured: boolean;
}) {
  const [tab, setTab] = useState("Visão geral");
  const [products, setProducts] = useState<
    {
      id: string;
      name?: string;
      code?: string;
      stock?: number;
      minimum_stock?: number;
      cost_price?: number;
      sale_price?: number;
      location?: string;
      image_url?: string;
    }[]
  >([]);
  const [movements, setMovements] = useState<
    {
      id: string;
      product_id?: string;
      type?: string;
      quantity?: number;
      reason?: string;
      created_at?: string;
    }[]
  >([]);
  const [search, setSearch] = useState("");
  const [movementOpen, setMovementOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceProductId, setMaintenanceProductId] = useState("");
  const [maintenanceLocation, setMaintenanceLocation] = useState("");
  const [maintenanceMinimum, setMaintenanceMinimum] = useState("");
  const tabs = [
    "Visão geral",
    "Cadastro",
    "Movimentações",
    "Consultas",
    "Relatórios",
    "Ajustes",
    "Manutenção",
  ];
  async function load() {
    if (!client) return;
    const [{ data: productRows }, { data: movementRows }] = await Promise.all([
      client
        .from("products")
        .select("*")
        .order("name"),
      client
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setProducts((productRows ?? []) as typeof products);
    setMovements((movementRows ?? []).map((row) => ({
      ...row,
      type: row.type ?? row.movement_type,
    })) as typeof movements);
  }
  useEffect(() => {
    void load();
  }, [client]);
  const filtered = products.filter((item) =>
    `${item.name ?? ""} ${item.code ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const lowStock = products.filter(
    (item) => Number(item.stock ?? 0) <= Number(item.minimum_stock ?? 0),
  );
  const inventoryValue = products.reduce(
    (sum, item) => sum + Number(item.stock ?? 0) * Number(item.cost_price ?? 0),
    0,
  );
  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !productId || Number(quantity) <= 0) {
      setError("Selecione um produto e informe uma quantidade válida.");
      return;
    }
    setBusy(true);
    setError("");
    const { data: userData } = await client.auth.getUser();
    const selectedProduct = products.find((item) => item.id === productId);
    const currentStock = Number(selectedProduct?.stock ?? 0);
    const amount = Number(quantity);
    const nextStock = movementType === "entrada"
      ? currentStock + amount
      : movementType === "saida"
        ? currentStock - amount
        : amount;
    if (nextStock < 0) {
      setError("A saída não pode deixar o estoque negativo.");
      setBusy(false);
      return;
    }
    const movementPayload: Record<string, unknown> = {
      product_id: productId,
      type: movementType,
      movement_type: movementType,
      quantity: amount,
      reason: reason || null,
      created_by: userData.user?.id ?? null,
    };
    const movementValueCandidates: Record<string, string[]> = {
      entrada: ["entrada", "in", "IN", "entry", "inbound", "Entrada", "ENTRADA"],
      saida: ["saida", "out", "OUT", "exit", "outbound", "Saída", "SAIDA"],
      ajuste: ["ajuste", "adjustment", "ADJUSTMENT", "adjust", "Ajuste", "AJUSTE"],
    };
    const valueCandidates = movementValueCandidates[movementType] ?? [movementType];
    let candidateIndex = 0;
    let insertError: { message: string } | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await client.from("inventory_movements").insert(movementPayload);
      insertError = result.error;
      if (!insertError) break;
      const missingColumn = insertError.message.match(/(?:Could not find|column)\s+(?:the\s+)?['\"]?([a-z_]+)['\"]?(?:\s+column)?/i)?.[1]
        || insertError.message.match(/['\"]([a-z_]+)['\"] column/i)?.[1];
      if (missingColumn && missingColumn in movementPayload) {
        delete movementPayload[missingColumn];
        continue;
      }
      if (/movement_type_check|check constraint/i.test(insertError.message) && candidateIndex < valueCandidates.length - 1) {
        candidateIndex += 1;
        movementPayload.movement_type = valueCandidates[candidateIndex];
        if ("type" in movementPayload) movementPayload.type = valueCandidates[candidateIndex];
        continue;
      }
      break;
    }
    if (insertError) {
      setError(insertError.message);
      setBusy(false);
      return;
    }
    const { error: stockError } = await client
      .from("products")
      .update({ stock: nextStock })
      .eq("id", productId);
    if (stockError) {
      setError(`Movimento registrado, mas o saldo não foi atualizado: ${stockError.message}`);
      setBusy(false);
      return;
    }
    if (userData.user?.id)
      await client
        .from("audit_logs")
        .insert({
          user_id: userData.user.id,
          action: "create",
          module: "Estoque",
          description: `Movimentação de estoque: ${movementType} (${amount})`,
        });
    setBusy(false);
    setMovementOpen(false);
    setProductId("");
    setQuantity("");
    setReason("");
    await load();
  }
  async function saveMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !maintenanceProductId) { setError("Selecione um produto."); return; }
    setBusy(true); setError("");
    const changes: Record<string, unknown> = { minimum_stock: Number(maintenanceMinimum || 0) };
    if (maintenanceLocation.trim()) changes.location = maintenanceLocation.trim();
    let { error: updateError } = await client.from("products").update(changes).eq("id", maintenanceProductId);
    if (updateError && /location/i.test(updateError.message)) {
      delete changes.location;
      updateError = (await client.from("products").update(changes).eq("id", maintenanceProductId)).error;
    }
    if (updateError) setError(updateError.message); else { setMaintenanceOpen(false); setMaintenanceProductId(""); setMaintenanceLocation(""); setMaintenanceMinimum(""); await load(); }
    setBusy(false);
  }
  return (
    <div className="stock-workspace">
      <div className="stock-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "selected" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="module-toolbar">
        <div className="module-description">
          <span className="real-tag">DADOS REAIS</span>
          <p>{tab === "Visão geral" ? "Resumo dos saldos, alertas e últimas movimentações." : tab === "Cadastro" ? "Cadastro e consulta dos dados comerciais dos produtos." : tab === "Movimentações" ? "Entradas, saídas e ajustes com atualização do saldo." : tab === "Consultas" ? "Pesquisa operacional por nome, código e nível de estoque." : tab === "Relatórios" ? "Indicadores consolidados e posição financeira do estoque." : tab === "Ajustes" ? "Correção controlada do saldo físico de um produto." : "Acompanhamento de itens que exigem revisão cadastral."}</p>
        </div>
        <div className="stock-actions">
          {tab === "Cadastro" && <button className="primary-btn" onClick={() => { setMovementType("entrada"); setMovementOpen(true); }}><Plus size={17} /> Registrar entrada</button>}
          {tab === "Movimentações" && <button className="primary-btn" onClick={() => setMovementOpen(true)}><ArrowUpRight size={15} /> Nova movimentação</button>}
          {tab === "Ajustes" && <button className="primary-btn" onClick={() => { setMovementType("ajuste"); setMovementOpen(true); }}><Pencil size={15} /> Ajustar saldo</button>}
          {tab === "Manutenção" && <button className="primary-btn" onClick={() => setMaintenanceOpen(true)}><Settings2 size={15} /> Configurar item</button>}
        </div>
      </div>
      {tab === "Visão geral" && (
        <>
          <div className="stock-cards">
            <div className="stat-card">
              <div className="stat-icon i0">
                <Boxes size={18} />
              </div>
              <div className="stat-label">Produtos cadastrados</div>
              <strong>{configured ? products.length : "—"}</strong>
              <small>Dados reais do Supabase</small>
            </div>
            <div className="stat-card">
              <div className="stat-icon i1">
                <Package size={18} />
              </div>
              <div className="stat-label">Itens em estoque</div>
              <strong>
                {products
                  .reduce((sum, item) => sum + Number(item.stock ?? 0), 0)
                  .toLocaleString("pt-BR")}
              </strong>
              <small>Saldo atual</small>
            </div>
            <div className="stat-card">
              <div className="stat-icon i2">
                <Receipt size={18} />
              </div>
              <div className="stat-label">Estoque baixo</div>
              <strong>{lowStock.length}</strong>
              <small>Itens no limite mínimo</small>
            </div>
            <div className="stat-card">
              <div className="stat-icon i3">
                <CircleDollarSign size={18} />
              </div>
              <div className="stat-label">Valor do estoque</div>
              <strong>
                R${" "}
                {inventoryValue.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </strong>
              <small>Preço de custo</small>
            </div>
          </div>
          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Controle de estoque</h2>
                  <p>Produtos abaixo do estoque mínimo</p>
                </div>
                <Boxes size={20} />
              </div>
              {lowStock.length ? (
                <div className="stock-list">
                  {lowStock.map((item) => (
                    <div className="stock-row" key={item.id}>
                      <b>{item.name || "Produto sem nome"}</b>
                      <span>
                        {item.stock ?? 0} / mínimo {item.minimum_stock ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Boxes}
                  title="Estoque em dia"
                  text="Nenhum produto abaixo do mínimo."
                />
              )}
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Movimentações recentes</h2>
                  <p>Entradas, saídas e perdas registradas</p>
                </div>
                <Activity size={20} />
              </div>
              {movements.length ? (
                <div className="stock-list">
                  {movements.slice(0, 6).map((item) => (
                    <div className="stock-row" key={item.id}>
                      <b>{movementLabel(item.type)}</b>
                      <span>
                        {item.quantity ?? 0}{" "}
                        {item.reason ? `• ${item.reason}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="Nenhuma movimentação"
                  text="Registre a primeira movimentação real."
                />
              )}
            </section>
          </div>
        </>
      )}
      {tab === "Cadastro" && (
        <section className="panel records-panel stock-entry-workspace">
          <div className="records-header"><div><h2>Entrada de mercadorias</h2><p>Selecione o produto que chegou para acrescentar unidades ao saldo.</p></div><ArrowDownToLine size={20}/></div>
          {products.length ? <div className="stock-list">{products.map((item) => <div className="stock-row" key={item.id}><div><b>{item.name || "Produto sem nome"}</b><span>{item.code || "Sem código"} • Saldo atual: {item.stock ?? 0}</span></div><button className="primary-btn" onClick={() => { setProductId(item.id); setMovementType("entrada"); setMovementOpen(true); }}><Plus size={15}/> Dar entrada</button></div>)}</div> : <EmptyState icon={Package} title="Nenhum produto disponível" text="Cadastre primeiro o item na seção Produtos."/>}
        </section>
      )}
      {tab === "Consultas" && (
        <StockTable
          title="Consultar disponibilidade e localização"
          products={filtered}
          search={search}
          setSearch={setSearch}
        />
      )}
      {tab === "Movimentações" && <StockMovements movements={movements} />}
      {tab === "Relatórios" && (
        <StockReports products={products} movements={movements} />
      )}
      {tab === "Ajustes" && (
        <section className="panel stock-info">
          <h2>Ajuste de inventário</h2>
          <p>Use “Registrar movimento”, escolha <b>Ajuste de saldo</b> e informe a quantidade física contada. O produto e o histórico serão atualizados.</p>
          <span className="real-tag">AJUSTE RASTREÁVEL</span>
        </section>
      )}
      {tab === "Manutenção" && (
        <section className="panel stock-info">
          <h2>Revisão cadastral do estoque</h2>
          <p>Itens sem código, sem preço de custo ou com estoque mínimo zerado precisam de manutenção.</p>
          <div className="stock-list">
            {products.filter((item) => !item.code || !Number(item.cost_price) || !Number(item.minimum_stock)).slice(0, 20).map((item) => <div className="stock-row" key={item.id}><b>{item.name || "Produto sem nome"}</b><span>{!item.code ? "Sem código" : !Number(item.cost_price) ? "Sem custo" : "Sem estoque mínimo"}</span></div>)}
          </div>
        </section>
      )}
      {maintenanceOpen && <div className="modal-backdrop"><form className="record-modal" onSubmit={saveMaintenance}><div className="modal-head"><div><span className="real-tag">ESTOQUE</span><h2>Configurar item armazenado</h2></div><button className="icon-btn" type="button" onClick={() => setMaintenanceOpen(false)}>×</button></div><label>Produto<select required value={maintenanceProductId} onChange={(e) => { const id=e.target.value; const item=products.find((product)=>product.id===id); setMaintenanceProductId(id); setMaintenanceLocation(item?.location || ""); setMaintenanceMinimum(String(item?.minimum_stock ?? "")); }}><option value="">Selecione</option>{products.map((item)=><option key={item.id} value={item.id}>{item.name || item.code}</option>)}</select></label><label>Localização física<input value={maintenanceLocation} onChange={(e)=>setMaintenanceLocation(e.target.value)} placeholder="Ex.: Corredor A, Prateleira 03"/></label><label>Estoque mínimo<input type="number" min="0" step="0.001" value={maintenanceMinimum} onChange={(e)=>setMaintenanceMinimum(e.target.value)}/></label>{error && <div className="auth-error">{error}</div>}<div className="modal-actions"><button className="google-btn" type="button" onClick={()=>setMaintenanceOpen(false)}>Cancelar</button><button className="primary-btn" disabled={busy}>{busy ? "Salvando..." : "Salvar configuração"}</button></div></form></div>}
      {movementOpen && (
        <div className="modal-backdrop">
          <form className="record-modal" onSubmit={saveMovement}>
            <div className="modal-head">
              <div>
                <span className="real-tag">ESTOQUE REAL</span>
                <h2>Registrar movimentação</h2>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setMovementOpen(false)}
              >
                ×
              </button>
            </div>
            <label>
              Produto
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Selecione</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.code || item.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste de saldo</option>
              </select>
            </label>
            <label>
              Quantidade
              <input
                required
                min="1"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label>
              Motivo/observação
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <div className="modal-actions">
              <button
                className="google-btn"
                type="button"
                onClick={() => setMovementOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-btn" type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function StockTable({
  title,
  products,
  search,
  setSearch,
}: {
  title: string;
  products: {
    id: string;
    name?: string;
    code?: string;
    stock?: number;
    minimum_stock?: number;
    location?: string;
    image_url?: string;
  }[];
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <section className="panel records-panel">
      <div className="records-header">
        <div>
          <h2>{title}</h2>
          <p>Consulta conectada ao Supabase</p>
        </div>
        <div className="filter-search">
          <Search size={16} />
          <input
            placeholder="Pesquisar produto ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {products.length ? (
        <div className="stock-table">
          {products.map((item) => (
            <div className="stock-table-row" key={item.id}>
              <b className="stock-product-code">{item.image_url && <img src={item.image_url} alt=""/>}{item.code || "Sem código"}</b>
              <span>{item.name || "Sem nome"}</span>
              <strong>{item.stock ?? 0}</strong>
              <small>{item.location || "Local não informado"} • Mínimo: {item.minimum_stock ?? 0}</small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          text="Cadastre produtos reais para consultar o estoque."
        />
      )}
    </section>
  );
}
function movementLabel(type?: string) {
  return /^(in|entrada|entry)$/i.test(type || "") ? "Entrada" : /^(out|saida|saída|exit)$/i.test(type || "") ? "Saída" : /^(adjustment|ajuste)$/i.test(type || "") ? "Ajuste" : "Movimento";
}
function StockMovements({
  movements,
}: {
  movements: {
    id: string;
    type?: string;
    quantity?: number;
    reason?: string;
    created_at?: string;
  }[];
}) {
  return (
    <section className="panel records-panel">
      <div className="records-header">
        <div>
          <h2>Entradas, saídas e perdas</h2>
          <p>Histórico real de movimentações</p>
        </div>
        <Activity size={20} />
      </div>
      {movements.length ? (
        <div className="stock-table">
          {movements.map((item) => (
            <div className="stock-table-row" key={item.id}>
              <b>{movementLabel(item.type)}</b>
              <span>{item.reason || "Sem observação"}</span>
              <strong>{item.quantity ?? 0}</strong>
              <small>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString("pt-BR")
                  : "—"}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="Nenhuma movimentação"
          text="Os registros aparecerão aqui."
        />
      )}
    </section>
  );
}
function StockReports({
  products,
  movements,
}: {
  products: {
    id: string;
    name?: string;
    stock?: number;
    cost_price?: number;
  }[];
  movements: { id: string; type?: string; quantity?: number }[];
}) {
  const total = products.reduce(
    (sum, item) => sum + Number(item.stock ?? 0) * Number(item.cost_price ?? 0),
    0,
  );
  return (
    <div className="grid-2">
      <section className="panel stock-info">
        <h2>Relatório de produtos</h2>
        <p>
          {products.length} produtos cadastrados • Valor de custo: R${" "}
          {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        <span className="real-tag">GERADO DO SUPABASE</span>
      </section>
      <section className="panel stock-info">
        <h2>Movimentação mensal</h2>
        <p>{movements.length} movimentações carregadas para análise.</p>
        <span className="real-tag">CURVA ABC DISPONÍVEL COM DADOS REAIS</span>
      </section>
    </div>
  );
}
function EntityWorkspace({ client, active, query }: { client: SupabaseClient | null; active: "Clientes" | "Fornecedores" | "Produtos"; query: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const table = active === "Clientes" ? "customers" : active === "Fornecedores" ? "suppliers" : "products";
  const title = active === "Clientes" ? "Carteira de clientes" : active === "Fornecedores" ? "Base de fornecedores" : "Catálogo de produtos";
  async function load() {
    if (!client) return;
    const { data, error } = await client.from(table).select("*").order("created_at", { ascending: false }).limit(300);
    if (error) setWorkspaceError(error.message); else setWorkspaceError("");
    setRows((data ?? []) as Record<string, unknown>[]);
  }
  useEffect(() => { void load(); }, [client, active]);
  const normalizedQuery = query.trim().toLowerCase();
  const digitsQuery = query.replace(/\D/g, "");
  const filtered = rows.filter((row) => {
    const text = `${row.name ?? ""} ${row.company_name ?? ""} ${row.corporate_name ?? ""} ${row.trade_name ?? ""} ${row.document ?? row.cpf ?? row.cnpj ?? ""} ${row.code ?? row.sku ?? row.product_code ?? ""} ${row.email ?? ""}`.toLowerCase();
    const documentDigits = String(row.document ?? row.cpf ?? row.cnpj ?? "").replace(/\D/g, "");
    return !normalizedQuery || text.includes(normalizedQuery) || (!!digitsQuery && documentDigits.includes(digitsQuery));
  });
  async function remove(row: Record<string, unknown>) {
    if (!client || !window.confirm(`Excluir ${String(row.name || "este registro")}?`)) return;
    const { error } = await client.from(table).delete().eq("id", String(row.id));
    if (error) setWorkspaceError(`Não foi possível excluir: ${error.message}`); else await load();
  }
  const detailEntries = viewing ? Object.entries(viewing).filter(([key]) => !["id", "created_by", ...(active === "Produtos" ? ["stock", "minimum_stock", "location"] : [])].includes(key)) : [];
  return <div className="entity-workspace">
    <div className="module-toolbar"><div className="module-description"><span className="real-tag">DADOS REAIS</span><p>{active === "Clientes" ? "Contatos, documentos e histórico cadastral dos clientes." : active === "Fornecedores" ? "Contatos e identificação dos parceiros de compra." : "Preços, códigos, unidades e saldos comerciais dos produtos."}</p></div><button className="primary-btn" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} /> {active === "Produtos" ? "Novo produto" : active === "Clientes" ? "Novo cliente" : "Novo fornecedor"}</button></div>
    {workspaceError && <div className="auth-error" role="alert">{workspaceError}</div>}
    <section className="panel records-panel"><div className="records-header"><div><h2>{title}</h2><p>{filtered.length} registro(s) encontrado(s)</p></div><Search size={20} /></div>
      {filtered.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th>{active === "Produtos" ? "SKU" : "Nome"}</th><th>{active === "Produtos" ? "Produto" : "Documento"}</th><th>{active === "Produtos" ? "Categoria" : "Contato"}</th><th>{active === "Produtos" ? "Preço de venda" : "Cadastro"}</th><th>Ações</th></tr></thead><tbody>{filtered.map((row) => <tr key={String(row.id)}><td>{active === "Produtos" ? String(row.code || "—") : String(row.name || "—")}</td><td>{active === "Produtos" ? String(row.name || "—") : String(row.document || "—")}</td><td>{active === "Produtos" ? String(row.category || "Sem categoria") : String(row.email || row.phone || "—")}</td><td>{active === "Produtos" ? `R$ ${Number(row.sale_price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : row.created_at ? new Date(String(row.created_at)).toLocaleDateString("pt-BR") : "—"}</td><td><div className="row-actions"><button title="Visualizar" onClick={() => setViewing(row)}><Eye size={16}/></button><button title="Editar" onClick={() => { setEditing(row); setFormOpen(true); }}><Pencil size={16}/></button><button className="danger" title="Excluir" onClick={() => void remove(row)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={active === "Produtos" ? Package : Users} title={`Nenhum ${active.toLowerCase()} encontrado`} text="Use o botão acima para criar o primeiro registro." />}
    </section>
    {formOpen && <RecordForm client={client} active={active} initialData={editing} recordId={editing ? String(editing.id) : undefined} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={() => { setFormOpen(false); setEditing(null); void load(); }} />}
    {viewing && <div className="modal-backdrop"><div className="record-modal detail-modal"><div className="modal-head"><div><span className="real-tag">CADASTRO COMPLETO</span><h2>{String(viewing.name || "Detalhes")}</h2></div><button className="icon-btn" onClick={() => setViewing(null)}>×</button></div>{active === "Produtos" && viewing.image_url && <img className="product-detail-image" src={String(viewing.image_url)} alt={String(viewing.name || "Produto")}/>}<div className="detail-grid">{detailEntries.filter(([key])=>key!=="image_url").map(([key,value]) => <div key={key}><span>{fieldTitle(key)}</span><b>{formatDetail(value)}</b></div>)}</div><div className="modal-actions"><button className="primary-btn" onClick={() => { setEditing(viewing); setViewing(null); setFormOpen(true); }}><Pencil size={16}/> Editar cadastro</button></div></div></div>}
  </div>;
}

function fieldTitle(key: string) {
  return ({ name: "Nome", document: "CPF/CNPJ", email: "E-mail", phone: "Telefone", address: "Endereço", notes: "Observações", source: "Origem", code: "Código", category: "Categoria", unit: "Unidade", stock: "Estoque", minimum_stock: "Estoque mínimo", cost_price: "Preço de custo", sale_price: "Preço de venda", image_url: "Imagem", created_at: "Data do cadastro" } as Record<string,string>)[key] || key.replaceAll("_", " ");
}
function formatDetail(value: unknown) {
  if (value == null || value === "") return "Não informado";
  if (typeof value === "object") return Object.values(value as Record<string,unknown>).filter(Boolean).join(", ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("pt-BR");
  return String(value);
}

function UserManagement({ client }: { client: SupabaseClient | null }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userError, setUserError] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  async function load() {
    if (!client) { setLoadingUsers(false); return; }
    setLoadingUsers(true);
    setUserError("");
    const { data, error } = await client
      .from("profiles")
      .select("*");
    if (error) {
      console.error("Falha ao carregar usuários:", error);
      setUsers([]);
      setUserError(`Não foi possível consultar os usuários: ${error.message}`);
    } else {
      setUsers((data ?? []).map((row) => ({
        ...(row as UserProfile),
        role: String(row.role || "user").trim().toLowerCase(),
        status: String(row.status || "pending").trim().toLowerCase(),
      })).sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "", "pt-BR")));
    }
    setLoadingUsers(false);
  }
  useEffect(() => {
    void load();
    if (!client) return;
    void client.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || ""));
    const channel = client.channel("profiles-admin-list").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      () => void load(),
    ).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [client]);
  async function updateUser(id: string, changes: Record<string, string>) {
    if (!client) return;
    setBusy(id); setUserError("");
    const { error } = await client.from("profiles").update(changes).eq("id", id);
    if (error) setUserError(`Não foi possível atualizar o usuário: ${error.message}`);
    setBusy(""); await load();
  }
  async function deleteUserProfile(user: UserProfile) {
    if (!client || user.id === currentUserId) return;
    const confirmed = window.confirm(`Excluir ${user.full_name || user.email} da Gestão de Usuários?`);
    if (!confirmed) return;
    setBusy(user.id); setUserError("");
    const { error } = await client.from("profiles").delete().eq("id", user.id);
    if (error) setUserError(`Não foi possível excluir o usuário: ${error.message}`);
    setBusy(""); await load();
  }
  const isBlockedUser = (user: UserProfile) => user.status === "blocked" || user.status === "bloqueado";
  const isPendingUser = (user: UserProfile) => user.status === "pending" || user.status === "pendente" || !user.status;
  const isOnline = (user: UserProfile) => Boolean(user.last_seen_at && Date.now() - new Date(user.last_seen_at).getTime() < 120_000);
  const pendingCount = users.filter(isPendingUser).length;
  const blockedCount = users.filter(isBlockedUser).length;
  const onlineUsers = users.filter(isOnline);
  const latestAccess = users.map((user) => user.last_seen_at).filter(Boolean).sort().at(-1);
  const formatAccess = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Nunca acessou";
  return <><div className="module-toolbar"><div className="module-description"><span className="real-tag">ADMINISTRAÇÃO</span><p>Autorize, bloqueie e acompanhe os usuários cadastrados em tempo real.</p></div><button className="google-btn" onClick={() => void load()} disabled={loadingUsers}><Activity size={16} /> {loadingUsers ? "Atualizando..." : "Atualizar usuários"}</button></div>
    <div className="stock-cards user-status-cards">
      <div className="stat-card"><div className="stat-icon i2"><UserRound size={18} /></div><div className="stat-label">Pendentes</div><strong>{pendingCount}</strong><small>Aguardando liberação</small></div>
      <div className="stat-card"><div className="stat-icon i1"><ShieldCheck size={18} /></div><div className="stat-label">Bloqueados</div><strong>{blockedCount}</strong><small>Acesso interrompido</small></div>
      <div className="stat-card"><div className="stat-icon i3"><Activity size={18} /></div><div className="stat-label">Ativos / Online</div><strong>{onlineUsers.length}</strong><small><span className="connected-dot" /> Agora • último acesso {formatAccess(latestAccess)}</small></div>
    </div>
    <section className="panel records-panel"><div className="records-header"><div><h2>Usuários cadastrados</h2><p>{loadingUsers ? "Consultando perfis..." : `${users.length} perfil(is) encontrado(s)`}</p></div><ShieldCheck size={20} /></div>{userError && <div className="auth-error" role="alert">{userError}</div>}{loadingUsers ? <EmptyState icon={UserRound} title="Carregando usuários" text="Aguarde a consulta dos perfis cadastrados." /> : users.length ? <div className="finance-rows">{users.map((user) => <div className="finance-row" key={user.id}><div><b>{user.full_name || user.email || "Usuário sem nome"}</b><span>{user.email || "Sem e-mail"} • {user.role === "admin" || user.role === "administrador" ? "Administrador" : "Usuário básico"}</span><small>{isOnline(user) ? "Online agora" : `Último acesso: ${formatAccess(user.last_seen_at)}`} • Cadastro: {user.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR") : "data não informada"}</small></div><strong className={isBlockedUser(user) ? "negative" : "positive"}>{isBlockedUser(user) ? "Bloqueado" : isPendingUser(user) ? "Pendente" : "Autorizado"}</strong><div className="stock-actions"><button className="google-btn" disabled={busy === user.id} onClick={() => updateUser(user.id, { status: isBlockedUser(user) ? "authorized" : "blocked" })}>{isBlockedUser(user) ? "Autorizar" : "Bloquear"}</button><button className="primary-btn" disabled={busy === user.id} onClick={() => updateUser(user.id, { role: user.role === "admin" || user.role === "administrador" ? "user" : "admin", status: "authorized" })}>{user.role === "admin" || user.role === "administrador" ? "Tornar básico" : "Tornar admin"}</button><button className="view-user-btn" title="Visualizar cadastro" onClick={() => setViewingUser(user)}><Eye size={17}/></button><button className="delete-user-btn" title={user.id === currentUserId ? "Não é possível excluir o próprio administrador" : "Excluir usuário"} aria-label={`Excluir ${user.full_name || user.email}`} disabled={busy === user.id || user.id === currentUserId} onClick={() => void deleteUserProfile(user)}><Trash2 size={17} /></button></div></div>)}</div> : <EmptyState icon={UserRound} title="Nenhum perfil disponível" text="Se existem contas no Auth, verifique se elas também possuem um registro na tabela profiles e se a política RLS permite a leitura pelo administrador." />}</section>
    {viewingUser && <div className="modal-backdrop"><div className="record-modal detail-modal"><div className="modal-head"><div><span className="real-tag">DADOS DO USUÁRIO</span><h2>{viewingUser.full_name || viewingUser.email}</h2></div><button className="icon-btn" onClick={() => setViewingUser(null)}>×</button></div><div className="detail-grid"><div><span>Nome completo</span><b>{viewingUser.full_name || "Não informado"}</b></div><div><span>E-mail</span><b>{viewingUser.email}</b></div><div><span>Telefone</span><b>{viewingUser.phone || "Não informado"}</b></div><div><span>Nível</span><b>{/admin|administrador/i.test(viewingUser.role) ? "Administrador" : "Usuário básico"}</b></div><div><span>Status</span><b>{isPendingUser(viewingUser) ? "Pendente" : isBlockedUser(viewingUser) ? "Bloqueado" : "Autorizado"}</b></div><div><span>Último acesso</span><b>{formatAccess(viewingUser.last_seen_at)}</b></div><div><span>Cadastro</span><b>{viewingUser.created_at ? new Date(viewingUser.created_at).toLocaleString("pt-BR") : "Não informado"}</b></div></div></div></div>}
  </>;
}

function GeneralReports({ client }: { client: SupabaseClient | null }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  useEffect(() => { if (!client) return; void Promise.all(["customers","suppliers","products","inventory_movements","financial_entries"].map(async (table) => { const { count } = await client.from(table).select("id", { count: "exact", head: true }); return [table, count ?? 0] as const; })).then((items) => setCounts(Object.fromEntries(items))); }, [client]);
  return <><div className="module-toolbar"><div className="module-description"><span className="real-tag">RELATÓRIOS GERAIS</span><p>Consolidação dos módulos; relatórios financeiros detalhados permanecem na aba Financeiro.</p></div><button className="primary-btn" onClick={() => window.print()}><FileBarChart size={16} /> Imprimir / PDF</button></div><div className="report-date-search"><div className="report-calendar-title"><CalendarDays size={20}/><div><b>Período da consulta</b><span>Selecione data inicial e final</span></div></div><div className="report-date-fields"><label>Data inicial<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Data final<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></div></div><div className="stock-cards">{[["Clientes",counts.customers,Users],["Fornecedores",counts.suppliers,Building2],["Produtos",counts.products,Package],["Movimentações",counts.inventory_movements,Activity]].map(([label,value,Icon]) => { const C = Icon as typeof Users; return <div className="stat-card" key={String(label)}><div className="stat-icon i0"><C size={18}/></div><div className="stat-label">{String(label)}</div><strong>{Number(value || 0)}</strong><small>Registros atuais</small></div>; })}</div><section className="panel stock-info"><h2>Resumo operacional</h2><p>Período selecionado: {from || "início"} até {to || "hoje"}. Total financeiro disponível: {counts.financial_entries || 0} lançamentos.</p><span className="real-tag">CONSULTA POR MÓDULO</span></section></>;
}

function AdminWorkspace({ client }: { client: SupabaseClient | null }) {
  const [tab, setTab] = useState("Geral");
  const [logs, setLogs] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [latencies, setLatencies] = useState<number[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState("Conectando");
  const [sessionEmail, setSessionEmail] = useState("");
  const [monitorError, setMonitorError] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [networkOnline, setNetworkOnline] = useState(true);
  const tabs = ["Geral", "Segurança", "Permissões", "Auditoria"];
  const tables = ["customers", "suppliers", "products", "inventory_movements", "financial_entries"];
  async function loadMonitoring() {
    if (!client) return;
    setMonitorError("");
    const started = performance.now();
    const [countResults, profileResult, logResult, authResult] = await Promise.all([
      Promise.all(tables.map(async (table) => {
        const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
        return [table, error ? 0 : count ?? 0] as const;
      })),
      client.from("profiles").select("*"),
      client.from("audit_logs").select("id,action,module,description,created_at").order("created_at", { ascending: false }).limit(100),
      client.auth.getUser(),
    ]);
    const latency = Math.max(1, Math.round(performance.now() - started));
    setLatencies((current) => [...current.slice(-11), latency]);
    setCounts(Object.fromEntries(countResults));
    if (profileResult.error) setMonitorError(`Perfis: ${profileResult.error.message}`);
    else setProfiles((profileResult.data ?? []) as UserProfile[]);
    if (!logResult.error) setLogs((logResult.data ?? []) as Notification[]);
    if (authResult.data.user?.email) setSessionEmail(authResult.data.user.email);
    setLastUpdate(new Date());
  }
  useEffect(() => {
    if (!client) return;
    void loadMonitoring();
    const timer = window.setInterval(() => void loadMonitoring(), 15_000);
    const channel = client.channel("admin-live-monitor").on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => void loadMonitoring()).on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadMonitoring()).subscribe((status) => setRealtimeStatus(status === "SUBSCRIBED" ? "Online" : status === "CHANNEL_ERROR" ? "Erro" : "Conectando"));
    return () => { window.clearInterval(timer); void client.removeChannel(channel); };
  }, [client]);
  useEffect(() => {
    const updateNetwork = () => setNetworkOnline(window.navigator.onLine);
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => { window.removeEventListener("online", updateNetwork); window.removeEventListener("offline", updateNetwork); };
  }, []);
  async function updatePermission(user: UserProfile, changes: Record<string, string>) {
    if (!client) return;
    const { error } = await client.from("profiles").update(changes).eq("id", user.id);
    if (error) setMonitorError(`Permissões: ${error.message}`); else await loadMonitoring();
  }
  const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const onlineUsers = profiles.filter((user) => user.last_seen_at && Date.now() - new Date(user.last_seen_at).getTime() < 120_000).length;
  const activeUsers = profiles.filter((user) => /authorized|autorizado|active|ativo/i.test(user.status || "")).length;
  const blockedUsers = profiles.filter((user) => /blocked|bloqueado/i.test(user.status || "")).length;
  const latency = latencies.at(-1) ?? 0;
  const maxLatency = Math.max(...latencies, 1);
  const filteredLogs = logs.filter((log) => `${log.module} ${log.action} ${log.description}`.toLowerCase().includes(auditQuery.toLowerCase()));
  return <div className="settings-workspace">
    <div className="stock-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="module-toolbar settings-toolbar"><div className="module-description"><span className="real-tag">TEMPO REAL</span><p>{tab === "Geral" ? "Status geral da plataforma e volume de dados." : tab === "Segurança" ? "Sessão, conexão, latência e proteção dos dados." : tab === "Permissões" ? "Controle efetivo de nível e situação dos usuários." : "Registro rastreável das atividades da plataforma."}</p></div><button className="google-btn" onClick={() => void loadMonitoring()}><Activity size={16} /> Atualizar agora</button></div>
    {monitorError && <div className="auth-error" role="alert">{monitorError}</div>}
    {tab === "Geral" && <>
      <div className="settings-metrics"><div><span>Plataforma</span><strong>Online</strong><small>Supabase conectado</small></div><div><span>Usuários</span><strong>{profiles.length}</strong><small>{onlineUsers} online agora</small></div><div><span>Registros</span><strong>{totalRecords}</strong><small>Dados operacionais</small></div><div><span>Tempo real</span><strong>{realtimeStatus}</strong><small>{lastUpdate ? `Atualizado ${lastUpdate.toLocaleTimeString("pt-BR")}` : "Aguardando"}</small></div></div>
      <section className="panel live-data-panel"><div className="records-header"><div><h2>Monitoramento de dados</h2><p>Quantidade real de registros por módulo</p></div><BarChart3 size={20}/></div><div className="data-bars">{[["Clientes",counts.customers],["Fornecedores",counts.suppliers],["Produtos",counts.products],["Estoque",counts.inventory_movements],["Financeiro",counts.financial_entries]].map(([label,value]) => <div key={String(label)}><span>{String(label)}</span><i><b style={{ width: `${Math.max((Number(value || 0) / Math.max(...Object.values(counts), 1)) * 100, Number(value) ? 7 : 0)}%` }}/></i><strong>{Number(value || 0)}</strong></div>)}</div></section>
    </>}
    {tab === "Segurança" && <>
      <div className="settings-metrics"><div><span>Autenticação</span><strong>{sessionEmail ? "Validada" : "Pendente"}</strong><small>{sessionEmail || "Sem sessão"}</small></div><div><span>Rede</span><strong>{networkOnline ? "Online" : "Offline"}</strong><small>{latency} ms de resposta</small></div><div><span>Proteção</span><strong>RLS</strong><small>Controle por usuário</small></div><div><span>Canal Realtime</span><strong>{realtimeStatus}</strong><small>Eventos do Supabase</small></div></div>
      <section className="panel security-live"><div className="records-header"><div><h2>Latência da conexão</h2><p>Medições reais atualizadas a cada 15 segundos</p></div><ShieldCheck size={20}/></div><div className="latency-chart">{latencies.length ? latencies.map((value,index) => <i key={`${index}-${value}`} style={{ height: `${Math.max((value / maxLatency) * 100, 8)}%` }} title={`${value} ms`}><span>{value}</span></i>) : <small>Aguardando primeira medição...</small>}</div><div className="security-checks"><span><b>✓</b> Sessão Supabase verificada</span><span><b>✓</b> Conexão HTTPS ativa</span><span><b>✓</b> Atualização em tempo real monitorada</span></div></section>
    </>}
    {tab === "Permissões" && <section className="panel records-panel"><div className="records-header"><div><h2>Permissões dos usuários</h2><p>{activeUsers} autorizados • {blockedUsers} bloqueados</p></div><Users size={20}/></div>{profiles.length ? <div className="finance-rows">{profiles.map((user) => { const admin = /admin|administrador/i.test(user.role || ""); const blocked = /blocked|bloqueado/i.test(user.status || ""); const pendingUser = /pending|pendente|aguardando/i.test(user.status || ""); return <div className="finance-row" key={user.id}><div><b>{user.full_name || user.email}</b><span>{user.email} • {admin ? "Administrador" : "Usuário básico"}</span></div><strong className={blocked ? "negative" : pendingUser ? "pending" : "positive"}>{blocked ? "Bloqueado" : pendingUser ? "Pendente" : "Autorizado"}</strong><div className="stock-actions">{pendingUser ? <button className="primary-btn" onClick={() => void updatePermission(user, { status: "authorized" })}>Autorizar acesso</button> : <button className="google-btn" onClick={() => void updatePermission(user, { status: blocked ? "authorized" : "blocked" })}>{blocked ? "Autorizar" : "Bloquear"}</button>}<button className="primary-btn" onClick={() => void updatePermission(user, { role: admin ? "user" : "admin", status: "authorized" })}>{admin ? "Tornar básico" : "Tornar admin"}</button></div></div>; })}</div> : <EmptyState icon={Users} title="Nenhum perfil disponível" text="Os usuários cadastrados aparecerão aqui." />}</section>}
    {tab === "Auditoria" && <section className="panel records-panel"><div className="records-header"><div><h2>Auditoria em tempo real</h2><p>{filteredLogs.length} evento(s) • canal {realtimeStatus.toLowerCase()}</p></div><div className="filter-search"><Search size={16}/><input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Pesquisar módulo ou ação..." /></div></div>{filteredLogs.length ? <div className="finance-rows audit-live-list">{filteredLogs.map((log) => <div className="finance-row" key={log.id}><div><b>{log.module || "Sistema"}</b><span>{log.description || log.action}</span></div><strong>{log.action}</strong><small>{new Date(log.created_at).toLocaleString("pt-BR")}</small></div>)}</div> : <EmptyState icon={Activity} title="Nenhum evento encontrado" text="Os novos eventos aparecerão automaticamente." />}</section>}
  </div>;
}
function ModuleView({
  client,
  active,
  configured,
  query,
  isAdmin,
}: {
  client: SupabaseClient | null;
  active: Module;
  configured: boolean;
  query: string;
  isAdmin: boolean;
}) {
  const [results, setResults] = useState<
    {
      id: string;
      name?: string;
      document?: string;
      email?: string;
      phone?: string;
    }[]
  >([]);
  const [formOpen, setFormOpen] = useState(false);
  useEffect(() => {
    if (!client || active !== "Clientes" || !query.trim()) {
      setResults([]);
      return;
    }
    let mounted = true;
    const safeQuery = query.trim().replace(/[(),]/g, " ");
    const load = async () => {
      const { data } = await client
        .from("customers")
        .select("id, name, document, email, phone")
        .or(`name.ilike.%${safeQuery}%,document.ilike.%${safeQuery}%`)
        .limit(20);
      if (mounted) setResults((data ?? []) as typeof results);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [client, active, query]);
  if (adminModules.has(active) && !isAdmin)
    return <AccessStatus title="Acesso restrito" message="Esta área está disponível somente para administradores." />;
  if (active === "Estoque")
    return <StockWorkspace client={client} configured={configured} />;
  if (active === "Financeiro")
    return <FinanceWorkspace client={client} configured={configured} />;
  if (active === "Clientes" || active === "Fornecedores" || active === "Produtos")
    return <EntityWorkspace client={client} active={active} query={query} />;
  if (active === "Gestão de Usuários") return <UserManagement client={client} />;
  if (active === "Relatórios") return <GeneralReports client={client} />;
  if (active === "Configurações") return <AdminWorkspace client={client} />;
  const descriptions: Record<string, string> = {
    Estoque: "Controle produtos, inventário e movimentações.",
    Financeiro: "Acompanhe receitas, despesas e contas pendentes.",
    Clientes: "Organize o relacionamento e o histórico dos clientes.",
    Fornecedores: "Centralize fornecedores e histórico de compras.",
    Produtos: "Cadastre produtos, preços e estoque mínimo.",
    "Gestão de Usuários": "Aprove, bloqueie e defina permissões de acesso.",
    Relatórios: "Gere relatórios reais por período e módulo.",
    Configurações: "Configure segurança, permissões e acompanhe a auditoria.",
  };
  return (
    <>
      <div className="module-toolbar">
        <div className="module-description">
          <span className="real-tag">DADOS REAIS</span>
          <p>{descriptions[active]}</p>
        </div>
        <button className="primary-btn" onClick={() => setFormOpen(true)}>
          <Plus size={17} /> Novo registro
        </button>
      </div>
      <section className="panel records-panel">
        <div className="records-header">
          <div>
            <h2>{active}</h2>
            <p>
              {configured
                ? "Consulta conectada ao Supabase"
                : "Conecte o Supabase para consultar registros"}
            </p>
          </div>
          <div className="filter-search">
            <Search size={16} />
            <input
              placeholder={
                active === "Clientes"
                  ? "Nome ou CPF/CNPJ"
                  : `Pesquisar em ${active.toLowerCase()}...`
              }
              value={query}
              readOnly
            />
          </div>
        </div>
        {active === "Clientes" && query.trim() ? (
          results.length ? (
            <div className="customer-results">
              {results.map((item) => (
                <div className="customer-result" key={item.id}>
                  <div className="avatar">
                    {(item.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <b>{item.name || "Sem nome"}</b>
                    <span>
                      {item.document ||
                        item.email ||
                        item.phone ||
                        "Sem documento informado"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Nenhum cliente encontrado"
              text="Confira o nome ou CPF/CNPJ informado."
            />
          )
        ) : (
          <EmptyState
            icon={
              active === "Produtos"
                ? Package
                : active === "Clientes"
                  ? Users
                  : FileBarChart
            }
            title={
              configured
                ? "Nenhum registro encontrado"
                : "Módulo aguardando conexão"
            }
            text={
              configured
                ? "Comece criando o primeiro registro deste módulo."
                : "Nenhum dado fictício será exibido. Configure o Supabase para começar."
            }
          />
        )}
      </section>
      {formOpen && (
        <RecordForm
          client={client}
          active={active}
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
        />
      )}
    </>
  );
}

function RecordForm({
  client,
  active,
  financeMode = "launch",
  initialData = null,
  recordId,
  onClose,
  onSaved,
}: {
  client: SupabaseClient | null;
  active: Module;
  financeMode?: "launch" | "payable" | "receivable";
  initialData?: Record<string, unknown> | null;
  recordId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialAddress = initialData?.address && typeof initialData.address === "object" ? initialData.address as Record<string,unknown> : {};
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries({
    ...(initialData || {}),
    cep: initialAddress.cep,
    address: initialAddress.text,
    number: initialAddress.number,
    complement: initialAddress.complement,
    neighborhood: initialAddress.neighborhood,
    city: initialAddress.city,
    state: initialAddress.state,
  }).filter(([key,value]) => key !== "id" && value != null && typeof value !== "object").map(([key,value]) => [key,String(value)])));
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const fields: Record<
    string,
    { key: string; label: string; type?: string }[]
  > = {
    Estoque: [
      { key: "name", label: "Nome do produto" },
      { key: "code", label: "Código" },
      { key: "category", label: "Categoria" },
      { key: "unit", label: "Unidade" },
      { key: "stock", label: "Estoque atual", type: "number" },
      { key: "minimum_stock", label: "Estoque mínimo", type: "number" },
    ],
    Produtos: [
      { key: "name", label: "Nome do produto" },
      { key: "code", label: "Código comercial / SKU" },
      { key: "description", label: "Descrição comercial" },
      { key: "category", label: "Categoria" },
      { key: "unit", label: "Unidade de medida (un, kg, cx)" },
      { key: "cost_price", label: "Preço de custo", type: "number" },
      { key: "sale_price", label: "Preço de venda", type: "number" },
    ],
    Clientes: [
      { key: "name", label: "Nome completo" },
      { key: "document", label: "CPF/CNPJ" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "phone", label: "Telefone" },
      { key: "cep", label: "CEP" },
      { key: "address", label: "Endereço / logradouro" },
      { key: "number", label: "Nº" },
      { key: "complement", label: "Complemento" },
      { key: "neighborhood", label: "Bairro" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado" },
    ],
    Fornecedores: [
      { key: "name", label: "Razão social ou nome" },
      { key: "document", label: "CNPJ/CPF" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "phone", label: "Telefone" },
      { key: "cep", label: "CEP" },
      { key: "address", label: "Endereço / logradouro" },
      { key: "number", label: "Nº" },
      { key: "complement", label: "Complemento" },
      { key: "neighborhood", label: "Bairro" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "Estado" },
    ],
    Financeiro: [
      { key: "type", label: "Lançamento: receita ou despesa" },
      { key: "description", label: "Descrição" },
      { key: "amount", label: "Valor", type: "number" },
      { key: "category", label: "Categoria" },
      { key: "due_date", label: "Vencimento", type: "date" },
    ],
  };
  const accountFields = [
    { key: "description", label: financeMode === "payable" ? "Conta ou fornecedor" : "Cliente ou cobrança" },
    { key: "amount", label: "Valor", type: "number" },
    { key: "due_date", label: "Vencimento", type: "date" },
  ];
  const moduleFields = active === "Financeiro" && financeMode !== "launch"
    ? accountFields
    : fields[active] ?? [];
  const isProduct = active === "Produtos";
  const financeExpenseCategories = [
    "Alimentação",
    "Transporte",
    "Saúde",
    "Lazer",
    "Compras",
    "Serviços",
    "Energia",
    "Água",
    "Internet",
    "Telefone",
    "IPTV",
  ];
  const financeRevenueCategories = [
    "Aluguel",
    "Salário",
    "Serviços",
    "Investimentos",
    "Freelance",
  ];
  const parseNumber = (value?: string) => {
    const normalized = String(value || "0").trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  async function lookupCep(rawCep: string) {
    if (active !== "Clientes" && active !== "Fornecedores") return;
    const cep = rawCep.replace(/\D/g, "");
    if (!cep) { setCepMessage(""); return; }
    if (cep.length !== 8) { setCepMessage("Digite um CEP válido com 8 números."); return; }
    setCepBusy(true);
    setCepMessage("Consultando CEP...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("Falha na consulta");
      const data = await response.json() as { erro?: boolean; cep?: string; logradouro?: string; complemento?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) { setCepMessage("CEP não encontrado."); return; }
      setValues((current) => ({
        ...current,
        cep: data.cep || rawCep,
        address: data.logradouro || current.address || "",
        complement: data.complemento || current.complement || "",
        neighborhood: data.bairro || current.neighborhood || "",
        city: data.localidade || current.city || "",
        state: data.uf || current.state || "",
      }));
      setCepMessage("Endereço localizado. Confira e informe o número.");
    } catch {
      setCepMessage("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.");
    } finally {
      setCepBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) {
      setError("Supabase não conectado.");
      return;
    }
    if (
      active === "Gestão de Usuários" ||
      active === "Relatórios" ||
      active === "Configurações"
    ) {
      setError(
        active === "Gestão de Usuários"
          ? "Novos usuários devem usar Criar acesso para entrar no Supabase Auth."
          : "Este módulo não possui cadastro manual.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const table =
      active === "Clientes"
        ? "customers"
        : active === "Fornecedores"
          ? "suppliers"
          : active === "Financeiro"
            ? "financial_entries"
            : "products";
    const { cep, city, state, address, number, complement, neighborhood, ...baseValues } = values;
    const payload = {
      ...baseValues,
      ...(active === "Clientes" || active === "Fornecedores"
        ? {
            address:
              address || number || complement || neighborhood || cep || city || state
                ? {
                    text: address || "",
                    number: number || "",
                    complement: complement || "",
                    neighborhood: neighborhood || "",
                    cep: cep || "",
                    city: city || "",
                    state: state || "",
                  }
                : null,
          }
        : {}),
      ...(active === "Financeiro"
        ? {
            type: financeMode === "payable" ? "expense" : financeMode === "receivable" ? "income" : values.type === "expense" ? "expense" : "income",
            entry_type: financeMode === "payable" ? "expense" : financeMode === "receivable" ? "income" : values.type === "expense" ? "expense" : "income",
            amount: parseNumber(values.amount),
            status: "pending",
          }
        : {}),
      ...(active === "Produtos" || active === "Estoque"
        ? {
            stock: parseNumber(values.stock),
            minimum_stock: parseNumber(values.minimum_stock),
            cost_price: parseNumber(values.cost_price),
            sale_price: parseNumber(values.sale_price),
            unit: values.unit || "un",
          }
        : {}),
    };
    const { data: userData } = await client.auth.getUser();
    const createdBy = userData.user?.id ? { created_by: userData.user.id } : {};
    let imageUrl: string | null = null;
    if ((active === "Produtos" || active === "Estoque") && photo) {
      const filePath = `${userData.user?.id || "anonymous"}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await client.storage
        .from("product-images")
        .upload(filePath, photo, { upsert: false });
      if (uploadError) {
        console.warn("Foto não enviada; o cadastro continuará sem imagem:", uploadError.message);
      } else {
        const { data: publicData } = client.storage
          .from("product-images")
          .getPublicUrl(filePath);
        imageUrl = publicData.publicUrl;
      }
    }
    const productPayload = imageUrl
      ? { ...payload, image_url: imageUrl }
      : payload;
    const savePayload = {
      ...(active === "Produtos" || active === "Estoque" ? productPayload : payload),
      ...(recordId ? {} : createdBy),
    };
    const compatiblePayload = { ...savePayload } as Record<string, unknown>;
    let saveError: { message: string } | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = recordId
        ? await client.from(table).update(compatiblePayload).eq("id", recordId)
        : await client.from(table).insert(compatiblePayload);
      saveError = result.error;
      if (!saveError) break;
      const missingColumn = saveError.message.match(/(?:Could not find|column)\s+(?:the\s+)?['\"]?([a-z_]+)['\"]?(?:\s+column)?/i)?.[1]
        || saveError.message.match(/['\"]([a-z_]+)['\"] column/i)?.[1];
      if (!missingColumn || !(missingColumn in compatiblePayload)) break;
      if (table === "products" && missingColumn === "code" && !("sku" in compatiblePayload)) {
        compatiblePayload.sku = compatiblePayload.code;
      }
      delete compatiblePayload[missingColumn];
    }
    if (saveError) {
      setError(saveError.message.includes("row-level security") ? "Seu usuário não possui permissão de gravação neste módulo. A política de acesso do banco precisa ser atualizada." : saveError.message);
      setBusy(false);
      return;
    }
    if (userData.user?.id)
      await client.from("audit_logs").insert({
        user_id: userData.user.id,
        action: recordId ? "update" : "create",
        module: active,
        description: recordId ? `Registro atualizado em ${active}` : `Novo registro criado em ${active}`,
      });
    setBusy(false);
    onSaved();
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="record-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-title"
      >
        <div className="modal-head">
          <div>
            <span className="real-tag">DADOS REAIS</span>
            <h2 id="record-title">{recordId ? `Editar registro: ${active}` : active === "Financeiro" ? financeMode === "payable" ? "Nova conta a pagar" : financeMode === "receivable" ? "Nova conta a receber" : "Novo lançamento" : `Novo registro: ${active}`}</h2>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {moduleFields.length ? (
          <form onSubmit={submit}>
            {moduleFields.map((field) => (
              <label key={field.key}>
                {field.label}
                {active === "Financeiro" && financeMode === "launch" && field.key === "type" ? (
                  <select
                    required
                    value={values[field.key] || ""}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [field.key]: e.target.value,
                        category: "",
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                ) : active === "Financeiro" && financeMode === "launch" && field.key === "category" ? (
                  <select
                    required
                    value={values[field.key] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.key]: e.target.value })
                    }
                  >
                    <option value="">Selecione uma categoria</option>
                    {(values.type === "income"
                      ? financeRevenueCategories
                      : financeExpenseCategories
                    ).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                ) : field.key === "cep" && (active === "Clientes" || active === "Fornecedores") ? (
                  <input
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                    value={values[field.key] || ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                      setValues({ ...values, cep: formatted });
                      setCepMessage("");
                    }}
                    onBlur={(e) => void lookupCep(e.target.value)}
                    disabled={cepBusy}
                  />
                ) : ["amount", "cost_price", "sale_price"].includes(field.key) ? (
                  <input
                    required={field.key === "amount"}
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={values[field.key] || ""}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                ) : (
                  <input
                    required={
                      field.key === "name" ||
                      field.key === "description" ||
                      field.key === "amount" ||
                      (isProduct && field.key === "code")
                    }
                    type={field.type || "text"}
                    value={values[field.key] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.key]: e.target.value })
                    }
                  />
                )}
                {field.key === "cep" && cepMessage && <small className="form-help">{cepMessage}</small>}
              </label>
            ))}
            {isProduct && (
              <>
                <label>
                  Foto do produto
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                <BarcodePreview value={values.code || "ID-PRODUTO"} />
                <small className="form-help">
                  A foto é opcional. Se o armazenamento não estiver configurado,
                  o cadastro será salvo normalmente sem imagem.
                  O ID/código informado será usado no código de barras.
                </small>
              </>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button className="google-btn" type="button" onClick={onClose}>
                Cancelar
              </button>
              <button className="primary-btn" type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar registro"}
              </button>
            </div>
          </form>
        ) : (
          <div className="modal-message">
            <p>
              {active === "Gestão de Usuários"
                ? "Use Criar acesso na tela inicial. O administrador controla permissões após o cadastro."
                : "Os relatórios são gerados a partir dos registros reais dos módulos."}
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" type="button" onClick={onClose}>
              Entendi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function BarcodePreview({ value }: { value: string }) {
  const pattern = value.split("").flatMap((char) => {
    const bits = char.charCodeAt(0).toString(2).padStart(8, "0");
    return bits.split("").map((bit) => bit === "1");
  });
  return (
    <div className="barcode-preview">
      <div className="barcode-bars">
        {pattern.map((dark, index) => (
          <i key={index} className={dark ? "dark" : "light"} />
        ))}
      </div>
      <b>{value}</b>
    </div>
  );
}
function SiteFooter() {
  return (
    <footer className="site-footer">
      <span className="footer-left">© 2026 Fenix Systens CRM</span>
      <span className="footer-center">Copyright Todos os Direitos Reservados</span>
      <span className="footer-right">
        Desenvolvimento{" "}
        <a href="https://fenixsystens.com.br" target="_blank" rel="noreferrer">
          fenixsystens.com.br
        </a>{" "}
        by osmarjr sistemas
      </span>
    </footer>
  );
}
function AccessStatus({
  title,
  message,
  onLogout,
}: {
  title: string;
  message: string;
  onLogout?: () => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card" role="status" aria-live="polite">
        <div className="brand auth-brand">
          <img src="/fenix-login-logo.png" alt="Fenix Systens CRM" />
        </div>
        <h1>{title}</h1>
        <p className="auth-sub">{message}</p>
        {onLogout && (
          <button className="google-btn" type="button" onClick={onLogout}>
            Sair e entrar novamente
          </button>
        )}
      </section>
    </main>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Package;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={21} />
      </div>
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}
function AuthScreenFields({ client }: { client: SupabaseClient | null }) {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) {
      setError(
        "A conexão com o Supabase ainda não está disponível. Atualize a página.",
      );
      return;
    }
    setError("");
    setMessage("");
    if (signup && pass !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, phone, password: pass }) });
        const result = await response.json() as { error?: string; requiresEmailConfirmation?: boolean; adminNotificationSent?: boolean; profileCreated?: boolean; accessToken?: string | null; refreshToken?: string | null };
        if (!response.ok) { setError(result.error || "Não foi possível concluir o cadastro."); return; }
        if (result.accessToken && result.refreshToken) await client.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
        setMessage(result.requiresEmailConfirmation ? "Cadastro concluído. Verifique seu e-mail para confirmar a conta. Depois, aguarde a autorização do administrador." : "Cadastro concluído. Aguarde a autorização do administrador.");
        setName("");
        setPhone("");
        setEmail("");
        setPass("");
        setConfirm("");
      } else {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (result.error) setError(result.error.message);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a solicitação.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!client) {
      setError(
        "A conexão com o Supabase ainda não está disponível. Atualize a página.",
      );
      return;
    }
    setError("");
    setMessage("");
    setBusy(true);
    const { error: authError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell modern-auth">
      <div className="auth-visual">
        <img src="/fenix-logo.png" className="watermark-logo" alt="" />
        <div className="visual-copy">
          <div className="brand">
            <div className="brand-mark">
              <Zap size={18} />
            </div>
            <div>
              <strong>FENIX</strong>
              <span>SYSTENS CRM</span>
            </div>
          </div>
          <div className="eyebrow light">GESTÃO INTELIGENTE</div>
          <h1>
            Controle sua operação
            <br />
            com clareza.
          </h1>
          <p>
            Clientes, oportunidades, atividades e segurança em um único painel
            administrativo.
          </p>
        </div>
      </div>
      <div className="auth-card modern-card">
        <h2>{signup ? "Crie seu acesso" : "Bem-vindos"}</h2>
        <p className="auth-sub">
          {signup
            ? "Preencha seus dados para solicitar acesso."
            : "Acesse seu painel administrativo."}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <>
              <label>
                Nome completo
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            E-mail
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {signup && (
            <label>
              Telefone com DDD
              <input
                required
                inputMode="tel"
                maxLength={15}
                placeholder="(48) 99999-9999"
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const formatted = digits.length > 10
                    ? `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`
                    : digits.length > 6 ? `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
                    : digits.length > 2 ? `(${digits.slice(0,2)}) ${digits.slice(2)}`
                    : digits.length ? `(${digits}` : "";
                  setPhone(formatted);
                }}
              />
            </label>
          )}
          <label>
            Senha
            <input
              required
              type="password"
              minLength={6}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
          {!signup && (
            <button type="button" className="signup-link" onClick={() => { setSignup(true); setError(""); setMessage(""); }}>
              Clique aqui e faça o seu cadastro
            </button>
          )}
          {signup && (
            <label>
              Confirme a senha
              <input
                required
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="auth-success" role="status">
              {message}
            </div>
          )}
          <button
            type="submit"
            className="primary-btn auth-submit"
            disabled={busy}
          >
            {busy
              ? "Processando..."
              : signup
                ? "Concluir cadastro"
                : "Entrar no CRM"}
          </button>
        </form>
        <button
          type="button"
          className="google-btn"
          onClick={google}
          disabled={busy}
        >
          {busy ? "Conectando..." : "Continuar com Google"}
        </button>
        {signup && <button type="button" className="signup-link back-login" onClick={() => { setSignup(false); setError(""); setMessage(""); }}>Voltar para entrar</button>}
      </div>
    </main>
  );
}
