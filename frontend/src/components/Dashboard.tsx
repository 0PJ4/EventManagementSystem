import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

interface Stats {
  events: number;
  users: number;
  organizations: number;
}

function Dashboard() {
  const { user, isAdmin, isOrg } = useAuth();
  const [stats, setStats] = useState<Stats>({ events: 0, users: 0, organizations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Events are now filtered by backend based on user role
      // Users see: their org events + external events
      // Org admins see: their org events + external events
      // Admins see: all events
      const [eventsRes, usersRes, orgsRes] = await Promise.all([
        api.get('/events').catch(() => ({ data: [] })),
        (isAdmin || isOrg) ? api.get('/users').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        isAdmin ? api.get('/organizations').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      
      setStats({
        events: eventsRes.data.length || 0,
        users: usersRes.data.length || 0,
        organizations: orgsRes.data.length || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--gray-900)' }}>
              Welcome back, {user.name}!
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--gray-600)' }}>
              {user.role === 'admin' 
                ? 'System Administrator' 
                : user.role === 'org' 
                ? 'Organization Administrator' 
                : 'User Account'}
              {user.organization && ` • ${user.organization.name}`}
            </p>
          </div>
          <div>
            <span className={`badge badge-${user.role === 'admin' ? 'danger' : user.role === 'org' ? 'warning' : 'primary'}`} style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              {user.role === 'admin' ? 'ADMIN' : user.role === 'org' ? 'ORG ADMIN' : 'USER'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-value">{stats.events}</div>
              <div className="stat-label">Total Events</div>
            </div>
            <div className="stat-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
          </div>
          <Link to="/events" className="btn btn-sm btn-secondary" style={{ marginTop: '1rem' }}>
            View All Events →
          </Link>
        </div>

        {(isAdmin || isOrg) && (
          <div className="stat-card">
            <div className="stat-card-header">
              <div>
                <div className="stat-value">{stats.users}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="stat-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
            </div>
            <Link to="/users" className="btn btn-sm btn-secondary" style={{ marginTop: '1rem' }}>
              Manage Users →
            </Link>
          </div>
        )}

        {isAdmin && (
          <div className="stat-card">
            <div className="stat-card-header">
              <div>
                <div className="stat-value">{stats.organizations}</div>
                <div className="stat-label">Organizations</div>
              </div>
              <div className="stat-icon yellow">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
            </div>
            <Link to="/organizations" className="btn btn-sm btn-secondary" style={{ marginTop: '1rem' }}>
              Manage Orgs →
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--gray-900)' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {(isAdmin || isOrg) && (
            <Link to="/events/new" className="btn btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create Event
            </Link>
          )}
          
          {(isAdmin || isOrg) && (
            <Link to="/users" className="btn btn-secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Manage Users
            </Link>
          )}
          
          {(isAdmin || isOrg) && (
            <Link to="/resources" className="btn btn-secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              View Resources
            </Link>
          )}
          
          {(isAdmin || isOrg) && (
            <Link to="/reports" className="btn btn-secondary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              View Reports
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

export default Dashboard;
