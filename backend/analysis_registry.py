from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from fastapi import HTTPException

from .analysis_engine import compute_analysis, load_and_prepare_dataframe

ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPT_DIR = ROOT_DIR / "script"
DEFAULT_DATA_FILE = SCRIPT_DIR / "donnees.txt"


def _run_standard_notebook_analysis(notebook_path: str) -> dict[str, Any]:
    df = load_and_prepare_dataframe(DEFAULT_DATA_FILE)
    return compute_analysis(
        df,
        source_notebook=notebook_path,
        source_data_file="script/donnees.txt",
    )


def analyse_main_louis() -> dict[str, Any]:
    return _run_standard_notebook_analysis("script/main_louis.ipynb")


def analyse_main_adil() -> dict[str, Any]:
    return _run_standard_notebook_analysis("script/main_adil.ipynb")


def analyse_main_jules() -> dict[str, Any]:
    return _run_standard_notebook_analysis("script/main_jules.ipynb")


def analyse_main() -> dict[str, Any]:
    return _run_standard_notebook_analysis("script/main.ipynb")


ANALYSIS_HANDLERS: dict[str, Callable[[], dict[str, Any]]] = {
    "main-louis": analyse_main_louis,
    "main-adil": analyse_main_adil,
    "main-jules": analyse_main_jules,
    "main": analyse_main,
}


def run_analysis(analysis_id: str) -> dict[str, Any]:
    handler = ANALYSIS_HANDLERS.get(analysis_id)
    if handler is None:
        available = ", ".join(sorted(ANALYSIS_HANDLERS.keys()))
        raise HTTPException(
            status_code=404,
            detail=f"Analyse inconnue '{analysis_id}'. Analyses disponibles: {available}",
        )
    return handler()
