import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CRITERIA, JURY_NAMES, PROJECT_COUNT } from "@/lib/scoring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Classement Live — Jury" },
      { name: "description", content: "Classement combiné en temps réel des projets selon les notes du jury." },
    ],
  }),
  component: Index,
});

type Eval = {
  id: string;
  jury_name: string;
  project_number: number;
  project_name: string;
  innovation: number;
  impact: number;
  faisabilite: number;
  prototype: number;
  pitch: number;
  questions: number;
  created_at: string;
};

const PRIMARY_JURY = JURY_NAMES[0];

function Index() {
  const [evals, setEvals] = useState<Eval[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("evaluations").select("*");
      if (data) setEvals(data as Eval[]);
    };
    load();
    const ch = supabase
      .channel("eval-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const aggregated = Array.from({ length: PROJECT_COUNT }, (_, i) => {
    const num = i + 1;
    const rows = evals.filter((e) => e.project_number === num);
    // Use the name from Jury 1 as the authoritative name
    const primaryRow = rows.find((r) => r.jury_name === PRIMARY_JURY);
    const name = primaryRow?.project_name?.trim() || "";
    const totals = rows.map((r) =>
      CRITERIA.reduce((s, c) => s + Number(r[c.key as keyof Eval] || 0), 0),
    );
    const submitted = totals.length;
    const sum = totals.reduce((s, t) => s + t, 0);
    const avg = submitted ? sum / submitted : 0;
    return { num, name, rows, submitted, avg };
  });

  const ranking = [...aggregated]
    .filter((p) => p.submitted > 0)
    .sort((a, b) => b.avg - a.avg);

  const podiumIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-6 w-6 text-[color:var(--gold)]" />;
    if (i === 1) return <Medal className="h-6 w-6 text-[color:var(--silver)]" />;
    if (i === 2) return <Award className="h-6 w-6 text-[color:var(--bronze)]" />;
    return <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-br from-primary to-[color:var(--primary-glow)] text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Classement Final
            </h1>
            <p className="mt-1 text-sm opacity-90">
              Résultats condensés du jury — mise à jour en temps réel
            </p>
          </div>
          <Link to="/vote">
            <Button variant="secondary" size="lg">
              <ClipboardList className="mr-2 h-4 w-4" /> Espace juré
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="p-0">
          <div className="border-b px-5 py-3">
            <h2 className="text-lg font-semibold">Classement</h2>
            <p className="text-xs text-muted-foreground">
              Trié sur la moyenne des totaux des jurés
            </p>
          </div>
          <div className="divide-y">
            {ranking.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Aucune note encore. Demandez aux jurés d'ouvrir l'espace juré.
              </div>
            )}
            {ranking.map((p, i) => (
              <div
                key={p.num}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i === 0
                    ? "bg-gradient-to-r from-[color:var(--gold)]/15 to-transparent"
                    : i === 1
                    ? "bg-gradient-to-r from-[color:var(--silver)]/10 to-transparent"
                    : i === 2
                    ? "bg-gradient-to-r from-[color:var(--bronze)]/10 to-transparent"
                    : ""
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center">{podiumIcon(i)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">
                    {p.name || `Projet ${p.num}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Projet n°{p.num} · {p.submitted}/{JURY_NAMES.length} juré{p.submitted > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">{p.avg.toFixed(1)}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">/ 100</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30"
          >
            <div>
              <h2 className="text-sm font-semibold">Historique des évaluations</h2>
              <p className="text-xs text-muted-foreground">
                Détail conservé par juré ({evals.length} entrée{evals.length > 1 ? "s" : ""})
              </p>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showHistory && (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Juré</th>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Projet (saisi)</th>
                    {CRITERIA.map((c) => (
                      <th key={c.key} className="px-2 py-2 text-center">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...evals]
                    .sort(
                      (a, b) =>
                        a.jury_name.localeCompare(b.jury_name) ||
                        a.project_number - b.project_number,
                    )
                    .map((e) => {
                      const total = CRITERIA.reduce(
                        (s, c) => s + Number(e[c.key as keyof Eval] || 0),
                        0,
                      );
                      return (
                        <tr key={e.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{e.jury_name}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {e.project_number}
                          </td>
                          <td className="px-3 py-2">
                            {e.project_name || <span className="text-muted-foreground">—</span>}
                          </td>
                          {CRITERIA.map((c) => (
                            <td key={c.key} className="px-2 py-2 text-center tabular-nums">
                              {Number(e[c.key as keyof Eval] || 0)}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center font-semibold tabular-nums">
                            {total}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
