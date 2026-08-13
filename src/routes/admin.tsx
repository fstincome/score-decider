import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Trophy,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_CRITERIA, buildRanking, totalMax } from "@/lib/scoring";
import { useCompetition, useCompetitions } from "@/lib/useCompetition";
import { listJuryCodes, setJuryCode } from "@/lib/access.functions";
import { clearSession, readSession } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Compétitions & jurys" },
      {
        name: "description",
        content:
          "Créez des compétitions, gérez les critères, les quotas de points, les équipes et les jurés.",
      },
      { property: "og:title", content: "Administration — Compétitions & jurys" },
      {
        property: "og:description",
        content: "Pilotage complet des compétitions, critères, équipes et jurés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    setReady(true);
    if (!s || s.role !== "admin") navigate({ to: "/login" });
    else setAdminCode(s.code);
  }, [navigate]);

  const { competitions } = useCompetitions();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && competitions.length) setSelected(competitions[0].id);
  }, [competitions, selected]);

  const { competition, criteria, teams, juries, scores } = useCompetition(selected);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [newComp, setNewComp] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newCrit, setNewCrit] = useState({ label: "", max: "10" });
  const [newJury, setNewJury] = useState({ name: "", code: "", president: false });

  const refreshCodes = async () => {
    if (!adminCode || !selected) return;
    try {
      const rows = await listJuryCodes({ data: { adminCode, competitionId: selected } });
      setCodes(Object.fromEntries(rows.map((r) => [r.jury_id, r.code])));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    refreshCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminCode, selected, juries.length]);

  const createCompetition = async () => {
    const name = newComp.trim();
    if (!name) return toast.error("Nom de la compétition requis.");
    const { data, error } = await supabase
      .from("competitions")
      .insert({ name })
      .select("id")
      .maybeSingle();
    if (error || !data) return toast.error("Erreur : " + (error?.message ?? ""));
    await supabase.from("criteria").insert(
      DEFAULT_CRITERIA.map((c, i) => ({
        competition_id: data.id,
        label: c.label,
        max_points: c.max_points,
        position: i,
      })),
    );
    setNewComp("");
    setSelected(data.id);
    toast.success("Compétition créée avec les critères par défaut.");
  };

  const deleteCompetition = async (id: string, name: string) => {
    if (!confirm(`Supprimer « ${name} » et toutes ses données ?`)) return;
    const { error } = await supabase.from("competitions").delete().eq("id", id);
    if (error) return toast.error("Erreur : " + error.message);
    setSelected(null);
    toast.success("Compétition supprimée");
  };

  const toggleLock = async () => {
    if (!competition) return;
    const { error } = await supabase
      .from("competitions")
      .update({ locked: !competition.locked })
      .eq("id", competition.id);
    if (error) toast.error("Erreur : " + error.message);
  };

  const renameCompetition = async (name: string) => {
    if (!competition) return;
    await supabase.from("competitions").update({ name }).eq("id", competition.id);
  };

  const addCriterion = async () => {
    if (!selected) return;
    const label = newCrit.label.trim();
    const max = parseFloat(newCrit.max);
    if (!label || isNaN(max) || max <= 0) return toast.error("Libellé et points requis.");
    const { error } = await supabase.from("criteria").insert({
      competition_id: selected,
      label,
      max_points: max,
      position: criteria.length,
    });
    if (error) return toast.error("Erreur : " + error.message);
    setNewCrit({ label: "", max: "10" });
    toast.success("Critère ajouté");
  };

  const updateCriterion = async (id: string, patch: { label?: string; max_points?: number }) => {
    await supabase.from("criteria").update(patch).eq("id", id);
  };

  const deleteCriterion = async (id: string, label: string) => {
    if (!confirm(`Supprimer le critère « ${label} » et les notes associées ?`)) return;
    await supabase.from("criteria").delete().eq("id", id);
  };

  const addTeam = async () => {
    if (!selected) return;
    const name = newTeam.trim();
    if (!name) return toast.error("Nom d'équipe requis.");
    const nextNum = teams.reduce((m, t) => Math.max(m, t.project_number), 0) + 1;
    const { error } = await supabase
      .from("teams")
      .insert({ competition_id: selected, project_number: nextNum, name });
    if (error) return toast.error("Erreur : " + error.message);
    setNewTeam("");
  };

  const addJury = async () => {
    if (!selected || !adminCode) return;
    const name = newJury.name.trim();
    if (!name) return toast.error("Nom du juré requis.");
    if (!/^\d{3,8}$/.test(newJury.code.trim()))
      return toast.error("Code : 3 à 8 chiffres.");
    const { data, error } = await supabase
      .from("juries")
      .insert({ competition_id: selected, name, is_president: newJury.president })
      .select("id")
      .maybeSingle();
    if (error || !data) return toast.error("Erreur : " + (error?.message ?? ""));
    try {
      await setJuryCode({
        data: { adminCode, juryId: data.id, code: newJury.code.trim() },
      });
    } catch (e) {
      await supabase.from("juries").delete().eq("id", data.id);
      return toast.error((e as Error).message);
    }
    setNewJury({ name: "", code: "", president: false });
    refreshCodes();
    toast.success("Juré ajouté");
  };

  const changeCode = async (juryId: string, code: string) => {
    if (!adminCode) return;
    try {
      await setJuryCode({ data: { adminCode, juryId, code } });
      refreshCodes();
      toast.success("Code mis à jour");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const ranking = buildRanking(teams, criteria, scores).sort((a, b) => b.avg - a.avg);

  if (!ready || !adminCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="border-b bg-gradient-to-br from-primary to-[color:var(--primary-glow)] text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/" className="text-xs opacity-80 hover:opacity-100">
              <ArrowLeft className="mr-1 inline h-3 w-3" /> Classement public
            </Link>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Administration</h1>
            <p className="text-xs opacity-90">
              {competitions.length} compétition{competitions.length > 1 ? "s" : ""} · vue complète
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              clearSession();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Quitter
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Compétitions</h2>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Input
              placeholder="Nom de la nouvelle compétition"
              value={newComp}
              onChange={(e) => setNewComp(e.target.value)}
            />
            <Button onClick={createCompetition}>
              <Plus className="mr-2 h-4 w-4" /> Créer
            </Button>
          </div>
          <div className="mt-4 divide-y">
            {competitions.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2">
                <Button
                  variant={selected === c.id ? "default" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => setSelected(c.id)}
                >
                  {c.name}
                </Button>
                {c.locked && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                    <Lock className="h-3 w-3" /> clôturée
                  </span>
                )}
                <div className="flex-1" />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteCompetition(c.id, c.name)}
                  aria-label="Supprimer la compétition"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {competition && (
          <>
            <Card className="space-y-3 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Nom de la compétition</Label>
                  <Input
                    defaultValue={competition.name}
                    key={competition.id}
                    onBlur={(e) => renameCompetition(e.target.value.trim() || competition.name)}
                  />
                </div>
                <Button variant={competition.locked ? "outline" : "destructive"} onClick={toggleLock}>
                  {competition.locked ? (
                    <>
                      <Unlock className="mr-2 h-4 w-4" /> Rouvrir
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" /> Clôturer
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Total maximum : {totalMax(criteria)} points
              </p>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold">Critères & quotas</h2>
              <div className="mt-3 space-y-2">
                {criteria.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Input
                      defaultValue={c.label}
                      onBlur={(e) => updateCriterion(c.id, { label: e.target.value.trim() || c.label })}
                    />
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      defaultValue={Number(c.max_points)}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) updateCriterion(c.id, { max_points: v });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteCriterion(c.id, c.label)}
                      aria-label="Supprimer le critère"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    placeholder="Nouveau critère"
                    value={newCrit.label}
                    onChange={(e) => setNewCrit((n) => ({ ...n, label: e.target.value }))}
                  />
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={newCrit.max}
                    onChange={(e) => setNewCrit((n) => ({ ...n, max: e.target.value }))}
                  />
                  <Button onClick={addCriterion}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold">Équipes</h2>
              <div className="mt-3 space-y-2">
                {teams.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-8 font-mono text-xs text-muted-foreground">
                      {t.project_number}
                    </span>
                    <Input
                      defaultValue={t.name}
                      onBlur={(e) =>
                        supabase
                          .from("teams")
                          .update({ name: e.target.value.trim() || t.name })
                          .eq("id", t.id)
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Supprimer « ${t.name} » ?`)) return;
                        await supabase.from("teams").delete().eq("id", t.id);
                      }}
                      aria-label="Supprimer l'équipe"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    placeholder="Nouvelle équipe"
                    value={newTeam}
                    onChange={(e) => setNewTeam(e.target.value)}
                  />
                  <Button onClick={addTeam}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold">Jurés & codes d'accès</h2>
              <div className="mt-3 space-y-2">
                {juries.map((j) => (
                  <div key={j.id} className="flex flex-wrap items-center gap-2">
                    <Input
                      defaultValue={j.name}
                      className="flex-1"
                      onBlur={(e) =>
                        supabase
                          .from("juries")
                          .update({ name: e.target.value.trim() || j.name })
                          .eq("id", j.id)
                      }
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={j.is_president}
                        onChange={(e) =>
                          supabase
                            .from("juries")
                            .update({ is_president: e.target.checked })
                            .eq("id", j.id)
                        }
                      />
                      Président
                    </label>
                    <Input
                      className="w-28 text-center tracking-widest"
                      defaultValue={codes[j.id] ?? ""}
                      key={codes[j.id] ?? j.id}
                      placeholder="code"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== codes[j.id]) changeCode(j.id, v);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Supprimer le juré « ${j.name} » ?`)) return;
                        await supabase.from("juries").delete().eq("id", j.id);
                        refreshCodes();
                      }}
                      aria-label="Supprimer le juré"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Input
                    placeholder="Nom du juré"
                    className="flex-1"
                    value={newJury.name}
                    onChange={(e) => setNewJury((n) => ({ ...n, name: e.target.value }))}
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={newJury.president}
                      onChange={(e) => setNewJury((n) => ({ ...n, president: e.target.checked }))}
                    />
                    Président
                  </label>
                  <Input
                    className="w-28 text-center tracking-widest"
                    placeholder="code"
                    value={newJury.code}
                    onChange={(e) => setNewJury((n) => ({ ...n, code: e.target.value }))}
                  />
                  <Button onClick={addJury}>
                    <KeyRound className="mr-2 h-4 w-4" /> Ajouter
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-0">
              <div className="flex items-center gap-2 border-b px-5 py-3">
                <Trophy className="h-4 w-4 text-[color:var(--gold)]" />
                <h2 className="text-sm font-semibold">Résultats (vue complète)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Rang</th>
                      <th className="px-3 py-2 text-left">Équipe</th>
                      {juries.map((j) => (
                        <th key={j.id} className="px-2 py-2 text-center">
                          {j.name}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={r.team.id} className="border-t">
                        <td className="px-3 py-2 font-semibold">{i + 1}</td>
                        <td className="px-3 py-2">
                          {r.team.name}{" "}
                          <span className="text-xs text-muted-foreground">n°{r.team.project_number}</span>
                        </td>
                        {juries.map((j) => {
                          const tot = scores
                            .filter((s) => s.jury_id === j.id && s.team_id === r.team.id)
                            .reduce((s, x) => s + Number(x.value || 0), 0);
                          const has = scores.some(
                            (s) => s.jury_id === j.id && s.team_id === r.team.id,
                          );
                          return (
                            <td key={j.id} className="px-2 py-2 text-center tabular-nums">
                              {has ? tot.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold tabular-nums">
                          {r.avg.toFixed(1)} <span className="text-xs font-normal">/{r.max}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
