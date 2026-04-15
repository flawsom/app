#!/usr/bin/env python3
"""
UNIFY Platform Backend API Testing Suite
Tests all intelligence endpoints and core functionality
"""

import requests
import sys
import json
from datetime import datetime

class UnifyAPITester:
    def __init__(self, base_url="https://auth-debug-105.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tokens = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_result(self, test_name, success, status_code=None, error=None, response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {error}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "status_code": status_code,
            "error": error,
            "response_data": response_data[:200] if isinstance(response_data, str) else str(response_data)[:200] if response_data else None
        })

    def test_health(self):
        """Test health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=10)
            success = response.status_code == 200
            self.log_result("Health Check", success, response.status_code, 
                          None if success else f"Status {response.status_code}")
            return success
        except Exception as e:
            self.log_result("Health Check", False, None, str(e))
            return False

    def login_user(self, email, password, role_name):
        """Login and store token"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.tokens[role_name] = {
                    "token": data.get("access_token"),
                    "user_data": data
                }
                self.log_result(f"Login {role_name}", True, 200)
                return True
            else:
                self.log_result(f"Login {role_name}", False, response.status_code, 
                              f"Login failed: {response.text[:100]}")
                return False
        except Exception as e:
            self.log_result(f"Login {role_name}", False, None, str(e))
            return False

    def test_authenticated_endpoint(self, endpoint, role, method="GET", data=None, expected_status=200):
        """Test authenticated endpoint"""
        if role not in self.tokens:
            self.log_result(f"{endpoint} ({role})", False, None, f"No token for {role}")
            return False

        headers = {"Authorization": f"Bearer {self.tokens[role]['token']}"}
        if data:
            headers["Content-Type"] = "application/json"

        try:
            if method == "GET":
                response = self.session.get(f"{self.base_url}{endpoint}", headers=headers, timeout=10)
            elif method == "POST":
                response = self.session.post(f"{self.base_url}{endpoint}", headers=headers, 
                                           json=data, timeout=10)
            elif method == "PUT":
                response = self.session.put(f"{self.base_url}{endpoint}", headers=headers, 
                                          json=data, timeout=10)

            success = response.status_code == expected_status
            self.log_result(f"{endpoint} ({role})", success, response.status_code,
                          None if success else f"Expected {expected_status}, got {response.status_code}")
            return success
        except Exception as e:
            self.log_result(f"{endpoint} ({role})", False, None, str(e))
            return False

    def run_comprehensive_tests(self):
        """Run all tests"""
        print("🚀 Starting UNIFY Platform Backend Tests")
        print("=" * 60)

        # Test health first
        if not self.test_health():
            print("❌ Health check failed - stopping tests")
            return False

        # Test authentication for all roles
        test_accounts = [
            ("sibaprasadpanda56@gmail.com", "siba-4738", "student"),
            ("admin@example.com", "admin123", "admin"),
            ("employer@unify.com", "employer123", "employer"),
            ("mentor@unify.com", "mentor123", "mentor"),
            ("placement@unify.com", "placement123", "placement")
        ]

        print("\n📋 Testing Authentication...")
        for email, password, role in test_accounts:
            self.login_user(email, password, role)

        # Test core endpoints
        print("\n🔧 Testing Core Endpoints...")
        if "student" in self.tokens:
            self.test_authenticated_endpoint("/api/auth/me", "student")
            self.test_authenticated_endpoint("/api/profile", "student")
            self.test_authenticated_endpoint("/api/profile/strength", "student")

        # Test intelligence endpoints
        print("\n🧠 Testing Intelligence Endpoints...")
        if "student" in self.tokens:
            self.test_authenticated_endpoint("/api/next-action", "student")
            self.test_authenticated_endpoint("/api/recommendations", "student")
            self.test_authenticated_endpoint("/api/skill-gap", "student")
            self.test_authenticated_endpoint("/api/momentum", "student")
            self.test_authenticated_endpoint("/api/leaderboard", "student")
            self.test_authenticated_endpoint("/api/activity-stream", "student")

        # Test job and application endpoints
        print("\n💼 Testing Job & Application Endpoints...")
        if "student" in self.tokens:
            self.test_authenticated_endpoint("/api/jobs", "student")
            self.test_authenticated_endpoint("/api/applications", "student")
            self.test_authenticated_endpoint("/api/certificates", "student")
            self.test_authenticated_endpoint("/api/notifications", "student")
            self.test_authenticated_endpoint("/api/interviews", "student")

        # Test employer endpoints
        print("\n🏢 Testing Employer Endpoints...")
        if "employer" in self.tokens:
            self.test_authenticated_endpoint("/api/jobs", "employer")
            self.test_authenticated_endpoint("/api/applications", "employer")

        # Test admin endpoints
        print("\n👑 Testing Admin Endpoints...")
        if "admin" in self.tokens:
            self.test_authenticated_endpoint("/api/users", "admin")
            self.test_authenticated_endpoint("/api/analytics/overview", "admin")
            self.test_authenticated_endpoint("/api/analytics/placements", "admin")

        # Test behavior tracking
        print("\n📊 Testing Behavior Tracking...")
        if "student" in self.tokens:
            self.test_authenticated_endpoint("/api/behavior/track", "student", "POST", 
                                           {"event_type": "page_view", "target": "test"})

        # Test chatbot
        print("\n🤖 Testing Chatbot...")
        if "student" in self.tokens:
            self.test_authenticated_endpoint("/api/chatbot", "student", "POST", 
                                           {"message": "Hello"})

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        print(f"✅ Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Save results
        with open("/app/test_reports/backend_test_results.json", "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "success_rate": f"{(self.tests_passed/self.tests_run)*100:.1f}%",
                "results": self.results
            }, f, indent=2)

        return self.tests_passed == self.tests_run

def main():
    tester = UnifyAPITester()
    success = tester.run_comprehensive_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())