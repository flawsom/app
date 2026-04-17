#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class ComprehensiveUnifyTester:
    def __init__(self, base_url="https://auth-debug-105.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []
        self.tokens = {}  # Store tokens for different user types

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

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

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

        except Exception as e:
            self.log_result(name, False, f"Exception: {str(e)}", expected_status, "EXCEPTION")
            return False, {}

    def test_login(self, email, password, user_type):
        """Test login for different user types"""
        success, response = self.run_test(f"Login - {user_type}", "POST", "/api/auth/login", 200, 
                                        {"email": email, "password": password})
        if success and 'access_token' in response:
            self.tokens[user_type] = response['access_token']
            return True, response
        return False, {}

    def test_health(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "/api/health", 200)

    def test_intelligence_endpoints(self, user_type, token):
        """Test intelligence layer endpoints"""
        print(f"\n🧠 Intelligence Layer - {user_type}")
        
        # Test next-action
        self.run_test(f"Next Action - {user_type}", "GET", "/api/next-action", 200, token=token)
        
        # Test control system (student only)
        if user_type == "Student":
            self.run_test(f"Control System - {user_type}", "GET", "/api/control", 200, token=token)
        
        # Test model weights
        self.run_test(f"Model Weights - {user_type}", "GET", "/api/model/weights", 200, token=token)
        
        # Test user behavior
        self.run_test(f"User Behavior - {user_type}", "GET", "/api/user-behavior", 200, token=token)
        
        # Test alerts
        self.run_test(f"Alerts - {user_type}", "GET", "/api/alerts", 200, token=token)

    def test_system_health_admin(self, token):
        """Test system health endpoint (admin only)"""
        return self.run_test("System Health (Admin)", "GET", "/api/system-health", 200, token=token)

    def test_real_job_hiring_probability(self, token):
        """Test hiring probability with a real job"""
        # First get jobs list
        success, jobs_data = self.run_test("Get Jobs for Probability Test", "GET", "/api/jobs", 200, token=token)
        if success and jobs_data.get('jobs'):
            job_id = jobs_data['jobs'][0]['id']
            self.run_test("Hiring Probability (Real Job)", "POST", "/api/hiring-probability", 200, 
                         {"job_id": job_id}, token=token)
        else:
            self.log_result("Hiring Probability (Real Job)", False, "No jobs available for testing")

    def save_results(self):
        """Save test results to file"""
        results_data = {
            "test_run_timestamp": datetime.now().isoformat(),
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "success_rate": f"{(self.tests_passed/max(self.tests_run,1)*100):.1f}%",
            "results": self.results,
            "user_tokens_tested": list(self.tokens.keys())
        }
        
        with open('/app/test_reports/comprehensive_backend_results.json', 'w') as f:
            json.dump(results_data, f, indent=2)
        
        return results_data

def main():
    print("🚀 COMPREHENSIVE UNIFY Platform API Testing")
    print("=" * 60)
    
    tester = ComprehensiveUnifyTester()
    
    # Test health first
    print("\n📊 Basic Health Check")
    tester.test_health()
    
    # Test all user types from requirements
    user_credentials = [
        ("sibaprasadpanda56@gmail.com", "siba-4738", "Student"),
        ("admin@unifies.codes", "admin123", "Admin"),
        ("employer@unifies.codes", "employer123", "Employer"),
        ("mentor@unifies.codes", "mentor123", "Mentor"),
        ("placement@unifies.codes", "placement123", "Placement")
    ]
    
    print("\n🔐 Authentication Tests")
    successful_logins = []
    
    for email, password, user_type in user_credentials:
        success, data = tester.test_login(email, password, user_type)
        if success:
            successful_logins.append((user_type, tester.tokens[user_type]))
            print(f"   ✅ {user_type} token: {tester.tokens[user_type][:20]}...")
    
    if not successful_logins:
        print("❌ No successful logins - cannot proceed")
        tester.save_results()
        return 1
    
    # Test intelligence endpoints for each successful login
    for user_type, token in successful_logins:
        tester.test_intelligence_endpoints(user_type, token)
    
    # Test admin-specific endpoints
    if "Admin" in tester.tokens:
        print("\n🔧 Admin-Specific Tests")
        tester.test_system_health_admin(tester.tokens["Admin"])
    
    # Test hiring probability with real job (using student token)
    if "Student" in tester.tokens:
        print("\n📈 Real Job Hiring Probability Test")
        tester.test_real_job_hiring_probability(tester.tokens["Student"])
    
    # Save results
    results = tester.save_results()
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 COMPREHENSIVE TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {results['success_rate']}")
    print(f"User Types Tested: {', '.join(results['user_tokens_tested'])}")
    
    # Categorize results by feature
    auth_tests = [r for r in tester.results if 'Login' in r['test']]
    intelligence_tests = [r for r in tester.results if any(keyword in r['test'] for keyword in ['Next Action', 'Control', 'Model Weights', 'User Behavior', 'Alerts', 'System Health', 'Hiring Probability'])]
    
    auth_passed = sum(1 for t in auth_tests if t['success'])
    intelligence_passed = sum(1 for t in intelligence_tests if t['success'])
    
    print(f"\n🔐 Authentication: {auth_passed}/{len(auth_tests)} passed")
    print(f"🧠 Intelligence Layer: {intelligence_passed}/{len(intelligence_tests)} passed")
    
    if tester.tests_passed / tester.tests_run >= 0.85:
        print("\n🎉 COMPREHENSIVE TESTING SUCCESSFUL!")
        return 0
    else:
        print("\n⚠️  SOME CRITICAL TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())