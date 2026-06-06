import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trophy, Medal, Award, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Classement des Projets" },
      { name: "description", content: "Saisissez les notes et obtenez le classement des projets en direct." },
    ],
  }),
  component: Index,
});

type Criterion = { key: string; label: string; max: number };

const CRITERIA: Criterion[] = [
  { key: "innovation", label: "Innovation", max: 25 },
  { key: "impact", label: "Impact", max: 20 },
  { key: "faisabilite", label: "Faisabilité technique", max: 20 },
  { key: "prototype", label: "Qualité du prototype", max: 15 },
  { key: "pitch", label: "Présentation du pitch", max: 10 },
  { key: "questions", label: "Réponses aux questions", max: 10 },
];

type Row = {
  id: number;
  name: string;
  scores: Record<string, string>;
};

const makeRows = (n = 10): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: "",
    scores: Object.fromEntries(CRITERIA.map((c) => [c.key, ""])),
  }));

function Index() {
  const [rows, setRows] = useState<Row[]>(makeRows());

  const updateScore = (id: number, key: string, value: string) => {
    setRows((rs) =>
      rs.map((r) => (r.id === id ? { ...r, scores: { ...r.scores, [key]: value } } : r)),
    );
  };
  const updateName = (id: number, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name: value } : r)));

  const ranking = useMemo(() => {
    return rows
      .map((r) => {
        const total = CRITERIA.reduce((sum, c) => {
          const v = parseFloat(r.scores[c.key] || "0");
          return sum + (isNaN(v) ? 0 : Math.min(v, c.max));
        }, 0);
        return { ...r, total };
      })
      .filter((r) => r.total > 0 || r.name.trim() !== "")
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const reset = () => setRows(makeRows());

  const podiumIcon = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-[color:var(--gold)]" />;
    if (i === 1) return <Medal className="h-5 w-5 text-[color:var(--silver)]" />;
    if (i === 2) return <Award className="h-5 w-5 text-[color:var(--bronze)]" />;
    return <span className="text-sm font-semibold text-muted-foreground">{i + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-gradient-to-br from-primary to-[color:var(--primary-glow)] text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Évaluation & Classement des Projets
          </h1>
          <p className="mt-2 text-sm opacity-90 md:text-base">
            Saisissez les notes de chaque projet sur 100 — le classement se met à jour en direct.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {CRITERIA.map((c) => (
              <span
                key={c.key}
                className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm"
              >
                {c.label} · {c.max} pts
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-lg font-semibold">Grille de notation</h2>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">#</th>
                  <th className="px-3 py-3 text-left">Projet</th>
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
                {rows.map((r) => {
                  const total = CRITERIA.reduce((s, c) => {
                    const v = parseFloat(r.scores[c.key] || "0");
                    return s + (isNaN(v) ? 0 : Math.min(v, c.max));
                  }, 0);
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{r.id}</td>
                      <td className="px-3 py-2">
                        <Input
                          value={r.name}
                          onChange={(e) => updateName(r.id, e.target.value)}
                          placeholder={`Projet ${r.id}`}
                          className="h-9 min-w-[140px]"
                        />
                      </td>
                      {CRITERIA.map((c) => (
                        <td key={c.key} className="px-1.5 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={c.max}
                            value={r.scores[c.key]}
                            onChange={(e) => updateScore(r.id, c.key, e.target.value)}
                            placeholder="0"
                            className="h-9 w-16 text-center"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex min-w-[48px] items-center justify-center rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                          {total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="h-fit p-0">
          <div className="border-b px-5 py-3">
            <h2 className="text-lg font-semibold">Classement</h2>
            <p className="text-xs text-muted-foreground">Mis à jour automatiquement</p>
          </div>
          <div className="divide-y">
            {ranking.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Commencez à saisir des notes pour voir le classement.
              </div>
            )}
            {ranking.map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-5 py-3 ${
                  i === 0 ? "bg-gradient-to-r from-[color:var(--gold)]/15 to-transparent" : ""
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center">{podiumIcon(i)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {r.name.trim() || `Projet ${r.id}`}
                  </div>
                  <div className="text-xs text-muted-foreground">#{r.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums">{r.total}</div>
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
