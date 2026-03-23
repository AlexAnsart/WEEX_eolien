import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisPayload, EolienReportPayload, ReportChartSection } from "@/types/report";
import { buildReportPayload, defaultGenericSections, loadAnalysisSnapshot } from "@/lib/report";

type GenerationState = "idle" | "loading" | "success" | "error";

const axisLabelProps = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 12,
  textAnchor: "middle" as const,
};

const captureChartAsBase64 = async (container: HTMLElement): Promise<string> => {
  const svg = container.querySelector("svg");
  if (!svg) {
    throw new Error("Graphique introuvable pour l'export.");
  }

  const serializer = new XMLSerializer();
  const serializedSvg = serializer.serializeToString(svg);
  const svgBlob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Impossible de convertir le graphique en image."));
      img.src = url;
    });

    const width = svg.clientWidth || 900;
    const height = svg.clientHeight || 420;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Contexte canvas indisponible.");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  } finally {
    URL.revokeObjectURL(url);
  }
};

const ReportEditorEolien = () => {
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<EolienReportPayload["metadata"]>({
    title: "Rapport d'analyse eolienne",
    ue: "WEEX",
    subject: "Etude de performance d'une eolienne",
    teacher: "A renseigner",
    students: ["A renseigner"],
  });

  const [genericSections, setGenericSections] = useState(defaultGenericSections);
  const [interpretations, setInterpretations] = useState<Record<string, string>>({
    powerCurve: "",
    windDistribution: "",
    windRose: "",
    tempPower: "",
    airDensity: "",
  });

  const chartRefs = {
    powerCurve: useRef<HTMLDivElement | null>(null),
    windDistribution: useRef<HTMLDivElement | null>(null),
    windRose: useRef<HTMLDivElement | null>(null),
    tempPower: useRef<HTMLDivElement | null>(null),
    airDensity: useRef<HTMLDivElement | null>(null),
  };

  useEffect(() => {
    const cached = loadAnalysisSnapshot();
    if (cached) {
      setAnalysis(cached);
      return;
    }

    const loadFromApi = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/analyse/main-louis");
        if (!response.ok) {
          throw new Error("Impossible de charger l'analyse eolienne.");
        }
        const payload = (await response.json()) as AnalysisPayload;
        setAnalysis(payload);
      } catch (error) {
        setLoadError((error as Error).message);
      }
    };

    void loadFromApi();
  }, []);

  const chartSpecs = useMemo(
    () => [
      { id: "powerCurve", title: "Courbe de puissance", caption: "Courbe de puissance mediane avec enveloppe Q10/Q90." },
      { id: "windDistribution", title: "Distribution des vitesses de vent", caption: "Histogramme des classes de vitesses et comparaison Weibull." },
      { id: "windRose", title: "Rose des vents", caption: "Frequences directionnelles et puissance moyenne par direction." },
      { id: "tempPower", title: "Effet temperature vs densite de puissance", caption: "Relation entre temperature et potentiel aerodynamique normalise." },
      { id: "airDensity", title: "Distribution de densite de l'air", caption: "Histogramme des classes de densite de l'air observees." },
    ] as const,
    [],
  );

  const buildChartSections = async (): Promise<ReportChartSection[]> => {
    const sections: ReportChartSection[] = [];
    for (const spec of chartSpecs) {
      const chartContainer = chartRefs[spec.id].current;
      if (!chartContainer) {
        throw new Error(`Le graphique ${spec.title} n'est pas pret pour l'export.`);
      }
      const imageBase64 = await captureChartAsBase64(chartContainer);
      sections.push({
        id: spec.id,
        title: spec.title,
        caption: spec.caption,
        interpretation: interpretations[spec.id] ?? "",
        imageBase64,
      });
    }
    return sections;
  };

  const generateReport = async () => {
    if (!analysis) {
      return;
    }
    setGenerationState("loading");
    setGenerationError(null);

    try {
      const chartSections = await buildChartSections();
      const payload = buildReportPayload({
        metadata,
        genericSections,
        analysis,
        chartSections,
      });

      const response = await fetch("http://127.0.0.1:8000/api/reports/eolien/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = "Erreur de generation PDF.";
        try {
          const data = (await response.json()) as { detail?: string };
          if (data.detail) {
            message = data.detail;
          }
        } catch {
          const rawText = await response.text();
          if (rawText) {
            message = rawText;
          }
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "rapport-eolien.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setGenerationState("success");
    } catch (error) {
      setGenerationState("error");
      setGenerationError((error as Error).message);
    }
  };

  if (loadError) {
    return <div className="px-6 py-8 text-sm text-destructive">{loadError}</div>;
  }

  if (!analysis) {
    return <div className="px-6 py-8 text-sm text-muted-foreground">Chargement de l'analyse eolienne...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Editeur de rapport eolien</h1>
          <p className="text-sm text-muted-foreground">
            Structure uniforme avec sections fixes et interpretation analyste par graphique.
          </p>
        </div>
        <Link to="/analyse" className="text-sm text-primary hover:underline">
          Retour a l'analyse
        </Link>
      </div>

      <section className="glass-card grid gap-4 p-5 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Titre du rapport</span>
          <input
            value={metadata.title}
            onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">UE</span>
          <input
            value={metadata.ue}
            onChange={(e) => setMetadata((prev) => ({ ...prev, ue: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Sujet</span>
          <input
            value={metadata.subject}
            onChange={(e) => setMetadata((prev) => ({ ...prev, subject: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Enseignant</span>
          <input
            value={metadata.teacher}
            onChange={(e) => setMetadata((prev) => ({ ...prev, teacher: e.target.value }))}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-muted-foreground">Eleves (une ligne par nom)</span>
          <textarea
            value={metadata.students.join("\n")}
            onChange={(e) =>
              setMetadata((prev) => ({
                ...prev,
                students: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean),
              }))
            }
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>

      <section className="glass-card grid gap-4 p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Sections generiques</h2>
        {(
          [
            ["introduction", "Introduction"],
            ["theoreticalFramework", "Cadre theorique"],
            ["methodology", "Methodologie"],
            ["conclusion", "Conclusion"],
          ] as const
        ).map(([key, label]) => (
          <label className="text-sm" key={key}>
            <span className="mb-1 block text-muted-foreground">{label}</span>
            <textarea
              value={genericSections[key]}
              onChange={(e) => setGenericSections((prev) => ({ ...prev, [key]: e.target.value }))}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        ))}
      </section>

      <section className="grid gap-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Sections analytiques modulables</h2>

        <div className="glass-card p-5">
          <h3 className="mb-3 font-medium">1. Courbe de puissance</h3>
          <div ref={chartRefs.powerCurve} className="rounded border border-border bg-background p-2">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analysis.powerCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="speed" label={{ value: "Vent [m/s]", position: "insideBottom", offset: -5, ...axisLabelProps }} />
                <YAxis label={{ value: "MW", angle: -90, position: "insideLeft", ...axisLabelProps }} />
                <RechartsTooltip />
                <Legend />
                <Line dataKey="q90" stroke="hsl(var(--chart-1))" strokeDasharray="6 4" dot={false} name="Q90" />
                <Line dataKey="q10" stroke="hsl(var(--chart-1))" strokeDasharray="6 4" dot={false} name="Q10" />
                <Line dataKey="power" stroke="hsl(var(--chart-1))" strokeWidth={2.6} dot={false} name="Mediane" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <textarea
            value={interpretations.powerCurve}
            onChange={(e) => setInterpretations((prev) => ({ ...prev, powerCurve: e.target.value }))}
            rows={4}
            placeholder="Interpretation analyste"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </div>

        <div className="glass-card p-5">
          <h3 className="mb-3 font-medium">2. Distribution du vent et Weibull</h3>
          <div ref={chartRefs.windDistribution} className="rounded border border-border bg-background p-2">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={analysis.windDistributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="pct" fill="hsl(var(--chart-2))" name="Frequence observee [%]" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <textarea
            value={interpretations.windDistribution}
            onChange={(e) => setInterpretations((prev) => ({ ...prev, windDistribution: e.target.value }))}
            rows={4}
            placeholder="Interpretation analyste"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </div>

        <div className="glass-card p-5">
          <h3 className="mb-3 font-medium">3. Rose des vents</h3>
          <div ref={chartRefs.windRose} className="rounded border border-border bg-background p-2">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={analysis.windRoseData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="dir" />
                <PolarRadiusAxis />
                <Radar name="Frequence" dataKey="freq" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.25} />
                <Radar name="Puissance moyenne (kW)" dataKey="avgPower" stroke="hsl(var(--chart-5))" fill="hsl(var(--chart-5))" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <textarea
            value={interpretations.windRose}
            onChange={(e) => setInterpretations((prev) => ({ ...prev, windRose: e.target.value }))}
            rows={4}
            placeholder="Interpretation analyste"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </div>

        <div className="glass-card p-5">
          <h3 className="mb-3 font-medium">4. Temperature et densite de puissance</h3>
          <div ref={chartRefs.tempPower} className="rounded border border-border bg-background p-2">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analysis.tempPowerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="temp" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line dataKey="power" stroke="hsl(var(--chart-4))" strokeWidth={2.4} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <textarea
            value={interpretations.tempPower}
            onChange={(e) => setInterpretations((prev) => ({ ...prev, tempPower: e.target.value }))}
            rows={4}
            placeholder="Interpretation analyste"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </div>

        <div className="glass-card p-5">
          <h3 className="mb-3 font-medium">5. Distribution densite de l'air</h3>
          <div ref={chartRefs.airDensity} className="rounded border border-border bg-background p-2">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analysis.airDensityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="density" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" name="Nombre de mesures" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <textarea
            value={interpretations.airDensity}
            onChange={(e) => setInterpretations((prev) => ({ ...prev, airDensity: e.target.value }))}
            rows={4}
            placeholder="Interpretation analyste"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </div>
      </section>

      <section className="glass-card flex items-center justify-between gap-3 p-5">
        <div className="text-sm text-muted-foreground">
          Source: {analysis.sourceNotebook} · {analysis.sourceDataFile}
        </div>
        <div className="flex items-center gap-3">
          {generationState === "success" && <span className="text-sm text-chart-2">PDF genere avec succes.</span>}
          {generationState === "error" && (
            <span className="max-w-lg text-sm text-destructive">{generationError ?? "Erreur de generation."}</span>
          )}
          <button
            type="button"
            onClick={generateReport}
            disabled={generationState === "loading"}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
          >
            {generationState === "loading" ? "Generation en cours..." : "Generer le PDF"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ReportEditorEolien;
