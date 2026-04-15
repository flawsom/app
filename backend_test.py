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

    def test_all_roles(self):
        """Test login for all user roles"""
        roles = [
            ("Student", "sibaprasadpanda56@gmail.com", "siba-4738"),
            ("Admin", "admin@example.com", "admin123"),
            ("Employer", "employer@unify.com", "employer123"),
            ("Mentor", "mentor@unify.com", "mentor123"),
            ("Placement", "placement@unify.com", "placement123")
        ]
        
        role_results = {}
        for role_name, email, password in roles:
            print(f"\n🔐 Testing {role_name} Login")
            success, data = self.test_login(email, password)
            role_results[role_name] = {
                "login_success": success,
                "token": self.token[:20] + "..." if self.token else None,
                "user_data": data
            }
            if success:
                print(f"✅ {role_name} login successful")
            else:
                print(f"❌ {role_name} login failed")
        
        return role_results

    def test_analytics_charts(self):
        """Test analytics charts endpoint for admin"""
        return self.run_test("Analytics Charts", "GET", "/api/analytics/charts", 200)

    def test_system_health(self):
        """Test system health endpoint for admin"""
        return self.run_test("System Health", "GET", "/api/system-health", 200)

    def test_interview_prep(self, job_id="test_job_id"):
        """Test interview prep AI"""
        return self.run_test("Interview Prep AI", "POST", "/api/interview-prep", 200, {"job_id": job_id})

    def test_cover_letter(self, job_id="test_job_id"):
        """Test cover letter generator"""
        return self.run_test("Cover Letter Generator", "POST", "/api/cover-letter", 200, {"job_id": job_id})

    def test_resume_analyze(self):
        """Test resume analyzer"""
        return self.run_test("Resume AI Analyzer", "POST", "/api/resume/analyze", 200, {"resume_text": "Sample resume text"})

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

def test_all_roles(self):
    """Test login for all user roles"""
    roles = [
        ("Student", "sibaprasadpanda56@gmail.com", "siba-4738"),
        ("Admin", "admin@example.com", "admin123"),
        ("Employer", "employer@unify.com", "employer123"),
        ("Mentor", "mentor@unify.com", "mentor123"),
        ("Placement", "placement@unify.com", "placement123")
    ]
    
    role_results = {}
    for role_name, email, password in roles:
        print(f"\n🔐 Testing {role_name} Login")
        success, data = self.test_login(email, password)
        role_results[role_name] = {
            "login_success": success,
            "token": self.token[:20] + "..." if self.token else None,
            "user_data": data
        }
        if success:
            print(f"✅ {role_name} login successful")
        else:
            print(f"❌ {role_name} login failed")
    
    return role_results

def test_analytics_charts(self):
    """Test analytics charts endpoint for admin"""
    return self.run_test("Analytics Charts", "GET", "/api/analytics/charts", 200)

def test_system_health(self):
    """Test system health endpoint for admin"""
    return self.run_test("System Health", "GET", "/api/system-health", 200)

def test_interview_prep(self, job_id="test_job_id"):
    """Test interview prep AI"""
    return self.run_test("Interview Prep AI", "POST", "/api/interview-prep", 200, {"job_id": job_id})

def test_cover_letter(self, job_id="test_job_id"):
    """Test cover letter generator"""
    return self.run_test("Cover Letter Generator", "POST", "/api/cover-letter", 200, {"job_id": job_id})

def test_resume_analyze(self):
    """Test resume analyzer"""
    return self.run_test("Resume AI Analyzer", "POST", "/api/resume/analyze", 200, {"resume_text": "Sample resume text"})

def main():
    print("🚀 UNIFY Platform API Testing")
    print("=" * 50)
    
    tester = UnifyAPITester()
    
    # Test health first
    print("\n📊 Basic Health Check")
    tester.test_health()
    
    # Test all role logins
    print("\n🔐 Testing All User Role Logins")
    role_results = tester.test_all_roles()
    
    # Continue with student token for detailed testing
    student_login_success, _ = tester.test_login("sibaprasadpanda56@gmail.com", "siba-4738")
    
    if not student_login_success:
        print("❌ Student login failed - cannot proceed with authenticated tests")
        tester.save_results()
        return 1
    
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
    
    # Test new AI features
    print("\n🤖 New AI Features")
    tester.test_interview_prep()
    tester.test_cover_letter()
    tester.test_resume_analyze()
    
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
    
    # Test admin features with admin login
    admin_login_success, _ = tester.test_login("admin@example.com", "admin123")
    if admin_login_success:
        print("\n🔧 Admin Features")
        tester.test_analytics_charts()
        tester.test_system_health()
    
    # Test employer-specific endpoints
    employer_login_success, _ = tester.test_login("employer@unify.com", "employer123")
    if employer_login_success:
        print("\n🏢 Employer Features")
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
    
    # Print role login summary
    print("\n🔐 Role Login Summary:")
    for role, result in role_results.items():
        status = "✅" if result["login_success"] else "❌"
        print(f"{status} {role}: {'Success' if result['login_success'] else 'Failed'}")
    
    # Categorize results
    intelligence_tests = [r for r in tester.results if any(keyword in r['test'].lower() for keyword in ['next action', 'control', 'hiring probability', 'best candidates', 'interview prep', 'cover letter', 'resume analyze'])]
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