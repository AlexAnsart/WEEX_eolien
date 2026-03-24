from __future__ import annotations

import base64
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.reporting import EolienReportPayload


_PNG_1X1_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7ZxaoAAAAASUVORK5CYII="
)


def _sample_payload() -> dict:
    return {
        "reportVersion": 1,
        "metadata": {
            "title": "Rapport test",
            "ue": "WEEX",
            "students": ["Etudiant Test"],
        },
        "genericSections": {
            "introduction": "Introduction suffisamment longue pour le schema.",
            "theoreticalFramework": "Cadre theorique suffisamment long pour valider le schema.",
            "methodology": "Methodologie suffisamment detaillee pour valider le schema.",
            "conclusion": "Conclusion suffisamment detaillee pour valider le schema.",
        },
        "analysisSummary": {
            "sourceNotebook": "script/main_louis.ipynb",
            "sourceDataFile": "script/donnees.txt",
            "kpis": {"availability": 92.4, "capacityFactor": 0.31, "ratedPower": 2.2},
        },
        "chartSections": [
            {
                "id": "powerCurve",
                "title": "Courbe de puissance",
                "caption": "Courbe test",
                "interpretation": "Interpretation test",
                "imageBase64": _PNG_1X1_BASE64,
            }
        ],
        "generatedAtIso": "2026-03-23T10:00:00Z",
    }


class ReportingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_payload_schema_accepts_valid_payload(self) -> None:
        payload = EolienReportPayload.model_validate(_sample_payload())
        self.assertEqual(payload.reportVersion, 1)
        self.assertEqual(payload.metadata.ue, "WEEX")

    def test_payload_rejects_missing_fields(self) -> None:
        bad_payload = _sample_payload()
        del bad_payload["metadata"]["title"]
        with self.assertRaises(Exception):
            EolienReportPayload.model_validate(bad_payload)

    @patch("backend.main.compile_report_to_pdf", return_value=(base64.b64decode(_PNG_1X1_BASE64), "test.pdf"))
    def test_generate_endpoint_returns_pdf(self, _compile_mock) -> None:
        response = self.client.post("/api/reports/eolien/generate", json=_sample_payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/pdf")
        self.assertGreater(len(response.content), 0)

    @patch("backend.main.compile_report_to_pdf", side_effect=Exception("Image manquante"))
    def test_generate_endpoint_reports_errors(self, _compile_mock) -> None:
        response = self.client.post("/api/reports/eolien/generate", json=_sample_payload())
        self.assertGreaterEqual(response.status_code, 500)


if __name__ == "__main__":
    unittest.main()
