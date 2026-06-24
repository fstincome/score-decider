import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Send,
  Lock,
  Unlock,
  Megaphone,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRITERIA, JURY_NAMES, PRESIDENT_JURY } from "@/lib/scoring";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/vote")({
  head: () => ({
    meta: [
      { title: "Espace Juré — Saisie des notes" },
      { name: "description", content: "Saisissez et envoyez vos notes pour chaque projet." },
    ],
  }),
  component: Vote,
});

type Project = { project_number: number; name: string };
type Row = {
  project_number: number;
  project_name: string;
  scores: Record<string, string>;
};

const emptyScores = () =>
  Object.fromEntries(CRITERIA.map((c) => [c.key, ""])) as Record<string, string>;

function Vote() {
  const [jury, setJury] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const isPresident = jury === PRESIDENT_JURY;

  // Load lock + projects + subscribe
  useEffect(() => {
    const loadLock = async () => {
      const { data } = await supabase
        .from("session_settings")
        .select("locked")
        .eq("id", 1)
        .maybeSingle();
      if (data) setLocked(!!data.locked);
    };
    const loadProjects = async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .order("project_number");
      if (data) setProjects(data as Project[]);
    };
    loadLock();
    loadProjects();
    const ch = supabase
      .channel("vote-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_settings" },
        loadLock,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        loadProjects,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Rebuild rows when projects or jury change
  useEffect(() => {
    if (!jury || projects.length === 0) {
      setRows([]);
      return;
    }
    (async () => {
      const { data: evalRows } = await supabase
        .from("evaluations")
        .select("*")
        .eq("jury_name", jury);
      const byNum = new Map<number, any>();
      (evalRows ?? []).forEach((d: any) => byNum.set(d.project_number, d));
      const next: Row[] = projects.map((p) => {
        const ev = byNum.get(p.project_number);
        return {
          project_number: p.project_number,
          project_name: ev?.project_name?.trim() || p.name || `Projet ${p.project_number}`,
          scores: ev
            ? Object.fromEntries(
                CRITERIA.map((c) => [c.key, String(ev[c.key] ?? "")]),
              )
            : emptyScores(),
        };
      });
      setRows(next);
    })();
  }, [jury, projects]);

  const update = (num: number, key: string, value: string) =>
    setRows((rs) =>
      rs.map((r) =>
        r.project_number === num ? { ...r, scores: { ...r.scores, [key]: value } } : r,
      ),
    );
  const updateName = (num: number, value: string) =>
    setRows((rs) =>
      rs.map((r) => (r.project_number === num ? { ...r, project_name: value } : r)),
    );

  const totalOf = (r: Row) =>
    CRITERIA.reduce((s, c) => {
      const v = parseFloat(r.scores[c.key] || "0");
      return s + (isNaN(v) ? 0 : Math.min(v, c.max));
    }, 0);

  const submit = async () => {
    if (!jury) return;
    if (locked) {
      toast.error("Les modifications sont clôturées par le Président.");
      return;
    }
    setSaving(true);
    const payload = rows.map((r) => ({
      jury_name: jury,
      project_number: r.project_number,
      project_name: r.project_name?.trim() || `Projet ${r.project_number}`,
      ...Object.fromEntries(
        CRITERIA.map((c) => {
          const v = parseFloat(r.scores[c.key] || "0");
          return [c.key, isNaN(v) ? 0 : Math.min(Math.max(v, 0), c.max)];
        }),
      ),
    }));
    const { error } = await supabase
      .from("evaluations")
      .upsert(payload, { onConflict: "jury_name,project_number" });
    setSaving(false);
    if (error) toast.error("Erreur d'envoi : " + error.message);
    else toast.success(`Notes envoyées ✓ (${payload.length} projets)`);
  };

  const toggleLock = async () => {
    const next = !locked;
    const { error } = await supabase
      .from("session_settings")
      .update({ locked: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return toast.error("Erreur : " + error.message);
    setLocked(next);
    toast.success(next ? "Session clôturée — résultats proclamés 🏆" : "Modifications rouvertes");
  };

  const addProject = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Indiquez un nom d'équipe.");
    if (locked) return toast.error("Session clôturée.");
    setAdding(true);
    const nextNum =
      projects.reduce((m, p) => Math.max(m, p.project_number), 0) + 1;
    const { error } = await supabase
      .from("projects")
      .insert({ project_number: nextNum, name });
    setAdding(false);
    if (error) return toast.error("Erreur : " + error.message);
    setNewName("");
    toast.success(`Équipe ajoutée : ${name} (n°${nextNum})`);
  };

  const removeProject = async (num: number, name: string) => {
    if (!confirm(`Supprimer l'équipe « ${name} » (n°${num}) et toutes ses notes ?`)) return;
    const { error: e1 } = await supabase
      .from("evaluations")
      .delete()
      .eq("project_number", num);
    if (e1) return toast.error("Erreur notes : " + e1.message);
    const { error: e2 } = await supabase
      .from("projects")
      .delete()
      .eq("project_number", num);
    if (e2) return toast.error("Erreur : " + e2.message);
    toast.success("Équipe supprimée");
  };

  if (!jury) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Toaster richColors />
        <Card className="w-full max-w-md p-6">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-3 w-3" /> Retour
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Espace Juré</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Marketing Digital Competition — sélectionnez qui vous êtes.
          </p>
          {locked && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <Lock className="h-3.5 w-3.5" /> Session clôturée par le Président.
            </div>
          )}
          <div className="mt-6 grid gap-2">
            {JURY_NAMES.map((j) => (
              <Button
                key={j}
                size="lg"
                variant="outline"
                className="justify-start"
                onClick={() => setJury(j)}
              >
                <Check className="mr-2 h-4 w-4" /> Je suis {j}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

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
              Mes notes — {jury}
            </h1>
            <p className="text-xs opacity-90">
              Marketing Digital Competition · {projects.length} projet
              {projects.length > 1 ? "s" : ""} · noté sur 100
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium">
                <Lock className="h-3 w-3" /> Clôturé
              </span>
            )}
            {isPresident && (
              <Button
                size="lg"
                variant={locked ? "outline" : "destructive"}
                onClick={toggleLock}
              >
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {locked && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <Lock className="h-4 w-4" />
            Les modifications sont clôturées par le Président.
          </div>
        )}

        {isPresident && (
          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-semibold">
                Ajouter une équipe (réservé au Président)
              </Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom de la nouvelle équipe"
                  disabled={locked || adding}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addProject();
                  }}
                  className="max-w-md flex-1"
                />
                <Button onClick={addProject} disabled={locked || adding || !newName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  {adding ? "Ajout..." : "Ajouter"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                L'équipe sera ajoutée pour tous les jurés avec le prochain numéro
                disponible.
              </p>
            </div>
          </Card>
        )}

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Nom du projet</th>
                  {CRITERIA.map((c) => (
                    <th key={c.key} className="px-2 py-3 text-center">
                      {c.label}
                      <div className="text-[10px] font-normal normal-case opacity-70">
                        /{c.max}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center">Total</th>
                  {isPresident && <th className="px-2 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.project_number} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {r.project_number}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.project_name}
                        onChange={(e) => updateName(r.project_number, e.target.value)}
                        disabled={locked}
                        className="h-9 min-w-[180px]"
                      />
                    </td>
                    {CRITERIA.map((c) => (
                      <td key={c.key} className="px-1.5 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={c.max}
                          value={r.scores[c.key]}
                          onChange={(e) => update(r.project_number, c.key, e.target.value)}
                          placeholder="0"
                          disabled={locked}
                          className="h-9 w-16 text-center"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex min-w-[48px] items-center justify-center rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                        {totalOf(r)}
                      </span>
                    </td>
                    {isPresident && (
                      <td className="px-2 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={locked}
                          onClick={() => removeProject(r.project_number, r.project_name)}
                          title="Supprimer cette équipe"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={CRITERIA.length + 3 + (isPresident ? 1 : 0)}
                      className="px-3 py-10 text-center text-sm text-muted-foreground"
                    >
                      Aucune équipe enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
            <div>
              <Label className="text-xs text-muted-foreground">Connecté en tant que</Label>
              <div className="font-medium">{jury}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setJury("")}>
                Changer de juré
              </Button>
              <Button onClick={submit} disabled={saving || locked}>
                <Send className="mr-2 h-4 w-4" />
                {saving ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
