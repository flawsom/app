import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unify-seal.preview.emergentagent.com").rstrip("/")
SCHEDULER_SECRET = "unify_sched_8f3a2b7c1d9e4a6f5c0b3d8e2a7f1c4b"

ADMIN_EMAIL = "admin@unifies.codes"
ADMIN_PASSWORD = "siba-4738"
STUDENT_EMAIL = "student@unifies.codes"
STUDENT_PASSWORD = "student-demo-2026"
EMPLOYER_EMAIL = "employer@unifies.codes"
EMPLOYER_PASSWORD = "employer-demo-2026"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code != 200:
        return None, None
    d = r.json()
    return d.get("access_token"), d.get("id")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def scheduler_secret():
    return SCHEDULER_SECRET


@pytest.fixture(scope="session")
def admin_auth():
    token, uid = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin login failed")
    return {"token": token, "id": uid, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="session")
def student_auth():
    token, uid = _login(STUDENT_EMAIL, STUDENT_PASSWORD)
    if not token:
        pytest.skip("Student login failed")
    return {"token": token, "id": uid, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="session")
def employer_auth():
    token, uid = _login(EMPLOYER_EMAIL, EMPLOYER_PASSWORD)
    if not token:
        pytest.skip("Employer login failed")
    return {"token": token, "id": uid, "headers": {"Authorization": f"Bearer {token}"}}
