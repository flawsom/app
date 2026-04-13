#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class UnifyAPITester:
    def __init__(self, base_url="https://auth-debug-105.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def log_result(self, test_name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
            if expected_status and actual_status:
                print(f"   Expected: {expected_status}, Got: {actual_status}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "expected_status": expected_status,
            "actual_status": actual_status,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_result(name, True)
                    return True, response_data
                except:
                    self.log_result(name, True, "No JSON response")
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    self.log_result(name, False, f"API Error: {error_data.get('detail', 'Unknown error')}", expected_status, response.status_code)
                except:
                    self.log_result(name, False, f"HTTP {response.status_code}", expected_status, response.status_code)
                return False, {}

        except requests.exceptions.Timeout:
            self.log_result(name, False, "Request timeout", expected_status, "TIMEOUT")
            return False, {}
        except Exception as e:
            self.log_result(name, False, f"Exception: {str(e)}", expected_status, "EXCEPTION")
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "/api/health", 200)

    def test_login(self, email, password):
        """Test login and store token"""
        success, response = self.run_test("Login", "POST", "/api/auth/login", 200, 
                                        {"email": email, "password": password})
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True, response
        return False, {}

    def test_auth_me(self):
        """Test auth/me endpoint"""
        return self.run_test("Auth Me", "GET", "/api/auth/me", 200)

    def test_profile(self):
        """Test profile endpoint"""
        return self.run_test("Get Profile", "GET", "/api/profile", 200)

    def test_next_action(self):
        """Test next-action intelligence endpoint"""
        return self.run_test("Next Action Intelligence", "GET", "/api/next-action", 200)

    def test_control_system(self):
        """Test control system endpoint"""
        return self.run_test("Control System", "GET", "/api/control", 200)

    def test_hiring_probability(self, job_id="test_job_id"):
        """Test hiring probability calculation"""
        return self.run_test("Hiring Probability", "POST", "/api/hiring-probability", 200, 
                           {"job_id": job_id})

    def test_best_candidates(self):
        """Test employer best candidates endpoint"""
        return self.run_test("Best Candidates", "GET", "/api/employer/best-candidates", 200)

    def test_jobs_list(self):
        """Test jobs listing"""
        return self.run_test("Jobs List", "GET", "/api/jobs", 200)

    def test_applications_list(self):
        """Test applications listing"""
        return self.run_test("Applications List", "GET", "/api/applications", 200)

    def test_certificates_list(self):
        """Test certificates listing"""
        return self.run_test("Certificates List", "GET", "/api/certificates", 200)

    def test_notifications(self):
        """Test notifications"""
        return self.run_test("Notifications", "GET", "/api/notifications", 200)

    def test_interviews(self):
        """Test interviews"""
        return self.run_test("Interviews", "GET", "/api/interviews", 200)

    def test_momentum(self):
        """Test momentum system"""
        return self.run_test("Momentum System", "GET", "/api/momentum", 200)

    def test_profile_strength(self):
        """Test profile strength"""
        return self.run_test("Profile Strength", "GET", "/api/profile/strength", 200)

    def test_recommendations(self):
        """Test AI recommendations"""
        return self.run_test("AI Recommendations", "GET", "/api/recommendations", 200)

    def test_skill_gap(self):
        """Test skill gap analysis"""
        return self.run_test("Skill Gap Analysis", "GET", "/api/skill-gap", 200)

    def test_leaderboard(self):
        """Test leaderboard"""
        return self.run_test("Leaderboard", "GET", "/api/leaderboard", 200)

    def test_activity_stream(self):
        """Test activity stream"""
        return self.run_test("Activity Stream", "GET", "/api/activity-stream", 200)

    def save_results(self):
        """Save test results to file"""
        results_data = {
            "test_run_timestamp": datetime.now().isoformat(),
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": f"{(self.tests_passed/max(self.tests_run,1)*100):.1f}%",
            "results": self.results
        }
        
        with open('/app/test_reports/backend_test_results.json', 'w') as f:
            json.dump(results_data, f, indent=2)
        
        return results_data

def main():
    print("🚀 UNIFY Platform API Testing")
    print("=" * 50)
    
    tester = UnifyAPITester()
    
    # Test health first
    print("\n📊 Basic Health Check")
    tester.test_health()
    
    # Test student login
    print("\n🔐 Student Authentication")
    login_success, login_data = tester.test_login("sibaprasadpanda56@gmail.com", "siba-4738")
    
    if not login_success:
        print("❌ Login failed - cannot proceed with authenticated tests")
        tester.save_results()
        return 1
    
    print(f"✅ Login successful - Token: {tester.token[:20]}...")
    
    # Test auth verification
    tester.test_auth_me()
    
    # Test core profile endpoints
    print("\n👤 Profile & Core Data")
    tester.test_profile()
    tester.test_profile_strength()
    
    # Test intelligence layer endpoints (NEW FEATURES)
    print("\n🧠 Intelligence Layer (NEW)")
    tester.test_next_action()
    tester.test_control_system()
    
    # Test hiring probability with a mock job ID
    print("\n📈 Hiring Probability Engine")
    tester.test_hiring_probability("mock_job_id")
    
    # Test job and application endpoints
    print("\n💼 Jobs & Applications")
    tester.test_jobs_list()
    tester.test_applications_list()
    
    # Test AI features
    print("\n🤖 AI Features")
    tester.test_recommendations()
    tester.test_skill_gap()
    
    # Test gamification features
    print("\n🎮 Gamification")
    tester.test_momentum()
    tester.test_leaderboard()
    tester.test_activity_stream()
    
    # Test other features
    print("\n📋 Other Features")
    tester.test_certificates_list()
    tester.test_notifications()
    tester.test_interviews()
    
    # Test employer-specific endpoints (will likely fail with 403 for student user)
    print("\n🏢 Employer Features (Expected 403 for student)")
    tester.test_best_candidates()
    
    # Save results
    results = tester.save_results()
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {results['success_rate']}")
    
    # Categorize results
    intelligence_tests = [r for r in tester.results if any(keyword in r['test'].lower() for keyword in ['next action', 'control', 'hiring probability', 'best candidates'])]
    intelligence_passed = sum(1 for t in intelligence_tests if t['success'])
    
    print(f"\n🧠 Intelligence Layer: {intelligence_passed}/{len(intelligence_tests)} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    elif tester.tests_passed / tester.tests_run >= 0.8:
        print("\n✅ MOSTLY SUCCESSFUL (80%+ pass rate)")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())