from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from jinja2 import Environment, FileSystemLoader, StrictUndefined
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT_DIR / "backend" / "latex_templates"
# First compilation with Tectonic may download LaTeX bundles and can be slow.
# Keep a generous default timeout; override via WEEX_LATEX_TIMEOUT_SECONDS.
LATEX_TIMEOUT_SECONDS = int(os.getenv("WEEX_LATEX_TIMEOUT_SECONDS", "240"))
MAX_IMAGE_BYTES = 6 * 1024 * 1024


class ReportMetadata(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    ue: str = Field(min_length=1, max_length=100)
    students: list[str] = Field(default_factory=list, max_length=10)


class GenericSections(BaseModel):
    introduction: str = Field(min_length=10)
    theoreticalFramework: str = Field(min_length=10)
    methodology: str = Field(min_length=10)
    conclusion: str = Field(min_length=10)


class ChartSection(BaseModel):
    id: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=120)
    caption: str = Field(min_length=1, max_length=300)
    interpretation: str = Field(default="")
    imageBase64: str = Field(min_length=20)


class AnalysisSummary(BaseModel):
    sourceNotebook: str = Field(min_length=1)
    sourceDataFile: str = Field(min_length=1)
    kpis: dict[str, Any]


class EolienReportPayload(BaseModel):
    reportVersion: int
    metadata: ReportMetadata
    genericSections: GenericSections
    analysisSummary: AnalysisSummary
    chartSections: list[ChartSection] = Field(min_length=1, max_length=20)
    generatedAtIso: str


def escape_latex(value: str) -> str:
    # Normalize common Unicode punctuation that pdflatex handles poorly by default.
    value = (
        value.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
        .replace("\u00a0", " ")
    )
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(char, char) for char in value)


def _clean_latex_log(log_text: str) -> str:
    collapsed = re.sub(r"\s+", " ", log_text).strip()
    return collapsed[:1600]


def _build_jinja() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        undefined=StrictUndefined,
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["latex"] = escape_latex
    return env


def _decode_chart_images(chart_sections: list[ChartSection], images_dir: Path) -> list[dict[str, str]]:
    figure_context: list[dict[str, str]] = []
    for index, section in enumerate(chart_sections, start=1):
        try:
            image_bytes = base64.b64decode(section.imageBase64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Image invalide pour '{section.title}'.") from exc

        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image trop volumineuse pour '{section.title}' (>{MAX_IMAGE_BYTES} octets).",
            )

        filename = f"figure_{index:02d}.png"
        image_path = images_dir / filename
        image_path.write_bytes(image_bytes)
        figure_context.append(
            {
                "id": section.id,
                "filename": filename,
                "title": section.title,
                "caption": section.caption,
                "interpretation": section.interpretation,
            }
        )
    return figure_context


def _copy_static_report_images(images_dir: Path) -> None:
    image_candidates = {
        # intro map image provided by user
        "carte.png": [
            ROOT_DIR.parent / "images" / "carte.png",
            ROOT_DIR / "images" / "carte.png",
        ],
        # images referenced by the requested fixed LaTeX template
        "courbe_puissance_vitesse.png": [
            ROOT_DIR / "public" / "generated" / "courbe_puissance_vitesse.png",
            ROOT_DIR / "public" / "generated" / "courbe_puissance_regression_eta.png",
            ROOT_DIR / "public" / "generated" / "courbe_puissance.png",
        ],
        "Figure 2026-03-24 095200.png": [
            ROOT_DIR / "public" / "generated" / "Figure 2026-03-24 095200.png",
            ROOT_DIR / "public" / "generated" / "temperature_puissance_regression.png",
            ROOT_DIR / "public" / "generated" / "temperature_puissance_brut.png",
        ],
        "v=8.png": [
            ROOT_DIR / "public" / "generated" / "v=8.png",
            ROOT_DIR / "public" / "generated" / "temperature_puissance_regression.png",
        ],
        "v=10.png": [
            ROOT_DIR / "public" / "generated" / "v=10.png",
            ROOT_DIR / "public" / "generated" / "temperature_puissance_regression.png",
        ],
        "direction_puissance_brut.png": [
            ROOT_DIR / "public" / "generated" / "direction_puissance_brut.png",
        ],
        "distribution_weibull.png": [
            ROOT_DIR / "public" / "generated" / "distribution_weibull.png",
        ],
        "meteo_vectors.png": [
            ROOT_DIR / "public" / "generated" / "meteo_vectors.png",
        ],
    }

    for target_name, candidates in image_candidates.items():
        for candidate in candidates:
            if candidate.exists():
                shutil.copy2(candidate, images_dir / target_name)
                break


def _render_tex(payload: EolienReportPayload, figure_context: list[dict[str, str]]) -> str:
    env = _build_jinja()
    template = env.get_template("eolien_report.tex.j2")
    class_name = "rapportECL" if (TEMPLATE_DIR / "rapportECL.cls").exists() else "placeholder"
    has_biblio = (TEMPLATE_DIR / "biblio.bib").exists() and bool(shutil.which("biber"))
    figures_by_id = {figure["id"]: figure for figure in figure_context}
    return template.render(
        payload=payload,
        figures=figure_context,
        figures_by_id=figures_by_id,
        class_name=class_name,
        has_biblio=has_biblio,
    )


def _latex_command() -> list[str]:
    if shutil.which("tectonic"):
        return ["tectonic", "--keep-logs", "--keep-intermediates", "report.tex"]
    if shutil.which("pdflatex"):
        return ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "report.tex"]
    raise HTTPException(
        status_code=503,
        detail="Aucun compilateur LaTeX detecte (installez tectonic ou pdflatex).",
    )


def compile_report_to_pdf(payload: EolienReportPayload) -> tuple[bytes, str]:
    if payload.reportVersion != 1:
        raise HTTPException(status_code=400, detail="Version de rapport non supportee.")

    temp_dir = Path(tempfile.mkdtemp(prefix="weex-report-"))
    images_dir = temp_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    try:
        class_candidates = ["rapportECL.cls", "placeholder.cls"]
        copied_any_class = False
        for class_filename in class_candidates:
            class_path = TEMPLATE_DIR / class_filename
            if class_path.exists():
                shutil.copy2(class_path, temp_dir / class_filename)
                copied_any_class = True

        if not copied_any_class:
            raise HTTPException(
                status_code=500,
                detail="Template LaTeX introuvable: ajoutez rapportECL.cls ou placeholder.cls dans backend/latex_templates.",
            )

        logos_src = TEMPLATE_DIR / "logos"
        if logos_src.exists() and logos_src.is_dir():
            shutil.copytree(logos_src, temp_dir / "logos", dirs_exist_ok=True)

        biblio_src = TEMPLATE_DIR / "biblio.bib"
        if biblio_src.exists():
            shutil.copy2(biblio_src, temp_dir / "biblio.bib")

        figures = _decode_chart_images(payload.chartSections, images_dir)
        _copy_static_report_images(images_dir)
        tex_source = _render_tex(payload, figures)
        tex_path = temp_dir / "report.tex"
        tex_path.write_text(tex_source, encoding="utf-8")

        command = _latex_command()
        run = subprocess.run(
            command,
            cwd=temp_dir,
            check=False,
            capture_output=True,
            text=True,
            timeout=LATEX_TIMEOUT_SECONDS,
        )
        if run.returncode != 0:
            stderr = _clean_latex_log(run.stderr or run.stdout or "")
            raise HTTPException(
                status_code=422,
                detail=f"Erreur de compilation LaTeX: {stderr}",
            )

        pdf_path = temp_dir / "report.pdf"
        if not pdf_path.exists() or pdf_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="PDF genere vide ou introuvable.")

        pdf_bytes = pdf_path.read_bytes()
        filename = "rapport-eolien.pdf"
        return pdf_bytes, filename
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Timeout de compilation LaTeX.") from exc
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
