import { createServerFn } from "@tanstack/react-start";

type LoginResult =
  | { ok: false }
  | { ok: true; role: "admin" }
  | {
      ok: true;
      role: "jury";
      juryId: string;
      juryName: string;
      isPresident: boolean;
      competitionId: string;
    };

export const loginWithCode = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({
    code: String(input?.code ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    if (!data.code) return { ok: false };
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row } = await supabaseAdmin
      .from("access_codes")
      .select("role, jury_id")
      .eq("code", data.code)
      .maybeSingle();
    if (!row) return { ok: false };
    if (row.role === "admin") return { ok: true, role: "admin" };
    if (!row.jury_id) return { ok: false };
    const { data: jury } = await supabaseAdmin
      .from("juries")
      .select("id, name, is_president, competition_id")
      .eq("id", row.jury_id)
      .maybeSingle();
    if (!jury) return { ok: false };
    return {
      ok: true,
      role: "jury",
      juryId: jury.id,
      juryName: jury.name,
      isPresident: jury.is_president,
      competitionId: jury.competition_id,
    };
  });

async function assertAdmin(code: string) {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { data } = await supabaseAdmin
    .from("access_codes")
    .select("role")
    .eq("code", String(code ?? "").trim())
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Accès administrateur refusé");
  return supabaseAdmin;
}

/** Liste les codes des jurés d'une compétition (admin uniquement). */
export const listJuryCodes = createServerFn({ method: "POST" })
  .inputValidator((input: { adminCode: string; competitionId: string }) => ({
    adminCode: String(input?.adminCode ?? ""),
    competitionId: String(input?.competitionId ?? ""),
  }))
  .handler(async ({ data }) => {
    const admin = await assertAdmin(data.adminCode);
    const { data: juries } = await admin
      .from("juries")
      .select("id")
      .eq("competition_id", data.competitionId);
    const ids = (juries ?? []).map((j) => j.id);
    if (ids.length === 0) return [] as { jury_id: string; code: string }[];
    const { data: codes } = await admin
      .from("access_codes")
      .select("jury_id, code")
      .in("jury_id", ids);
    return (codes ?? []).map((c) => ({
      jury_id: c.jury_id as string,
      code: c.code as string,
    }));
  });

/** Crée / met à jour le code d'accès d'un juré (admin uniquement). */
export const setJuryCode = createServerFn({ method: "POST" })
  .inputValidator((input: { adminCode: string; juryId: string; code: string }) => ({
    adminCode: String(input?.adminCode ?? ""),
    juryId: String(input?.juryId ?? ""),
    code: String(input?.code ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const admin = await assertAdmin(data.adminCode);
    if (!/^\d{3,8}$/.test(data.code)) {
      throw new Error("Le code doit contenir 3 à 8 chiffres");
    }
    const { data: existing } = await admin
      .from("access_codes")
      .select("id, jury_id")
      .eq("code", data.code)
      .maybeSingle();
    if (existing && existing.jury_id !== data.juryId) {
      throw new Error("Ce code est déjà utilisé");
    }
    await admin.from("access_codes").delete().eq("jury_id", data.juryId);
    const { error } = await admin
      .from("access_codes")
      .insert({ code: data.code, role: "jury", jury_id: data.juryId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
