import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

interface Organization {
  id: string;
  name: string;
  emailTemplate?: string | null;
}

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    organizationId: '',
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Load organizations using public endpoint (for registration)
    api.get('/organizations/public')
      .then((response) => {
        setOrganizations(response.data);
      })
      .catch((error) => {
        // If endpoint doesn't exist or fails, continue without organizations
        console.log('Could not load organizations for registration:', error);
      })
      .finally(() => setLoadingOrgs(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    if (!formData.organizationId) {
      setError('Please select an organization or choose "Independent User"');
      setLoading(false);
      return;
    }

    try {
      // If "independent" is selected, send null, otherwise send the organization ID
      const orgId = formData.organizationId === 'independent' ? null : formData.organizationId;
      
      await register(
        formData.email,
        formData.password,
        formData.name,
        'user', // Only 'user' role allowed for registration
        orgId || undefined
      );
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--primary-600)' }}>
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
            </svg>
          </div>
          <h1>Create Account</h1>
          <p>Sign up to get started with Event Booking</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="John Doe"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
            />
            <small>Must be at least 6 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="organizationId">Organization *</label>
            <select
              id="organizationId"
              value={formData.organizationId}
              onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
              disabled={loadingOrgs}
              required
            >
              <option value="">-- Select Organization --</option>
              <option value="independent">Independent User (Personal Email)</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.emailTemplate && ` (Email must match: *${org.emailTemplate})`}
                </option>
              ))}
            </select>
            <small>
              {formData.organizationId === 'independent'
                ? 'You can use any personal email address.'
                : formData.organizationId && organizations.find(o => o.id === formData.organizationId)?.emailTemplate
                ? `Your email must match: username${organizations.find(o => o.id === formData.organizationId)?.emailTemplate}`
                : 'You must select either an organization or "Independent User". Users belonging to an organization must use their organization email.'}
            </small>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="auth-footer">
            <p>
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
