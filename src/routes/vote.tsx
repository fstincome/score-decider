import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRITERIA, JURY_NAMES, PROJECT_COUNT } from "@/lib/scoring";
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
  Array.from({ length: PROJECT_COUNT }, () => ({
    project_name: "",
    scores: Object.fromEntries(CRITERIA.map((c) => [c.key, ""])),
  }));

function Vote() {
  const [jury, setJury] = useState<string>("");
  const [rows, setRows] = useState<Row[]>(emptyRows());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!jury) return;
    (async () => {
      const { data } = await supabase
        .from("evaluations")
        .select("*")
        .eq("jury_name", jury);
      if (!data) return;
      const next = emptyRows();
      data.forEach((d) => {
        const i = d.project_number - 1;
        if (i < 0 || i >= PROJECT_COUNT) return;
        next[i] = {
          project_name: d.project_name || "",
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
    setSaving(true);
    const payload = rows
      .map((r, i) => ({
        jury_name: jury,
        project_number: i + 1,
        project_name: r.project_name,
        ...Object.fromEntries(
          CRITERIA.map((c) => {
            const v = parseFloat(r.scores[c.key] || "0");
            return [c.key, isNaN(v) ? 0 : Math.min(Math.max(v, 0), c.max)];
          }),
        ),
      }))
      .filter((p) => totalOf(rows[p.project_number - 1]) > 0 || p.project_name.trim());

    if (payload.length === 0) {
      toast.error("Aucune note à envoyer.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("evaluations")
      .upsert(payload, { onConflict: "jury_name,project_number" });
    setSaving(false);
    if (error) {
      toast.error("Erreur d'envoi : " + error.message);
    } else {
      toast.success(`Notes envoyées (${payload.length} projet${payload.length > 1 ? "s" : ""}) ✓`);
    }
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
            Sélectionnez qui vous êtes pour saisir vos notes.
          </p>
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
          <div>
            <Link to="/" className="text-xs opacity-80 hover:opacity-100">
              <ArrowLeft className="mr-1 inline h-3 w-3" /> Classement
            </Link>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Mes notes — {jury}</h1>
            <p className="text-xs opacity-90">
              Notez chaque projet sur 100. Vous pouvez modifier puis renvoyer à tout moment.
            </p>
          </div>
          <Button size="lg" variant="secondary" onClick={submit} disabled={saving}>
            <Send className="mr-2 h-4 w-4" />
            {saving ? "Envoi..." : "Envoyer mes notes"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
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
                        placeholder={`Projet ${i + 1}`}
                        className="h-9 min-w-[150px]"
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
          <div className="flex items-center justify-between gap-4 border-t px-5 py-4">
            <div>
              <Label className="text-xs text-muted-foreground">Connecté en tant que</Label>
              <div className="font-medium">{jury}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setJury("")}>
                Changer de juré
              </Button>
              <Button onClick={submit} disabled={saving}>
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
