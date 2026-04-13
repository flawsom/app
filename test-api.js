#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';

class APITester {
  constructor() {
    this.testResults = [];
    this.authToken = null;
    this.testUser = {
      email: 'test@example.com',
      password: 'testpass123',
      role: 'student',
      first_name: 'Test',
      last_name: 'User'
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colorCodes = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m'
    };
    console.log(`${colorCodes[type]}[${timestamp}] ${message}\x1b[0m`);
  }

  async test(name, testFn) {
    try {
      this.log(`Testing: ${name}`, 'info');
      const result = await testFn();
      this.testResults.push({ name, status: 'PASS', result });
      this.log(`✅ ${name} - PASSED`, 'success');
      return result;
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      this.log(`❌ ${name} - FAILED: ${error.message}`, 'error');
      throw error;
    }
  }

  async testHealthCheck() {
    return this.test('Health Check', async () => {
      const response = await axios.get(`${API_BASE}/../health`);
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testUserRegistration() {
    return this.test('User Registration', async () => {
      try {
        const response = await axios.post(`${API_BASE}/auth/register`, this.testUser);
        if (response.status !== 201) {
          throw new Error(`Expected status 201, got ${response.status}`);
        }
        return response.data;
      } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
          this.log('User already exists, skipping registration', 'warning');
          return { message: 'User already exists' };
        }
        throw error;
      }
    });
  }

  async testUserLogin() {
    return this.test('User Login', async () => {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email: this.testUser.email,
        password: this.testUser.password
      });
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      this.authToken = response.data.data.access_token;
      return response.data;
    });
  }

  async testGetCurrentUser() {
    return this.test('Get Current User', async () => {
      const response = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testGetSkills() {
    return this.test('Get Skills', async () => {
      const response = await axios.get(`${API_BASE}/skills`);
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testGetStudentProfile() {
    return this.test('Get Student Profile', async () => {
      const response = await axios.get(`${API_BASE}/students/me`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testGetJobs() {
    return this.test('Get Job Postings', async () => {
      const response = await axios.get(`${API_BASE}/jobs`);
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testGetApplications() {
    return this.test('Get Student Applications', async () => {
      const response = await axios.get(`${API_BASE}/applications/me`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testGetRecommendations() {
    return this.test('Get Job Recommendations', async () => {
      const response = await axios.get(`${API_BASE}/recommendations/jobs`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async testGetCertificates() {
    return this.test('Get Student Certificates', async () => {
      const response = await axios.get(`${API_BASE}/certificates/me`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
      return response.data;
    });
  }

  async runAllTests() {
    this.log('🚀 Starting Project UNIFY API Tests', 'info');
    this.log('=====================================', 'info');

    try {
      // Test health check
      await this.testHealthCheck();

      // Test authentication flow
      await this.testUserRegistration();
      await this.testUserLogin();
      await this.testGetCurrentUser();

      // Test core API endpoints
      await this.testGetSkills();
      await this.testGetStudentProfile();
      await this.testGetJobs();
      await this.testGetApplications();
      await this.testGetRecommendations();
      await this.testGetCertificates();

      this.generateReport();
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      this.generateReport();
      process.exit(1);
    }
  }

  generateReport() {
    this.log('\n📊 TEST RESULTS SUMMARY', 'info');
    this.log('========================', 'info');
    
    const passed = this.testResults.filter(t => t.status === 'PASS').length;
    const failed = this.testResults.filter(t => t.status === 'FAIL').length;
    const total = this.testResults.length;

    this.log(`Total Tests: ${total}`, 'info');
    this.log(`Passed: ${passed}`, 'success');
    this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`, passed === total ? 'success' : 'warning');

    if (failed > 0) {
      this.log('\n❌ FAILED TESTS:', 'error');
      this.testResults
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
          this.log(`  - ${test.name}: ${test.error}`, 'error');
        });
    }

    this.log('\n✅ PASSED TESTS:', 'success');
    this.testResults
      .filter(t => t.status === 'PASS')
      .forEach(test => {
        this.log(`  - ${test.name}`, 'success');
      });
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new APITester();
  
  // Wait for server to be ready
  setTimeout(() => {
    tester.runAllTests();
  }, 2000);
}

module.exports = APITester;