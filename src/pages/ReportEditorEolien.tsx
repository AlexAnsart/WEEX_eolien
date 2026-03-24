import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AnalysisPayload, EolienReportPayload, ReportChartSection } from "@/types/report";
import {
  buildReportPayload,
  defaultGenericSections,
  defaultReportMetadata,
  loadAnalysisSnapshot,
} from "@/lib/report";

type GenerationState = "idle" | "loading" | "success" | "error";

const ReportEditorEolien = () => {
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationState, setGenerationState] = useState<GenerationState>("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [imageStamp, setImageStamp] = useState<number>(Date.now());

  const [metadata, setMetadata] = useState<EolienReportPayload["metadata"]>(defaultReportMetadata);
  const [authorsText, setAuthorsText] = useState(defaultReportMetadata.students.join("\n"));
  const [conclusionText, setConclusionText] = useState(defaultGenericSections.conclusion);
  const [interpretations, setInterpretations] = useState<Record<string, string>>({
    powerCurve: "",
    windDistribution: "",
    windRose: "",
    tempPower: "",
    airDensity: "",
  });

  useEffect(() => {
    const cached = loadAnalysisSnapshot();
    if (cached) {
      setAnalysis(cached);
      return;
    }

    const loadFromApi = async () => {
      try {
        await fetch("http://127.0.0.1:8000/api/analyse/main-eolien/images", { method: "POST" });
        setImageStamp(Date.now());
        const response = await fetch("http://127.0.0.1:8000/api/analyse/main-eolien");
        if (!response.ok) {
          throw new Error("Impossible de charger l'analyse éolienne.");
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
      {
        id: "powerCurve",
        title: "Courbe de puissance",
        caption: "Courbe de puissance issue du script Python.",
        src: `/generated/courbe_puissance.png?t=${imageStamp}`,
      },
      {
        id: "windDistribution",
        title: "Distribution des vitesses de vent",
        caption: "Histogramme observé et ajustement Weibull.",
        src: `/generated/distribution_weibull.png?t=${imageStamp}`,
      },
      {
        id: "windRose",
        title: "Rose des vents",
        caption: "Fréquences directionnelles du vent.",
        src: `/generated/rose_vents_frequence.png?t=${imageStamp}`,
      },
      {
        id: "tempPower",
        title: "Température et puissance",
        caption: "Régression température-puissance à vitesse constante.",
        src: `/generated/temperature_puissance_regression.png?t=${imageStamp}`,
      },
      {
        id: "airDensity",
        title: "Direction et puissance",
        caption: "Dispersion de la puissance selon la direction du vent.",
        src: `/generated/direction_puissance_brut.png?t=${imageStamp}`,
      },
    ] as const,
    [imageStamp],
  );

  const fetchImageAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Image introuvable pour l'export: ${url}`);
    }
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Impossible de convertir l'image en base64."));
      reader.readAsDataURL(blob);
    });
    const [, base64 = ""] = dataUrl.split(",");
    return base64;
  };

  const buildChartSections = async (): Promise<ReportChartSection[]> => {
    const sections: ReportChartSection[] = [];
    for (const spec of chartSpecs) {
      const imageBase64 = await fetchImageAsBase64(spec.src);
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
      const normalizedStudents = authorsText
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);

      if (normalizedStudents.length === 0) {
        throw new Error("Veuillez renseigner au moins un auteur.");
      }

      const chartSections = await buildChartSections();
      const payload = buildReportPayload({
        metadata: { ...metadata, students: normalizedStudents },
        genericSections: {
          ...defaultGenericSections,
          conclusion: conclusionText,
        },
        analysis,
        chartSections,
      });

      const response = await fetch("http://127.0.0.1:8000/api/reports/eolien/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = "Erreur de génération PDF.";
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
    return <div className="px-6 py-8 text-sm text-muted-foreground">Chargement de l'analyse éolienne...</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Éditeur de rapport éolien</h1>
          <p className="text-sm text-muted-foreground">
            Structure uniforme avec sections fixes et interprétation analyste par graphique.
          </p>
        </div>
        <Link to="/analyse" className="text-sm text-primary hover:underline">
          Retour à l'analyse
        </Link>
      </div>

      <section className="glass-card grid gap-4 p-5">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Auteurs (une ligne par nom)</span>
          <textarea
            value={authorsText}
            onChange={(e) => setAuthorsText(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>

      <section className="grid gap-6">
        <h2 className="font-display text-lg font-semibold text-foreground">Sections analytiques modulables</h2>

        {chartSpecs.map((spec, index) => (
          <div key={spec.id} className="glass-card p-5">
            <h3 className="mb-1 font-medium">{index + 1}. {spec.title}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{spec.caption}</p>
            <div className="rounded border border-border bg-background p-2">
              <img
                src={spec.src}
                alt={spec.title}
                loading="lazy"
                className="h-auto max-h-[420px] w-full rounded object-contain"
              />
            </div>
            <textarea
              value={interpretations[spec.id]}
              onChange={(e) => setInterpretations((prev) => ({ ...prev, [spec.id]: e.target.value }))}
              rows={4}
              placeholder="Interprétation analyste"
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </div>
        ))}
      </section>

      <section className="glass-card grid gap-4 p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Conclusion</h2>
        <div className="rounded-lg bg-muted/40 p-4 text-sm">
          <p className="mb-2 font-medium text-foreground">Résumé de l'analyse éolienne</p>
          <div className="grid gap-2 text-muted-foreground md:grid-cols-2">
            <p>Mesures retenues: <span className="font-medium text-foreground">{analysis.kpis.retainedMeasurements.toLocaleString()}</span></p>
            <p>Disponibilité: <span className="font-medium text-foreground">{analysis.kpis.availability}%</span></p>
            <p>Puissance nominale: <span className="font-medium text-foreground">{analysis.kpis.ratedPower} MW</span></p>
            <p>Facteur de capacité: <span className="font-medium text-foreground">{(analysis.kpis.capacityFactor * 100).toFixed(0)}%</span></p>
            <p>Weibull k/c: <span className="font-medium text-foreground">{analysis.kpis.weibullK} / {analysis.kpis.weibullC}</span></p>
            <p>Vitesse moyenne: <span className="font-medium text-foreground">{analysis.kpis.meanWindSpeed} m/s</span></p>
          </div>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Conclusion de l'auteur</span>
          <textarea
            value={conclusionText}
            onChange={(e) => setConclusionText(e.target.value)}
            rows={5}
            placeholder="Rédigez ici la conclusion du rapport."
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </section>

      <section className="glass-card flex items-center justify-between gap-3 p-5">
        <div className="text-sm text-muted-foreground">
          Source: {analysis.sourceNotebook} · {analysis.sourceDataFile}
        </div>
        <div className="flex items-center gap-3">
          {generationState === "success" && <span className="text-sm text-chart-2">PDF généré avec succès.</span>}
          {generationState === "error" && (
            <span className="max-w-lg text-sm text-destructive">{generationError ?? "Erreur de génération."}</span>
          )}
          <button
            type="button"
            onClick={generateReport}
            disabled={generationState === "loading"}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-70"
          >
            {generationState === "loading" ? "Génération en cours..." : "Générer le rapport PDF"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ReportEditorEolien;
