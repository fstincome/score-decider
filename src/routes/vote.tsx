import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { totalMax } from "@/lib/scoring";
import { useCompetition } from "@/lib/useCompetition";
import { clearSession, readSession, type AppSession } from "@/lib/session";

export const Route = createFileRoute("/vote")({
  head: () => ({
    meta: [
      { title: "Espace juré — Saisie des notes" },
      {
        name: "description",
        content:
          "Saisissez vos notes par critère pour chaque équipe de votre compétition.",
      },
      { property: "og:title", content: "Espace juré — Saisie des notes" },
      {
        property: "og:description",
        content: "Notation par critère, en temps réel, pour chaque équipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Vote,
});

const key = (teamId: string, critId: string) => `${teamId}:${critId}`;

function Vote() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AppSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    setReady(true);
    if (!s) navigate({ to: "/login" });
    else if (s.role === "admin") navigate({ to: "/admin" });
  }, [navigate]);

  const competitionId = session?.role === "jury" ? session.competitionId : null;
  const { competition, criteria, teams, scores } = useCompetition(competitionId);

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newTeam, setNewTeam] = useState("");

  const juryId = session?.role === "jury" ? session.juryId : "";
  const isPresident = session?.role === "jury" && session.isPresident;
  const locked = !!competition?.locked;

  useEffect(() => {
    if (!juryId) return;
    const next: Record<string, string> = {};
    for (const t of teams) {
      for (const c of criteria) {
        const s = scores.find(
          (x) => x.jury_id === juryId && x.team_id === t.id && x.criterion_id === c.id,
        );
        next[key(t.id, c.id)] = s ? String(s.value) : "";
      }
    }
    setValues((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, criteria, scores.length, juryId]);

  const totalOf = (teamId: string) =>
    criteria.reduce((s, c) => {
      const v = parseFloat(values[key(teamId, c.id)] || "0");
      return s + (isNaN(v) ? 0 : Math.min(Math.max(v, 0), Number(c.max_points)));
    }, 0);

  const submit = async () => {
    if (!competitionId || !juryId) return;
    if (locked) return toast.error("Compétition clôturée par le Président.");
    setSaving(true);
    const payload = teams.flatMap((t) =>
      criteria.map((c) => {
        const raw = parseFloat(values[key(t.id, c.id)] || "0");
        const v = isNaN(raw) ? 0 : Math.min(Math.max(raw, 0), Number(c.max_points));
        return {
          competition_id: competitionId,
          jury_id: juryId,
          team_id: t.id,
          criterion_id: c.id,
          value: v,
        };
      }),
    );
    const { error } = await supabase
      .from("scores")
      .upsert(payload, { onConflict: "jury_id,team_id,criterion_id" });
    setSaving(false);
    if (error) toast.error("Erreur d'envoi : " + error.message);
    else toast.success(`Notes envoyées ✓ (${teams.length} équipes)`);
  };

  const toggleLock = async () => {
    if (!competitionId) return;
    const next = !locked;
    const { error } = await supabase
      .from("competitions")
      .update({ locked: next })
      .eq("id", competitionId);
    if (error) return toast.error("Erreur : " + error.message);
    toast.success(next ? "Compétition clôturée 🏆" : "Modifications rouvertes");
  };

  const addTeam = async () => {
    const name = newTeam.trim();
    if (!competitionId || !name) return toast.error("Indiquez un nom d'équipe.");
    if (locked) return toast.error("Compétition clôturée.");
    const nextNum = teams.reduce((m, t) => Math.max(m, t.project_number), 0) + 1;
    const { error } = await supabase
      .from("teams")
      .insert({ competition_id: competitionId, project_number: nextNum, name });
    if (error) return toast.error("Erreur : " + error.message);
    setNewTeam("");
    toast.success(`Équipe ajoutée : ${name} (n°${nextNum})`);
  };

  const removeTeam = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'équipe « ${name} » et toutes ses notes ?`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) toast.error("Erreur : " + error.message);
    else toast.success("Équipe supprimée");
  };

  const logout = () => {
    clearSession();
    navigate({ to: "/login" });
  };

  if (!ready || !session || session.role !== "jury") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  const max = totalMax(criteria);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="border-b bg-gradient-to-br from-primary to-[color:var(--primary-glow)] text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/" className="text-xs opacity-80 hover:opacity-100">
              <ArrowLeft className="mr-1 inline h-3 w-3" /> Classement
            </Link>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">
              Mes notes — {session.juryName}
            </h1>
            <p className="text-xs opacity-90">
              {competition?.name ?? "…"} · {teams.length} équipe
              {teams.length > 1 ? "s" : ""} · noté sur {max}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium">
                <Lock className="h-3 w-3" /> Clôturé
              </span>
            )}
            {isPresident && (
              <Button size="lg" variant={locked ? "outline" : "destructive"} onClick={toggleLock}>
                {locked ? (
                  <>
                    <Unlock className="mr-2 h-4 w-4" /> Rouvrir
                  </>
                ) : (
                  <>
                    <Megaphone className="mr-2 h-4 w-4" /> Clôturer & proclamer
                  </>
                )}
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={submit} disabled={saving || locked}>
              <Send className="mr-2 h-4 w-4" />
              {saving ? "Envoi..." : "Envoyer"}
            </Button>
            <Button size="icon" variant="ghost" onClick={logout} aria-label="Se déconnecter">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {locked && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <Lock className="h-4 w-4" /> Compétition clôturée — saisie désactivée.
          </div>
        )}

        {isPresident && (
          <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
            <Input
              placeholder="Nom d'une nouvelle équipe"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              disabled={locked}
            />
            <Button onClick={addTeam} disabled={locked}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter une équipe
            </Button>
          </Card>
        )}

        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Équipe</th>
                {criteria.map((c) => (
                  <th key={c.id} className="px-2 py-2 text-center">
                    {c.label}
                    <div className="font-normal normal-case">/{Number(c.max_points)}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center">Total</th>
                {isPresident && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {t.project_number}
                  </td>
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  {criteria.map((c) => (
                    <td key={c.id} className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={Number(c.max_points)}
                        step="0.5"
                        disabled={locked}
                        value={values[key(t.id, c.id)] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [key(t.id, c.id)]: e.target.value }))
                        }
                        className="mx-auto w-20 text-center"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">
                    {totalOf(t.id).toFixed(1)}
                  </td>
                  {isPresident && (
                    <td className="px-2 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTeam(t.id, t.name)}
                        aria-label="Supprimer l'équipe"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={criteria.length + 3} className="px-3 py-10 text-center text-muted-foreground">
                    Aucune équipe pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
