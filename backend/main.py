from __future__ import annotations

import shutil
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .analysis_registry import ANALYSIS_HANDLERS, run_analysis
from .reporting import EolienReportPayload, compile_report_to_pdf


app = FastAPI(title="WEEX Eolien API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
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


@app.post("/api/reports/eolien/generate")
def generate_eolien_report(payload: EolienReportPayload) -> Response:
    pdf_bytes, filename = compile_report_to_pdf(payload)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
