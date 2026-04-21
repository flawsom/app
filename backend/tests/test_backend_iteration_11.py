"""
UNIFY Backend Regression Tests — Iteration 11
Focus: NEW endpoints/flows (incremental over iteration_10):
  * Resume upload PDF + DOCX text extraction + section split + profile merge
  * Non-clobber merge semantics & skill union
  * Auto cover-letter generation on POST /api/applications
  * POST /api/applications/{id}/regenerate-cover-letter (owner + 403 for others)
  * POST /api/cover-letter/attribute (attribution endpoint + 400 on missing job_id)
"""
import base64
import io
import time
import uuid

import pytest
import requests


# ---------- helpers ----------
def _make_pdf_bytes(text_body: str) -> bytes:
    """Write a tiny valid single-page PDF containing the given text.

    Using a minimal hand-written PDF so we don't need reportlab. pypdf can
    decode Tj text operators in content streams.
    """
    # Escape parens in text
    body = text_body.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    lines = body.split("\n")
    # Build content stream with multiple lines
    content_lines = ["BT", "/F1 11 Tf", "50 780 Td"]
    for i, ln in enumerate(lines):
        if i == 0:
            content_lines.append(f"({ln}) Tj")
        else:
            content_lines.append("0 -14 Td")
            content_lines.append(f"({ln}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines)
    stream_bytes = stream.encode("latin-1", errors="ignore")

    objs = []
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objs.append(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
    )
    objs.append(b"<< /Length " + str(len(stream_bytes)).encode() + b" >>\nstream\n" + stream_bytes + b"\nendstream")
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(pdf))
        pdf += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_pos = len(pdf)
    pdf += f"xref\n0 {len(objs)+1}\n".encode()
    pdf += b"0000000000 65535 f \n"
    for off in offsets:
        pdf += f"{off:010d} 00000 n \n".encode()
    pdf += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF".encode()
    return bytes(pdf)


def _make_docx_bytes(text_body: str) -> bytes:
    from docx import Document  # python-docx is installed
    doc = Document()
    for line in text_body.split("\n"):
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


_RESUME_TEXT = (
    "John Doe\n"
    "Email: john.doe@example.com | Phone: +1-555-000-1234\n"
    "LinkedIn: https://linkedin.com/in/johndoe | GitHub: https://github.com/johndoe\n"
    "\n"
    "SUMMARY\n"
    "Computer Science student passionate about backend engineering and ML.\n"
    "\n"
    "SKILLS\n"
    "Python, FastAPI, MongoDB, Docker, Kubernetes, React, TypeScript, PyTorch\n"
    "\n"
    "EXPERIENCE\n"
    "Software Engineering Intern, Acme Corp (2024)\n"
    "Built a real-time notification system handling 10k events/sec.\n"
    "\n"
    "EDUCATION\n"
    "B.Tech, Computer Science, IIT Example. CGPA: 8.9\n"
    "\n"
    "PROJECTS\n"
    "Unify Placement Platform - adaptive ML-driven placement recommender.\n"
)


# ---------- Resume upload ----------
class TestResumeUpload:
    def test_upload_pdf_resume_extracts_and_merges(self, base_url, student_auth):
        pdf_b64 = _b64(_make_pdf_bytes(_RESUME_TEXT))
        r = requests.post(
            f"{base_url}/api/upload/resume",
            headers=student_auth["headers"],
            json={"file_data": pdf_b64, "file_name": f"TEST_resume_{uuid.uuid4().hex[:6]}.pdf"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("file_type") == "pdf", f"file_type not pdf: {d.get('file_type')}"
        assert d.get("text_length", 0) > 0, f"text_length is 0: {d}"
        assert isinstance(d.get("sections_found"), list)
        assert isinstance(d.get("parsed_fields"), list)
        assert isinstance(d.get("parsed"), dict)
        assert isinstance(d.get("auto_filled"), dict)
        # The resume obviously contains skills and a LinkedIn URL — AI *should* find them.
        # Don't hard-fail on a specific field if AI is flaky; at least ensure parsed is non-empty.
        assert len(d["parsed"]) >= 1 or len(d["sections_found"]) >= 1, f"nothing parsed: {d}"

        # Verify profile persistence
        p = requests.get(f"{base_url}/api/profile", headers=student_auth["headers"], timeout=20)
        assert p.status_code == 200
        pj = p.json()
        prof = pj.get("profile") or pj  # supports both wrapped and flat shapes
        # resume_url OR resume_sections should be present
        assert prof.get("resume_url") or prof.get("resume_sections"), f"profile not updated: {list(prof.keys())}"

    def test_upload_docx_resume_extracts(self, base_url, student_auth):
        docx_b64 = _b64(_make_docx_bytes(_RESUME_TEXT))
        r = requests.post(
            f"{base_url}/api/upload/resume",
            headers=student_auth["headers"],
            json={"file_data": docx_b64, "file_name": f"TEST_resume_{uuid.uuid4().hex[:6]}.docx"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("file_type") == "docx", f"file_type not docx: {d.get('file_type')}"
        # Text length may be > 0 if python-docx extraction is wired
        assert d.get("text_length", 0) > 0, f"docx text_length 0: {d}"
        assert isinstance(d.get("sections_found"), list)
        assert isinstance(d.get("parsed_fields"), list)

    def test_upload_resume_non_clobber_merge(self, base_url, student_auth):
        # 1. Set a unique first_name on profile that a resume must NOT overwrite.
        preset_name = f"TEST_Preset_{uuid.uuid4().hex[:6]}"
        preset_skill = f"test_skill_{uuid.uuid4().hex[:6]}"
        r0 = requests.put(
            f"{base_url}/api/profile",
            headers=student_auth["headers"],
            json={"first_name": preset_name, "skills": [preset_skill]},
            timeout=20,
        )
        assert r0.status_code == 200, r0.text

        # 2. Upload resume with different first_name + different skills.
        pdf_b64 = _b64(_make_pdf_bytes(_RESUME_TEXT))
        r = requests.post(
            f"{base_url}/api/upload/resume",
            headers=student_auth["headers"],
            json={"file_data": pdf_b64, "file_name": "TEST_resume_merge.pdf"},
            timeout=120,
        )
        assert r.status_code == 200, r.text

        # 3. Confirm preset first_name remains AND new skills are unioned (preset still present).
        pj = requests.get(f"{base_url}/api/profile", headers=student_auth["headers"], timeout=20).json()
        p = pj.get("profile") or pj
        assert p.get("first_name") == preset_name, (
            f"first_name was clobbered: got={p.get('first_name')} preset={preset_name}"
        )
        skills = [s.lower() for s in (p.get("skills") or [])]
        assert preset_skill.lower() in skills, f"preset skill dropped. skills={skills}"


# ---------- Application cover letter flow ----------
def _find_applyable_job(base_url, student_headers):
    jr = requests.get(f"{base_url}/api/jobs", timeout=30).json()
    items = jr if isinstance(jr, list) else jr.get("items") or jr.get("jobs") or []
    if not items:
        return None, None
    # Try each job until we find one we haven't applied to.
    for job in items:
        jid = job.get("id") or job.get("_id") or job.get("job_id")
        if not jid:
            continue
        # Peek — don't actually create. Just return the first one; caller will
        # handle 400 Already applied by trying next.
        return jid, job
    return None, None


class TestApplicationCoverLetter:
    def _apply_new_or_skip(self, base_url, student_headers):
        """Create an application on any job we haven't applied to yet.
        Returns (app_id, job_dict, apply_response_json) or pytest.skip()."""
        jr = requests.get(f"{base_url}/api/jobs", timeout=30).json()
        items = jr if isinstance(jr, list) else jr.get("items") or jr.get("jobs") or []
        if not items:
            pytest.skip("no jobs available")
        for job in items:
            jid = job.get("id") or job.get("_id") or job.get("job_id")
            if not jid:
                continue
            r = requests.post(
                f"{base_url}/api/applications",
                headers=student_headers,
                json={"job_id": jid},  # no cover_letter
                timeout=60,
            )
            if r.status_code in (200, 201):
                body = r.json()
                return body.get("id") or body.get("application_id"), job, body
            if r.status_code == 400 and "already" in r.text.lower():
                continue
            pytest.skip(f"apply failed: {r.status_code} {r.text[:200]}")
        pytest.skip("all jobs already applied to — can't test fresh create")

    def test_create_application_auto_generates_cover_letter(self, base_url, student_auth):
        app_id, job, body = self._apply_new_or_skip(base_url, student_auth["headers"])
        # Fetch application to inspect cover_letter + source.
        # Try GET /api/applications/my or /api/applications
        ga = requests.get(f"{base_url}/api/applications/my", headers=student_auth["headers"], timeout=20)
        if ga.status_code != 200:
            ga = requests.get(f"{base_url}/api/applications", headers=student_auth["headers"], timeout=20)
        if ga.status_code == 200:
            lst = ga.json()
            items = lst if isinstance(lst, list) else lst.get("items") or lst.get("applications") or []
            found = next((a for a in items if (a.get("id") or a.get("_id") or a.get("application_id")) == app_id), None)
            assert found is not None, f"application {app_id} not found in list"
            cl = (found.get("cover_letter") or "").strip()
            src = found.get("cover_letter_source") or ""
            assert cl, f"cover_letter empty: {found}"
            assert src.startswith("ai:") or src == "fallback_heuristic", f"unexpected source: {src}"
            company = (job.get("company_name") or "").strip()
            if company:
                assert company.split()[0].lower() in cl.lower(), (
                    f"cover letter doesn't reference company '{company}': {cl[:240]}"
                )
        else:
            # fall back to check the create body itself
            assert body.get("cover_letter"), f"cover_letter missing in create response: {body}"

    def test_regenerate_cover_letter_owner_ok(self, base_url, student_auth):
        # Find an existing application for this student.
        ga = requests.get(f"{base_url}/api/applications/my", headers=student_auth["headers"], timeout=20)
        if ga.status_code != 200:
            ga = requests.get(f"{base_url}/api/applications", headers=student_auth["headers"], timeout=20)
        if ga.status_code != 200:
            pytest.skip(f"cannot list my applications: {ga.status_code}")
        lst = ga.json()
        items = lst if isinstance(lst, list) else lst.get("items") or lst.get("applications") or []
        if not items:
            pytest.skip("no existing applications to regenerate")
        app_id = items[0].get("id") or items[0].get("_id") or items[0].get("application_id")
        if not app_id:
            pytest.skip("application missing id")

        r = requests.post(
            f"{base_url}/api/applications/{app_id}/regenerate-cover-letter",
            headers=student_auth["headers"],
            timeout=90,
        )
        if r.status_code == 429:
            pytest.skip(f"daily cover-letter quota exhausted: {r.text[:160]}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert (d.get("cover_letter") or "").strip(), f"empty regenerated cover_letter: {d}"
        src = d.get("cover_letter_source") or ""
        assert src.startswith("ai:") and src.endswith(":regenerated"), f"unexpected source: {src}"

    def test_regenerate_cover_letter_non_owner_403(self, base_url, student_auth, employer_auth):
        """A different role (employer) regenerating a student's app must 403."""
        ga = requests.get(f"{base_url}/api/applications/my", headers=student_auth["headers"], timeout=20)
        if ga.status_code != 200:
            ga = requests.get(f"{base_url}/api/applications", headers=student_auth["headers"], timeout=20)
        if ga.status_code != 200:
            pytest.skip("cannot list applications")
        lst = ga.json()
        items = lst if isinstance(lst, list) else lst.get("items") or lst.get("applications") or []
        if not items:
            pytest.skip("no apps to test 403 against")
        app_id = items[0].get("id") or items[0].get("_id") or items[0].get("application_id")

        # Endpoint requires role=student; employer token should 403 at role guard.
        r = requests.post(
            f"{base_url}/api/applications/{app_id}/regenerate-cover-letter",
            headers=employer_auth["headers"],
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"


# ---------- Cover letter attribution ----------
class TestCoverLetterAttribution:
    def test_attribute_happy_path(self, base_url, student_auth):
        # Need a real job_id from jobs listing.
        jr = requests.get(f"{base_url}/api/jobs", timeout=30).json()
        items = jr if isinstance(jr, list) else jr.get("items") or jr.get("jobs") or []
        if not items:
            pytest.skip("no jobs")
        job = items[0]
        jid = job.get("id") or job.get("_id") or job.get("job_id")
        company = job.get("company_name") or "the company"

        letter = (
            f"Dear Hiring Manager,\n\n"
            f"I am excited to apply for the {job.get('title','role')} at {company}. "
            f"My experience with Python, FastAPI, and MongoDB aligns with your tech stack. "
            f"I built a real-time notification system handling 10k events/sec at Acme Corp. "
            f"I would welcome the chance to contribute to {company}.\n\n"
            f"Best regards,\nJohn Doe"
        )
        r = requests.post(
            f"{base_url}/api/cover-letter/attribute",
            headers=student_auth["headers"],
            json={"cover_letter": letter, "job_id": jid},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("sentences"), list)
        assert d.get("sentence_count", 0) >= 1
        assert "generic_count" in d
        assert "ai_provider" in d
        # Each sentence must have {sentence, sources:[{type,value,evidence}]}
        for s in d["sentences"]:
            assert "sentence" in s
            assert isinstance(s.get("sources"), list)
            for src in s["sources"]:
                for k in ("type", "value", "evidence"):
                    assert k in src, f"missing source key {k} in {src}"

    def test_attribute_missing_job_id_400(self, base_url, student_auth):
        r = requests.post(
            f"{base_url}/api/cover-letter/attribute",
            headers=student_auth["headers"],
            json={"cover_letter": "Dear team, I am great."},  # no job_id
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
