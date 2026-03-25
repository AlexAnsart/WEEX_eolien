from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .analysis_registry import ANALYSIS_HANDLERS, run_analysis
from .reporting import EolienReportPayload, compile_report_to_pdf

ROOT_DIR = Path(__file__).resolve().parents[1]

raw_allowed_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
if raw_allowed_origins:
    allowed_origins = [origin.strip() for origin in raw_allowed_origins.split(",") if origin.strip()]
else:
    frontend_url = os.getenv("FRONTEND_URL", "").strip()
    allowed_origins = ["http://localhost:8080", "http://127.0.0.1:8080"]
    if frontend_url:
        allowed_origins.append(frontend_url)

app = FastAPI(title="WEEX Eolien API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "latexAvailable": bool(shutil.which("tectonic") or shutil.which("pdflatex")),
    }


@app.get("/api/analyses")
def list_analyses() -> dict[str, list[str]]:
    return {"analyses": sorted(ANALYSIS_HANDLERS.keys())}


@app.get("/api/analyse/{analysis_id}")
def analyse_by_id(analysis_id: str) -> dict[str, Any]:
    return run_analysis(analysis_id)


@app.get("/api/analyse/main-louis")
def analyse_main_louis() -> dict[str, Any]:
    # Legacy endpoint kept for frontend compatibility.
    return run_analysis("main-louis")


@app.post("/api/analyse/main-eolien/images")
def generate_main_eolien_images() -> dict[str, Any]:
    script_path = ROOT_DIR / "script" / "main_eolien.py"
    data_path = ROOT_DIR / "script" / "donnees.txt"
    output_path = ROOT_DIR / "public" / "generated"
    cmd = [
        sys.executable,
        str(script_path),
        "--data",
        str(data_path),
        "--output",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout.strip() or "{}")
    return {
        "sourceScript": "script/main_eolien.py",
        "outputDir": "public/generated",
        "images": payload,
    }


@app.post("/api/reports/eolien/generate")
def generate_eolien_report(payload: EolienReportPayload) -> Response:
    pdf_bytes, filename = compile_report_to_pdf(payload)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/optimisation/run")
def run_optimisation(scenario: int = 1, constraint_set: int = 1, theta_step: int = 30) -> dict[str, Any]:
    script_path = ROOT_DIR / "phase2" / "optimisation.py"
    output_path = ROOT_DIR / "public" / "generated" / "optimisation_result.json"
    wind_output_path = ROOT_DIR / "phase2" / "data" / "wind_aggregated.json"
    cmd = [
        sys.executable,
        str(script_path),
        "--scenario",
        str(scenario),
        "--constraint-set",
        str(constraint_set),
        "--theta-step",
        str(theta_step),
        "--output",
        str(output_path),
        "--wind-output",
        str(wind_output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout.strip() or "{}")
    return {
        "sourceScript": "phase2/optimisation.py",
        "resultPath": "public/generated/optimisation_result.json",
        "windPath": "phase2/data/wind_aggregated.json",
        "run": payload,
    }


@app.get("/api/optimisation/result")
def get_optimisation_result() -> dict[str, Any]:
    result_path = ROOT_DIR / "public" / "generated" / "optimisation_result.json"
    if not result_path.exists():
        return {
            "error": "optimisation_result.json introuvable. Lancez d'abord POST /api/optimisation/run.",
            "resultPath": "public/generated/optimisation_result.json",
        }
    return json.loads(result_path.read_text(encoding="utf-8"))
