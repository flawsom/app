'use client'

import React, { useState, useEffect } from 'react'
import { User, JobRecommendation, Application, StudentProfile } from '@/types'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/auth'
import { formatDate, getStatusColor, calculateMatchingPercentage } from '@/lib/utils'
import EmptyState from './EmptyState'

interface StudentDashboardProps {
  user: User
  onLogout: () => void
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    loadStudentData()
  }, [])

  const loadStudentData = async () => {
    setIsLoading(true)
    try {
      // Load student profile
      const profileResult = await apiRequest('/api/v1/students/me')
      if (profileResult.success) {
        setProfile(profileResult.data)
      }

      // Load recommendations
      const recommendationsResult = await apiRequest('/api/v1/recommendations/jobs')
      if (recommendationsResult.success) {
        setRecommendations(recommendationsResult.data.recommendations || [])
      }

      // Load applications
      const applicationsResult = await apiRequest('/api/v1/applications/me')
      if (applicationsResult.success) {
        setApplications(applicationsResult.data || [])
      }
    } catch (error) {
      console.error('Error loading student data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyToJob = async (jobId: string) => {
    try {
      const result = await apiRequest('/api/v1/applications', {
        method: 'POST',
        body: JSON.stringify({
          job_posting_id: jobId,
          cover_letter: 'I am interested in this position and believe I would be a great fit.'
        })
      })

      if (result.success) {
        await loadStudentData() // Refresh data
        alert('Application submitted successfully!')
      } else {
        alert('Failed to submit application: ' + result.error)
      }
    } catch (error) {
      alert('Error submitting application')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-unify-primary rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Project UNIFY</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {profile?.first_name || 'Student'}
              </span>
              <Button variant="outline" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: '📊' },
              { id: 'recommendations', name: 'Recommendations', icon: '🎯' },
              { id: 'applications', name: 'My Applications', icon: '📝' },
              { id: 'profile', name: 'Profile', icon: '👤' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm">📝</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Applications
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {applications.length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm">✅</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Shortlisted
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {applications.filter(app => app.status === 'shortlisted').length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm">🎯</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Recommendations
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {recommendations.length}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                          <span className="text-white text-sm">⭐</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Profile Score
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            {profile ? '85%' : 'N/A'}
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Applications */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Recent Applications
                  </h3>
                  {applications.length > 0 ? (
                    <div className="space-y-3">
                      {applications.slice(0, 3).map((application) => (
                        <div key={application.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {application.jobPosting.title}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {application.jobPosting.employer.companyName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Applied on {formatDate(application.appliedAt)}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(application.status)}`}>
                            {application.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="📝"
                      title="No Applications Yet"
                      description="You haven't applied to any positions yet. Check out the recommendations tab to find opportunities that match your profile."
                      actionLabel="View Recommendations"
                      onAction={() => setActiveTab('recommendations')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    AI-Powered Job Recommendations
                  </h3>
                  {recommendations.length > 0 ? (
                    <div className="space-y-4">
                      {recommendations.map((recommendation, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">
                                {recommendation.job.title}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {recommendation.job.employer.companyName} • {recommendation.job.location}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-600">
                                {calculateMatchingPercentage(recommendation.matchingScore)}% Match
                              </div>
                              <div className="text-xs text-gray-500">AI Score</div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3">
                            {recommendation.job.description.substring(0, 200)}...
                          </p>
                          
                          <div className="flex flex-wrap gap-2 mb-3">
                            {recommendation.job.requiredSkills.slice(0, 3).map((skill, skillIndex) => (
                              <span key={skillIndex} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Stipend:</span> 
                              {recommendation.job.stipendMin && recommendation.job.stipendMax
                                ? ` ₹${recommendation.job.stipendMin} - ₹${recommendation.job.stipendMax}`
                                : ' Negotiable'
                              }
                            </div>
                            <Button
                              onClick={() => handleApplyToJob(recommendation.job.id)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Apply Now
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="🎯"
                      title="No Recommendations Available"
                      description="Complete your profile with skills and preferences to receive personalized job recommendations powered by AI."
                      actionLabel="Complete Profile"
                      onAction={() => setActiveTab('profile')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  My Applications
                </h3>
                {applications.length > 0 ? (
                  <div className="space-y-4">
                    {applications.map((application) => (
                      <div key={application.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">
                              {application.jobPosting.title}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {application.jobPosting.employer.companyName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Applied on {formatDate(application.appliedAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(application.status)}`}>
                              {application.status.replace('_', ' ')}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              Mentor: {application.mentorApprovalStatus}
                            </div>
                          </div>
                        </div>
                        
                        {application.matchingScore && (
                          <div className="mb-2">
                            <span className="text-sm text-gray-600">
                              Match Score: <span className="font-medium text-green-600">
                                {calculateMatchingPercentage(application.matchingScore)}%
                              </span>
                            </span>
                          </div>
                        )}
                        
                        {application.mentorComments && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
                            <p className="text-sm text-yellow-800">
                              <span className="font-medium">Mentor Comments:</span> {application.mentorComments}
                            </p>
                          </div>
                        )}
                        
                        {application.employerFeedback && (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-3">
                            <p className="text-sm text-blue-800">
                              <span className="font-medium">Employer Feedback:</span> {application.employerFeedback}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="📝"
                    title="No Applications Yet"
                    description="You haven't applied to any positions yet. Browse available opportunities and start applying to kickstart your career."
                    actionLabel="Browse Jobs"
                    onAction={() => setActiveTab('recommendations')}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Student Profile
                </h3>
                {profile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.firstName} {profile.lastName}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Student ID</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.studentId || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Department</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.department || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Semester</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.semester || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">CGPA</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.cgpa || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    
                    {profile.bio && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Bio</label>
                        <p className="mt-1 text-sm text-gray-900">{profile.bio}</p>
                      </div>
                    )}
                    
                    {profile.skills && profile.skills.length > 0 ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.map((studentSkill, index) => (
                            <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                              {studentSkill.skill.name} ({studentSkill.proficiencyLevel}/5)
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon="🎯"
                        title="No Skills Added"
                        description="Add your skills to get better job recommendations and improve your profile visibility."
                        actionLabel="Add Skills"
                        onAction={() => {/* TODO: Open skills modal */}}
                      />
                    )}
                    
                    <div className="pt-4">
                      <Button variant="outline">
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon="👤"
                    title="Profile Not Found"
                    description="Your student profile needs to be created. Please contact your administrator or complete the profile setup."
                    actionLabel="Contact Support"
                    onAction={() => {/* TODO: Contact support */}}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default StudentDashboard