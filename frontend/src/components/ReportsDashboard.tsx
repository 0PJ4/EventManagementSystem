import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

function ReportsDashboard() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('double-booked');
  const [loading, setLoading] = useState(false);
  const [doubleBookedUsers, setDoubleBookedUsers] = useState<any[]>([]);
  const [violatedConstraints, setViolatedConstraints] = useState<any[]>([]);
  const [resourceUtilization, setResourceUtilization] = useState<any[]>([]);
  const [parentChildViolations, setParentChildViolations] = useState<any[]>([]);
  const [externalAttendees, setExternalAttendees] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    if (activeTab === 'double-booked') {
      loadDoubleBookedUsers();
    } else if (activeTab === 'violated-constraints') {
      loadViolatedConstraints();
    } else if (activeTab === 'resource-utilization') {
      loadResourceUtilization();
    } else if (activeTab === 'parent-child-violations') {
      loadParentChildViolations();
    } else if (activeTab === 'external-attendees') {
      loadExternalAttendees();
    }
  }, [activeTab, user, threshold]);

  const loadDoubleBookedUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/double-booked-users');
      setDoubleBookedUsers(response.data);
    } catch (error) {
      console.error('Failed to load double-booked users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadViolatedConstraints = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/violated-constraints');
      setViolatedConstraints(response.data);
    } catch (error) {
      console.error('Failed to load violated constraints:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResourceUtilization = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (!isAdmin && user?.organizationId) {
        params.organizationId = user.organizationId;
      }
      const response = await api.get('/reports/resource-utilization', { params });
      setResourceUtilization(response.data);
    } catch (error) {
      console.error('Failed to load resource utilization:', error);
      alert('Failed to load resource utilization');
    } finally {
      setLoading(false);
    }
  };

  const loadParentChildViolations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/parent-child-violations');
      setParentChildViolations(response.data);
    } catch (error) {
      console.error('Failed to load parent-child violations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExternalAttendees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/external-attendees', {
        params: { threshold },
      });
      setExternalAttendees(response.data);
    } catch (error) {
      console.error('Failed to load external attendees:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'double-booked', label: 'Double-Booked Users', icon: '⚠️' },
    { id: 'violated-constraints', label: 'Resource Violations', icon: '🚫' },
    { id: 'resource-utilization', label: 'Resource Utilization', icon: '📊' },
    { id: 'parent-child-violations', label: 'Event Hierarchy', icon: '🔗' },
    { id: 'external-attendees', label: 'External Attendees', icon: '👥' },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">Reports & Analytics</h1>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '2rem', 
        flexWrap: 'wrap',
        paddingBottom: '1rem',
        borderBottom: '2px solid var(--gray-200)'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.875rem' }}
          >
            <span style={{ marginRight: '0.5rem' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}

      {/* Double-Booked Users Report */}
      {activeTab === 'double-booked' && !loading && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>
            ⚠️ Double-Booked Users
          </h2>
          <p style={{ color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
            Users who are registered for overlapping events at the same time.
          </p>
          {doubleBookedUsers.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3>No Issues Found</h3>
              <p>No users are double-booked for overlapping events.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Email</th>
                    <th>Event 1</th>
                    <th>Event 1 Time</th>
                    <th>Event 2</th>
                    <th>Event 2 Time</th>
                  </tr>
                </thead>
                <tbody>
                  {doubleBookedUsers.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.email}</td>
                      <td>{item.event1_title}</td>
                      <td>{new Date(item.event1_start).toLocaleString()}</td>
                      <td>{item.event2_title}</td>
                      <td>{new Date(item.event2_start).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Violated Constraints Report */}
      {activeTab === 'violated-constraints' && !loading && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>
            🚫 Resource Constraint Violations
          </h2>
          <p style={{ color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
            Events that violate resource allocation rules (exclusive double-booking, shareable over-allocation, or consumable excess).
          </p>
          {violatedConstraints.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3>No Violations Found</h3>
              <p>All resource allocations are within constraints.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Resource</th>
                    <th>Violation Type</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                  </tr>
                </thead>
                <tbody>
                  {violatedConstraints.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.event_title}</td>
                      <td>{item.resource_name}</td>
                      <td>
                        <span className="badge badge-danger">{item.violation_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td>{new Date(item.start_time).toLocaleString()}</td>
                      <td>{new Date(item.end_time).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Resource Utilization Report */}
      {activeTab === 'resource-utilization' && !loading && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>
            📊 Resource Utilization Analysis
          </h2>
          <p style={{ color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
            Total hours used, peak concurrent usage, and underutilized resources per organization.
          </p>
          {resourceUtilization.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <h3>No Data Available</h3>
              <p>No resource utilization data found.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Resource</th>
                    <th>Type</th>
                    <th>Total Hours Used</th>
                    <th>Peak Concurrent</th>
                    <th>Max Capacity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceUtilization.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.organization_name}</td>
                      <td>{item.resource_name}</td>
                      <td>
                        <span className={`badge badge-${
                          item.resource_type === 'exclusive' ? 'warning' :
                          item.resource_type === 'shareable' ? 'info' :
                          'success'
                        }`}>
                          {item.resource_type}
                        </span>
                      </td>
                      <td>{parseFloat(item.total_hours_used || 0).toFixed(2)} hrs</td>
                      <td>{item.peak_concurrent_usage || 0}</td>
                      <td>{item.max_capacity || 0}</td>
                      <td>
                        {item.is_underutilized ? (
                          <span className="badge badge-warning">Underutilized</span>
                        ) : (
                          <span className="badge badge-success">Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Parent-Child Violations Report */}
      {activeTab === 'parent-child-violations' && !loading && (
        <>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>
            🔗 Event Hierarchy Violations
          </h2>
          <p style={{ color: 'var(--gray-600)', marginBottom: '1.5rem' }}>
            Child events that start before or end after their parent event's time boundaries.
          </p>
          {parentChildViolations.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3>No Violations Found</h3>
              <p>All child events are properly contained within their parent events.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Parent Event</th>
                    <th>Parent Time</th>
                    <th>Child Event</th>
                    <th>Child Time</th>
                    <th>Violation</th>
                  </tr>
                </thead>
                <tbody>
                  {parentChildViolations.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.parent_title}</td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {new Date(item.parent_start).toLocaleString()} <br />
                        <span style={{ color: 'var(--gray-500)' }}>to</span> <br />
                        {new Date(item.parent_end).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{item.child_title}</td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {new Date(item.child_start).toLocaleString()} <br />
                        <span style={{ color: 'var(--gray-500)' }}>to</span> <br />
                        {new Date(item.child_end).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-danger">
                          {item.violation_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* External Attendees Report */}
      {activeTab === 'external-attendees' && !loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--gray-900)' }}>
                👥 Events with External Attendees
              </h2>
              <p style={{ color: 'var(--gray-600)', margin: 0 }}>
                Events where external (non-user) attendees exceed a specified threshold.
              </p>
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Minimum Threshold
              </label>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
                placeholder="e.g., 10"
              />
            </div>
          </div>
          {externalAttendees.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <h3>No Events Found</h3>
              <p>No events with external attendees exceeding the threshold of {threshold}.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Organization</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Capacity</th>
                    <th>External Count</th>
                  </tr>
                </thead>
                <tbody>
                  {externalAttendees.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.title}</td>
                      <td>{item.organization_name}</td>
                      <td>{new Date(item.start_time).toLocaleString()}</td>
                      <td>{new Date(item.end_time).toLocaleString()}</td>
                      <td>{item.capacity}</td>
                      <td>
                        <span className="badge badge-warning" style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}>
                          {item.external_attendee_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ReportsDashboard;
