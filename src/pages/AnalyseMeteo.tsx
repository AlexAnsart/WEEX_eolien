import { useEffect, useMemo, useRef, useState } from "react";
import { CloudSun, MapPinned, MousePointer2 } from "lucide-react";
import { powerCurveData } from "@/data/windData";

type ParcelData = { id: string; x: number; y: string; rowIndex: number; colIndex: number };

const ROWS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i));
const COLS = Array.from({ length: 19 }, (_, i) => i + 1);

const PARCELS: ParcelData[] = ROWS.flatMap((rowLetter, rowIndex) =>
  COLS.map((col) => ({
    id: `${col}${rowLetter}`,
    x: col,
    y: rowLetter,
    rowIndex,
    colIndex: col - 1,
  })),
);

type MeteoPayload = {
  annual: Record<string, number>;
  monthly: Record<string, Record<string, number>>;
  direction: Record<string, { direction: number; velocity: number }>;
  stats: {
    globalMean: number;
    min: number;
    max: number;
    count: number;
    vminDirection: number;
    vmaxDirection: number;
  };
};

const angleToCardinal = (angle: number) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const index = Math.round((angle % 360) / 45) % 8;
  return dirs[index];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computeNiceStep = (range: number, targetTicks: number) => {
  const raw = Math.max(range / Math.max(targetTicks, 1), 1e-6);
  const pow10 = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / pow10;
  const niceBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return niceBase * pow10;
};

const remapParcelIdForData = (parcelId: string) => {
  const match = parcelId.match(/^(\d+)([A-L])$/);
  if (!match) return parcelId;
  const [, col, rowLetter] = match;
  const rowIndex = ROWS.indexOf(rowLetter);
  if (rowIndex < 0) return parcelId;
  const flippedRow = ROWS[ROWS.length - 1 - rowIndex];
  return `${col}${flippedRow}`;
};

const AnalyseMeteo = () => {
  const [hoveredParcel, setHoveredParcel] = useState<string | null>(null);
  const [meteoData, setMeteoData] = useState<MeteoPayload | null>(null);
  const [imageStamp] = useState(() => Date.now());
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      const response = await fetch(`/generated/meteo_data.json?t=${Date.now()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as MeteoPayload;
      setMeteoData(payload);
    };
    void loadData();
    return () => controller.abort();
  }, []);

  const hovered = useMemo(
    () => PARCELS.find((parcel) => parcel.id === hoveredParcel) ?? null,
    [hoveredParcel],
  );

  const hoveredDirection = hovered ? meteoData?.direction[remapParcelIdForData(hovered.id)] : undefined;
  const mapImage = `/generated/meteo_vectors_view.png?t=${imageStamp}`;
  const legendLabel = "Vitesse moyenne du vent";
  const legendMin = meteoData?.stats.vminDirection ?? meteoData?.stats.min ?? 0;
  const legendMax = meteoData?.stats.vmaxDirection ?? meteoData?.stats.max ?? 0;
  const legendGradient = useMemo(() => {
    const violetRef = 16;
    const span = Math.max(legendMax - legendMin, 1e-6);
    const violetPos = clamp(((violetRef - legendMin) / span) * 100, 0, 100);
    return `linear-gradient(to right,
      #f7fbff 0%,
      #deebf7 18%,
      #c6dbef 34%,
      #9ecae1 50%,
      #6baed6 64%,
      #3182bd 76%,
      #756bb1 ${Math.max(violetPos - 8, 0)}%,
      #54278f ${violetPos}%,
      #2d004b 100%)`;
  }, [legendMax, legendMin]);
  const legendTicks = useMemo(() => {
    const desiredTickCount = 6;
    const step = computeNiceStep(legendMax - legendMin, desiredTickCount - 1);
    const start = Math.floor(legendMin / step) * step;
    const end = Math.ceil(legendMax / step) * step;
    const ticks: number[] = [];
    for (let value = start; value <= end + step * 0.5; value += step) {
      ticks.push(Number(value.toFixed(6)));
    }
    return ticks;
  }, [legendMax, legendMin]);
  const hoveredOperatingSpeed = hovered ? hoveredDirection?.velocity ?? 0 : 0;
  const sortedPowerCurve = useMemo(() => [...powerCurveData].sort((a, b) => a.speed - b.speed), []);
  const powerExtents = useMemo(() => {
    const maxSpeed = Math.max(...sortedPowerCurve.map((p) => p.speed), 20);
    const maxPower = Math.max(...sortedPowerCurve.map((p) => p.power), 1);
    return { minSpeed: 0, maxSpeed, minPower: 0, maxPower };
  }, [sortedPowerCurve]);
  const interpolatedPower = useMemo(() => {
    const speed = clamp(hoveredOperatingSpeed, powerExtents.minSpeed, powerExtents.maxSpeed);
    const rightIndex = sortedPowerCurve.findIndex((point) => point.speed >= speed);
    if (rightIndex <= 0) return sortedPowerCurve[0]?.power ?? 0;
    if (rightIndex === -1) return sortedPowerCurve[sortedPowerCurve.length - 1]?.power ?? 0;
    const left = sortedPowerCurve[rightIndex - 1];
    const right = sortedPowerCurve[rightIndex];
    const t = (speed - left.speed) / Math.max(right.speed - left.speed, 1e-6);
    return left.power + t * (right.power - left.power);
  }, [hoveredOperatingSpeed, powerExtents.maxSpeed, powerExtents.minSpeed, sortedPowerCurve]);
  const powerZone = hoveredOperatingSpeed < 4.5 ? "Faible production" : hoveredOperatingSpeed <= 15.5 ? "Zone productive optimale" : "Proche plateau nominal";
  const updateHoveredFromPointer = (clientX: number, clientY: number) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = clamp((clientX - rect.left) / rect.width, 0, 0.999999);
    const relY = clamp((clientY - rect.top) / rect.height, 0, 0.999999);
    const col = Math.floor(relX * 19) + 1;
    const rowFromTop = Math.floor(relY * 12);
    const row = ROWS[rowFromTop];
    setHoveredParcel(`${col}${row}`);
  };

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex items-center gap-3">
        <CloudSun className="h-5 w-5 text-chart-2" />
        <div className="flex-1">
          <h2 className="font-display text-xl font-semibold text-foreground">Mesure météo — Centrosus</h2>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[45%_55%]">
        <div className="glass-card flex flex-col gap-5 p-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">Courbe de puissance {hovered ? `- parcelle ${hovered.id}` : "- aucune parcelle"}</h3>
          </div>
          <div className="mt-2 space-y-2">
            {!hovered ? (
              <p className="text-sm text-muted-foreground">Survolez une parcelle pour mettre a jour vitesse, zone et puissance.</p>
            ) : (
              <p className="text-sm text-foreground">
                A {hoveredOperatingSpeed.toFixed(2)} m/s {"->"} <span className="font-semibold">{powerZone}</span>
              </p>
            )}
            <div className="relative overflow-hidden rounded border border-border bg-background/80">
              <img
                src={`/generated/courbe_puissance_regression_eta.png?t=${imageStamp}`}
                alt="Courbe de puissance de reference"
                className="h-auto w-full rounded"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Puissance estimee:{" "}
              <span className="font-semibold text-foreground">
                {hovered ? `${interpolatedPower.toFixed(2)} MW` : "--"}
              </span>
            </p>
          </div>
        </div>

        <div className="glass-card p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-primary" />
              <p className="font-display text-sm font-semibold text-foreground">
                Carte + directions et vecteurs
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MousePointer2 className="h-3.5 w-3.5" />
              Survoler une parcelle
            </div>
          </div>

          <div className="grid grid-cols-[20px_1fr] gap-2">
            <div className="grid grid-rows-12 gap-0.5 pt-4">
              {ROWS.map((row) => (
                <span key={row} className="flex items-center justify-center text-[10px] text-muted-foreground">
                  {row}
                </span>
              ))}
            </div>
            <div className="space-y-1">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(19, minmax(0, 1fr))" }}>
                {COLS.map((col) => (
                  <span key={col} className="text-center text-[10px] text-muted-foreground">
                    {col}
                  </span>
                ))}
              </div>
              <div
                ref={mapRef}
                className="relative overflow-hidden rounded-xl border border-border"
                onMouseMove={(event) => updateHoveredFromPointer(event.clientX, event.clientY)}
                onMouseLeave={() => setHoveredParcel(null)}
              >
                <img
                  src={mapImage}
                  alt="Carte météo superposée"
                  className="h-auto w-full select-none"
                />
                <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(19, minmax(0, 1fr))", gridTemplateRows: "repeat(12, minmax(0, 1fr))" }}>
                  {PARCELS.map((parcel) => (
                    <div
                      key={parcel.id}
                      className={`relative ${hoveredParcel === parcel.id ? "border border-white/80" : "border border-transparent"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-background/75 p-3">
            <p className="mb-1 text-xs text-muted-foreground">{legendLabel}</p>
            <div className="h-3 w-full rounded" style={{ background: legendGradient }} />
            <div
              className="mt-2 grid text-[11px] text-muted-foreground"
              style={{ gridTemplateColumns: `repeat(${legendTicks.length}, minmax(0, 1fr))` }}
            >
              {legendTicks.map((tick, idx) => (
                <span key={`${tick}-${idx}`} className={idx === 0 ? "text-left" : idx === legendTicks.length - 1 ? "text-right" : "text-center"}>
                  {tick.toFixed(1)}
                </span>
              ))}
            </div>
            <div className="mt-0.5 text-right text-[11px] text-muted-foreground">
              m/s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyseMeteo;
