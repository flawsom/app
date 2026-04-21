#!/usr/bin/env python3
"""
UNIFY Backend API Testing Suite
Tests the master rebrand backend implementation with priority order:
1. Health endpoint
2. Auth flows  
3. AI router + rate limits
4. Live jobs
5. Cover letter generation
6. Recommendations
7. Core CRUD smoke tests
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://hiring-engine-dev.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDS = {"email": "admin@unifies.codes", "password": "siba-4738"}
STUDENT_CREDS = {"email": "student@unifies.codes", "password": "student-demo-2026"}

class UnifyAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.student_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result with details"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, token: str = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{BASE_URL}{endpoint}"
        
        # Set up headers
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        if token:
            req_headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=req_headers)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=req_headers)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=req_headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
                
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
                
            return response.status_code < 400, response_data, response.status_code
            
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_health_endpoint(self):
        """Test 1: Health endpoint - GET /api/health"""
        print("=== TESTING HEALTH ENDPOINT ===")
        
        success, data, status_code = self.make_request("GET", "/health")
        
        if not success or status_code != 200:
            self.log_result("Health endpoint", False, f"Expected 200, got {status_code}", data)
            return
            
        # Check required fields
        required_checks = [
            ("status", lambda x: x in ["ok", "degraded"]),
            ("version", lambda x: x == "1.0.0"),
            ("mongo.ok", lambda x: x is True),
            ("ai_providers.gemini", lambda x: x is True),
            ("ai_providers.unify_key", lambda x: x is True),
            ("integrations.jsearch", lambda x: x is True),
            ("integrations.adzuna", lambda x: x is True),
            ("integrations.clearbit_logo", lambda x: x is True)
        ]
        
        failed_checks = []
        for field_path, check_func in required_checks:
            try:
                # Navigate nested fields
                value = data
                for key in field_path.split("."):
                    value = value[key]
                if not check_func(value):
                    failed_checks.append(f"{field_path}={value}")
            except KeyError:
                failed_checks.append(f"{field_path}=MISSING")
                
        if failed_checks:
            self.log_result("Health endpoint", False, f"Failed checks: {', '.join(failed_checks)}", data)
        else:
            # Note expected false values
            expected_false = []
            try:
                if not data.get("ai_providers", {}).get("anthropic", True):
                    expected_false.append("anthropic=false (expected)")
                if not data.get("ai_providers", {}).get("openai", True):
                    expected_false.append("openai=false (expected)")
                if not data.get("sentry", True):
                    expected_false.append("sentry=false (expected)")
            except:
                pass
                
            details = "All required checks passed"
            if expected_false:
                details += f". Expected false values: {', '.join(expected_false)}"
            self.log_result("Health endpoint", True, details, data)

    def test_auth_flows(self):
        """Test 2: Authentication flows"""
        print("=== TESTING AUTH FLOWS ===")
        
        # Test admin login
        success, data, status_code = self.make_request("POST", "/auth/login", ADMIN_CREDS)
        if success and status_code == 200 and "access_token" in data:
            self.admin_token = data["access_token"]
            role = data.get("role", "unknown")
            self.log_result("Admin login", True, f"Login successful, role={role}")
        else:
            self.log_result("Admin login", False, f"Expected 200 with access_token, got {status_code}", data)
            
        # Test student login  
        success, data, status_code = self.make_request("POST", "/auth/login", STUDENT_CREDS)
        if success and status_code == 200 and "access_token" in data:
            self.student_token = data["access_token"]
            role = data.get("role", "unknown")
            self.log_result("Student login", True, f"Login successful, role={role}")
        else:
            self.log_result("Student login", False, f"Expected 200 with access_token, got {status_code}", data)
            
        # Test Google OAuth deprecation - /api/auth/google/session should return 410
        success, data, status_code = self.make_request("POST", "/auth/google/session", {})
        if status_code == 410:
            self.log_result("Google OAuth session deprecation", True, "Returns 410 Gone as expected")
        else:
            self.log_result("Google OAuth session deprecation", False, f"Expected 410, got {status_code}", data)
            
        # Test Google OAuth verify - missing credential should return 400
        success, data, status_code = self.make_request("POST", "/auth/google/verify", {})
        if status_code == 400:
            self.log_result("Google OAuth verify - missing credential", True, "Returns 400 as expected")
        else:
            self.log_result("Google OAuth verify - missing credential", False, f"Expected 400, got {status_code}", data)
            
        # Test Google OAuth verify - invalid credential should return 401
        success, data, status_code = self.make_request("POST", "/auth/google/verify", {"credential": "invalid"})
        if status_code == 401:
            self.log_result("Google OAuth verify - invalid credential", True, "Returns 401 as expected")
        else:
            self.log_result("Google OAuth verify - invalid credential", False, f"Expected 401, got {status_code}", data)

    def test_ai_router_and_rate_limits(self):
        """Test 3: AI router + rate limits (requires student login)"""
        print("=== TESTING AI ROUTER + RATE LIMITS ===")
        
        if not self.student_token:
            self.log_result("AI router tests", False, "No student token available - skipping AI tests")
            return
            
        # Test chatbot
        success, data, status_code = self.make_request("POST", "/chatbot", 
                                                     {"message": "hello"}, 
                                                     token=self.student_token)
        if success and status_code == 200:
            ai_provider = data.get("ai_provider", "unknown")
            has_response = "response" in data or "text" in data
            has_quota = "quota" in data
            if has_response and ai_provider in ["gemini", "unify_key", "openai", "anthropic", "fallback_heuristic"]:
                self.log_result("Chatbot AI", True, f"Response received, provider={ai_provider}, quota={has_quota}")
            else:
                self.log_result("Chatbot AI", False, f"Missing response or invalid provider: {ai_provider}", data)
        else:
            self.log_result("Chatbot AI", False, f"Expected 200, got {status_code}", data)
            
        # Test roast-profile
        success, data, status_code = self.make_request("POST", "/roast-profile", {}, token=self.student_token)
        if success and status_code == 200:
            required_fields = ["roast", "score", "fix", "ai_provider", "quota"]
            missing_fields = [f for f in required_fields if f not in data]
            if not missing_fields:
                ai_provider = data.get("ai_provider", "unknown")
                self.log_result("Roast profile AI", True, f"All fields present, provider={ai_provider}")
            else:
                self.log_result("Roast profile AI", False, f"Missing fields: {missing_fields}", data)
        else:
            self.log_result("Roast profile AI", False, f"Expected 200, got {status_code}", data)
            
        # Test interview-prep
        success, data, status_code = self.make_request("POST", "/interview-prep", 
                                                     {"job_title": "Software Engineer", "company": "Acme"}, 
                                                     token=self.student_token)
        if success and status_code == 200:
            questions = data.get("questions", [])
            ai_provider = data.get("ai_provider", "unknown")
            has_quota = "quota" in data
            if len(questions) >= 1:
                self.log_result("Interview prep AI", True, f"{len(questions)} questions, provider={ai_provider}, quota={has_quota}")
            else:
                self.log_result("Interview prep AI", False, f"Expected questions array with len>=1, got {len(questions)}", data)
        else:
            self.log_result("Interview prep AI", False, f"Expected 200, got {status_code}", data)
            
        # Test resume analyze (may return 400 if no resume)
        success, data, status_code = self.make_request("POST", "/resume/analyze", {}, token=self.student_token)
        if status_code == 400:
            self.log_result("Resume analyze AI", True, "Returns 400 (no resume) as expected")
        elif success and status_code == 200:
            has_score = "score" in data
            ai_provider = data.get("ai_provider", "unknown")
            has_quota = "quota" in data
            self.log_result("Resume analyze AI", True, f"Analysis complete, score={has_score}, provider={ai_provider}, quota={has_quota}")
        else:
            self.log_result("Resume analyze AI", False, f"Expected 200 or 400, got {status_code}", data)
            
        # Test AI usage endpoint
        success, data, status_code = self.make_request("GET", "/ai-usage/me", token=self.student_token)
        if success and status_code == 200:
            required_fields = ["tier", "date", "reset_at", "endpoints"]
            missing_fields = [f for f in required_fields if f not in data]
            if not missing_fields:
                endpoints = data.get("endpoints", {})
                endpoint_count = len(endpoints)
                self.log_result("AI usage tracking", True, f"Usage data complete, {endpoint_count} endpoints tracked")
            else:
                self.log_result("AI usage tracking", False, f"Missing fields: {missing_fields}", data)
        else:
            self.log_result("AI usage tracking", False, f"Expected 200, got {status_code}", data)

    def test_live_jobs(self):
        """Test 4: Live jobs functionality"""
        print("=== TESTING LIVE JOBS ===")
        
        # Test GET /api/jobs (should auto-sync if needed)
        success, data, status_code = self.make_request("GET", "/jobs", token=self.student_token)
        if success and status_code == 200:
            jobs = data.get("jobs", [])
            pagination = data.get("pagination", {})
            self.log_result("Jobs listing", True, f"Retrieved {len(jobs)} jobs, pagination present: {bool(pagination)}")
            
            # Store a job_id for cover letter testing
            if jobs:
                self.test_job_id = jobs[0].get("id") or jobs[0].get("_id")
        else:
            self.log_result("Jobs listing", False, f"Expected 200, got {status_code}", data)
            
        # Test admin sync (requires admin token)
        if self.admin_token:
            success, data, status_code = self.make_request("POST", "/jobs/sync-live", 
                                                         {"queries": ["software intern"]}, 
                                                         token=self.admin_token)
            if success and status_code == 200:
                message = data.get("message", "")
                self.log_result("Admin job sync", True, f"Sync completed: {message}")
            else:
                self.log_result("Admin job sync", False, f"Expected 200, got {status_code}", data)
        else:
            self.log_result("Admin job sync", False, "No admin token available")
            
        # Test GET /api/jobs again after sync
        success, data, status_code = self.make_request("GET", "/jobs", token=self.student_token)
        if success and status_code == 200:
            jobs = data.get("jobs", [])
            live_jobs = [j for j in jobs if j.get("source") in ["jsearch", "adzuna"]]
            self.log_result("Jobs after sync", True, f"Total: {len(jobs)}, Live jobs: {len(live_jobs)}")
        else:
            self.log_result("Jobs after sync", False, f"Expected 200, got {status_code}", data)
            
        # Test trending jobs
        success, data, status_code = self.make_request("GET", "/trending-jobs", token=self.student_token)
        if success and status_code == 200:
            trending = data.get("trending", [])
            self.log_result("Trending jobs", True, f"Retrieved {len(trending)} trending jobs")
        else:
            self.log_result("Trending jobs", False, f"Expected 200, got {status_code}", data)

    def test_cover_letter(self):
        """Test 5: Cover letter generation (depends on jobs)"""
        print("=== TESTING COVER LETTER ===")
        
        if not self.student_token:
            self.log_result("Cover letter", False, "No student token available")
            return
            
        # Get a job ID first
        success, data, status_code = self.make_request("GET", "/jobs", token=self.student_token)
        job_id = None
        if success and data.get("jobs"):
            job_id = data["jobs"][0].get("id") or data["jobs"][0].get("_id")
            
        if not job_id:
            self.log_result("Cover letter", False, "No job ID available for testing")
            return
            
        # Test cover letter generation
        success, data, status_code = self.make_request("POST", "/cover-letter", 
                                                     {"job_id": job_id}, 
                                                     token=self.student_token)
        if success and status_code == 200:
            required_fields = ["cover_letter", "job_title", "company", "ai_provider", "quota"]
            missing_fields = [f for f in required_fields if f not in data]
            if not missing_fields:
                ai_provider = data.get("ai_provider", "unknown")
                self.log_result("Cover letter generation", True, f"Generated successfully, provider={ai_provider}")
            else:
                self.log_result("Cover letter generation", False, f"Missing fields: {missing_fields}", data)
        else:
            self.log_result("Cover letter generation", False, f"Expected 200, got {status_code}", data)

    def test_recommendations(self):
        """Test 6: Recommendations"""
        print("=== TESTING RECOMMENDATIONS ===")
        
        if not self.student_token:
            self.log_result("Recommendations", False, "No student token available")
            return
            
        success, data, status_code = self.make_request("POST", "/recommendations/generate", {}, token=self.student_token)
        if status_code == 400:
            self.log_result("Recommendations", True, "Returns 400 (profile empty) as expected")
        elif success and status_code == 200:
            required_fields = ["recommendations", "ai_provider", "quota"]
            missing_fields = [f for f in required_fields if f not in data]
            if not missing_fields:
                ai_provider = data.get("ai_provider", "unknown")
                rec_count = len(data.get("recommendations", []))
                self.log_result("Recommendations", True, f"Generated {rec_count} recommendations, provider={ai_provider}")
            else:
                self.log_result("Recommendations", False, f"Missing fields: {missing_fields}", data)
        else:
            self.log_result("Recommendations", False, f"Expected 200 or 400, got {status_code}", data)

    def test_core_crud(self):
        """Test 7: Core CRUD smoke tests"""
        print("=== TESTING CORE CRUD ===")
        
        # Register new student
        new_student = {
            "email": f"test-{int(time.time())}@unifies.codes",
            "password": "TestPass123!",
            "name": "Test Student",
            "role": "student"
        }
        
        success, data, status_code = self.make_request("POST", "/auth/register", new_student)
        if success and status_code == 200 and "access_token" in data:
            new_token = data["access_token"]
            self.log_result("Student registration", True, f"Registered {new_student['email']}")
            
            # Test /api/auth/me
            success, data, status_code = self.make_request("GET", "/auth/me", token=new_token)
            if success and status_code == 200:
                user_email = data.get("email", "unknown")
                self.log_result("Auth me endpoint", True, f"Retrieved user: {user_email}")
            else:
                self.log_result("Auth me endpoint", False, f"Expected 200, got {status_code}", data)
                
            # Update profile
            profile_data = {"skills": ["Python", "React"], "department": "CSE"}
            success, data, status_code = self.make_request("PUT", "/profile", profile_data, token=new_token)
            if success and status_code == 200:
                self.log_result("Profile update", True, "Profile updated successfully")
            else:
                self.log_result("Profile update", False, f"Expected 200, got {status_code}", data)
                
            # List jobs
            success, data, status_code = self.make_request("GET", "/jobs", token=new_token)
            if success and status_code == 200:
                jobs = data.get("jobs", [])
                self.log_result("Jobs listing (new user)", True, f"Retrieved {len(jobs)} jobs")
                
                # Apply to a job if available
                if jobs:
                    job_id = jobs[0].get("id") or jobs[0].get("_id")
                    success, data, status_code = self.make_request("POST", "/applications", 
                                                                 {"job_id": job_id}, 
                                                                 token=new_token)
                    if success and status_code == 200:
                        self.log_result("Job application", True, "Applied to job successfully")
                    else:
                        self.log_result("Job application", False, f"Expected 200, got {status_code}", data)
                        
                    # List applications
                    success, data, status_code = self.make_request("GET", "/applications", token=new_token)
                    if success and status_code == 200:
                        applications = data.get("applications", [])
                        self.log_result("Applications listing", True, f"Retrieved {len(applications)} applications")
                    else:
                        self.log_result("Applications listing", False, f"Expected 200, got {status_code}", data)
                else:
                    self.log_result("Job application", False, "No jobs available for application")
            else:
                self.log_result("Jobs listing (new user)", False, f"Expected 200, got {status_code}", data)
        else:
            self.log_result("Student registration", False, f"Expected 200 with access_token, got {status_code}", data)

    def run_all_tests(self):
        """Run all tests in priority order"""
        print("🚀 Starting UNIFY Backend API Tests")
        print(f"Backend URL: {BASE_URL}")
        print("=" * 60)
        
        # Priority order from review request
        self.test_health_endpoint()
        self.test_auth_flows()
        self.test_ai_router_and_rate_limits()
        self.test_live_jobs()
        self.test_cover_letter()
        self.test_recommendations()
        self.test_core_crud()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        
        print(f"Total tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print()
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r["success"]]
        if failed_tests:
            print("❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print("✅ ALL TESTS PASSED!")
            
        print()
        return self.test_results

if __name__ == "__main__":
    tester = UnifyAPITester()
    results = tester.run_all_tests()