import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Send, Lock, Unlock, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CRITERIA,
  JURY_NAMES,
  PROJECT_COUNT,
  PROJECT_NAMES,
  PRESIDENT_JURY,
} from "@/lib/scoring";
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

type Row = {
  project_name: string;
  scores: Record<string, string>;
};

const emptyRows = (): Row[] =>
  Array.from({ length: PROJECT_COUNT }, (_, i) => ({
    project_name: PROJECT_NAMES[i] ?? `Projet ${i + 1}`,
    scores: Object.fromEntries(CRITERIA.map((c) => [c.key, ""])),
  }));

function Vote() {
  const [jury, setJury] = useState<string>("");
  const [rows, setRows] = useState<Row[]>(emptyRows());
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  const isPresident = jury === PRESIDENT_JURY;

  useEffect(() => {
    const loadLock = async () => {
      const { data } = await supabase
        .from("session_settings")
        .select("locked")
        .eq("id", 1)
        .maybeSingle();
      if (data) setLocked(!!data.locked);
    };
    loadLock();
    const ch = supabase
      .channel("session-lock-vote")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_settings" },
        loadLock,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (!jury) return;
    (async () => {
      const { data } = await supabase
        .from("evaluations")
        .select("*")
        .eq("jury_name", jury);
      const next = emptyRows();
      (data ?? []).forEach((d) => {
        const i = d.project_number - 1;
        if (i < 0 || i >= PROJECT_COUNT) return;
        next[i] = {
          project_name: d.project_name?.trim() || PROJECT_NAMES[i] || `Projet ${i + 1}`,
          scores: Object.fromEntries(
            CRITERIA.map((c) => [c.key, String(d[c.key as keyof typeof d] ?? "")]),
          ),
        };
      });
      setRows(next);
    })();
  }, [jury]);

  const update = (i: number, key: string, value: string) =>
    setRows((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, scores: { ...r.scores, [key]: value } } : r)),
    );
  const updateName = (i: number, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, project_name: value } : r)));

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
    const payload = rows.map((r, i) => ({
      jury_name: jury,
      project_number: i + 1,
      project_name: r.project_name?.trim() || PROJECT_NAMES[i] || `Projet ${i + 1}`,
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
    if (error) {
      toast.error("Erreur d'envoi : " + error.message);
    } else {
      toast.success(`Notes envoyées ✓ (${payload.length} projets)`);
    }
  };

  const toggleLock = async () => {
    const next = !locked;
    const { error } = await supabase
      .from("session_settings")
      .update({ locked: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    setLocked(next);
    toast.success(next ? "Session clôturée — résultats proclamés 🏆" : "Modifications rouvertes");
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
              Marketing Digital Competition · 8 projets · noté sur 100
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

      <main className="mx-auto max-w-7xl px-6 py-8">
        {locked && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <Lock className="h-4 w-4" />
            Les modifications sont clôturées par le Président. Les notes ne sont
            plus modifiables.
          </div>
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
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={r.project_name}
                        onChange={(e) => updateName(i, e.target.value)}
                        placeholder={PROJECT_NAMES[i]}
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
                          onChange={(e) => update(i, c.key, e.target.value)}
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
                  </tr>
                ))}
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
