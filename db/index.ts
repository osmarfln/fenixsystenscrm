import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export async function getDb() {
  const { env } = await import("cloudflare:workers");

  if (!env.DB) {
    throw new Error(
      "Binding D1 `DB` indisponível. Confirme .openai/hosting.json com d1=DB e publique o Site novamente.",
    );
  }

  return drizzle(env.DB, { schema });
}
