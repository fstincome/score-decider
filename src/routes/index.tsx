import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Medal, Award, Users, ClipboardList } from "lucide-react";
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
};

function Index() {
  const [evals, setEvals] = useState<Eval[]>([]);

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
    const name = rows.find((r) => r.project_name)?.project_name || "";
    const perJury = JURY_NAMES.map((j) => {
      const r = rows.find((x) => x.jury_name === j);
      const total = r
        ? CRITERIA.reduce((s, c) => s + Number(r[c.key as keyof Eval] || 0), 0)
        : null;
      return { jury: j, total };
    });
    const submitted = perJury.filter((p) => p.total !== null).length;
    const sum = perJury.reduce((s, p) => s + (p.total ?? 0), 0);
    const avg = submitted ? sum / submitted : 0;
    return { num, name, perJury, submitted, sum, avg };
  });

  const ranking = [...aggregated]
    .filter((p) => p.submitted > 0)
    .sort((a, b) => b.avg - a.avg);

  const podiumIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-[color:var(--gold)]" />;
    if (i === 1) return <Medal className="h-5 w-5 text-[color:var(--silver)]" />;
    if (i === 2) return <Award className="h-5 w-5 text-[color:var(--bronze)]" />;
    return <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-br from-primary to-[color:var(--primary-glow)] text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Classement Live
            </h1>
            <p className="mt-1 text-sm opacity-90">
              Notes combinées des 3 jurés — mise à jour en temps réel
            </p>
          </div>
          <Link to="/vote">
            <Button variant="secondary" size="lg">
              <ClipboardList className="mr-2 h-4 w-4" /> Espace juré
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-lg font-semibold">Détail des évaluations</h2>
            <span className="text-xs text-muted-foreground">
              <Users className="mr-1 inline h-3 w-3" />
              {evals.length} évaluation{evals.length > 1 ? "s" : ""} reçue
              {evals.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Projet</th>
                  {JURY_NAMES.map((j) => (
                    <th key={j} className="px-3 py-3 text-center">
                      {j}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center">Total</th>
                  <th className="px-3 py-3 text-center">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {aggregated.map((p) => (
                  <tr key={p.num} className="border-t">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{p.num}</td>
                    <td className="px-3 py-2">
                      {p.name || <span className="text-muted-foreground">—</span>}
                    </td>
                    {p.perJury.map((pj) => (
                      <td key={pj.jury} className="px-3 py-2 text-center">
                        {pj.total === null ? (
                          <span className="text-xs text-muted-foreground">en attente</span>
                        ) : (
                          <span className="font-medium tabular-nums">{pj.total}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">
                      {p.sum}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex min-w-[52px] items-center justify-center rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary tabular-nums">
                        {p.avg.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="h-fit p-0">
          <div className="border-b px-5 py-3">
            <h2 className="text-lg font-semibold">Classement</h2>
            <p className="text-xs text-muted-foreground">
              Trié sur la moyenne des notes reçues
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
                className={`flex items-center gap-3 px-5 py-3 ${
                  i === 0 ? "bg-gradient-to-r from-[color:var(--gold)]/15 to-transparent" : ""
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center">{podiumIcon(i)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {p.name || `Projet ${p.num}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    #{p.num} · {p.submitted}/3 juré{p.submitted > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums">{p.avg.toFixed(1)}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">/ 100</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
