import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

interface Organization {
  id: string;
  name: string;
  emailTemplate?: string | null;
  createdAt: string;
}

function OrganizationsList() {
  const { user, isAdmin } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', emailTemplate: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const response = await api.get('/organizations');
      let orgs = response.data;
      
      // If org admin, filter to show only their organization
      if (!isAdmin && user?.organizationId) {
        orgs = orgs.filter((org: Organization) => org.id === user.organizationId);
      }
      
      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to load organizations:', error);
      alert('Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const orgData: any = { name: formData.name };
      if (formData.emailTemplate) {
        orgData.emailTemplate = formData.emailTemplate;
      }

      if (editingOrg) {
        await api.patch(`/organizations/${editingOrg.id}`, orgData);
        alert('Organization updated successfully!');
      } else {
        await api.post('/organizations', orgData);
        alert('Organization created successfully!');
      }
      setFormData({ name: '', emailTemplate: '' });
      setShowForm(false);
      setEditingOrg(null);
      loadOrganizations();
    } catch (error: any) {
      console.error('Failed to save organization:', error);
      alert(error.response?.data?.message || 'Failed to save organization');
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({ name: org.name, emailTemplate: org.emailTemplate || '' });
    setShowForm(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingOrg(null);
    setFormData({ name: '', emailTemplate: '' });
  };

  const deleteOrganization = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organization?')) return;
    try {
      await api.delete(`/organizations/${id}`);
      loadOrganizations();
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert('Failed to delete organization');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">{isAdmin ? 'Organizations' : 'My Organization'}</h1>
        <div className="card-actions">
          {isAdmin && (
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? 'Cancel' : '+ Create Organization'}
            </button>
          )}
          {!isAdmin && organizations.length > 0 && (
            <button onClick={() => handleEdit(organizations[0])} className="btn btn-primary">
              Edit Organization
            </button>
          )}
        </div>
      </div>

      {(showForm || editingOrg) && (
        <div style={{ padding: '1.5rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--gray-900)' }}>{editingOrg ? 'Edit Organization' : 'Create New Organization'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Organization Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., ABC Corporation"
              />
            </div>
            <div className="form-group">
              <label>Email Template (Optional)</label>
              <input
                type="text"
                value={formData.emailTemplate}
                onChange={(e) => setFormData({ ...formData, emailTemplate: e.target.value })}
                placeholder="@abc.in or *@abc.in"
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#718096' }}>
                Users must have emails matching this template. Examples: @abc.in, *@abc.in
              </small>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingOrg ? 'Update' : 'Create'} Organization
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email Template</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>
                  No organizations found. Create one!
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id}>
                  <td style={{ fontWeight: 600 }}>{org.name}</td>
                  <td>
                    {org.emailTemplate ? (
                      <code style={{ background: 'var(--gray-100)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                        *{org.emailTemplate}
                      </code>
                    ) : (
                      <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>No template</span>
                    )}
                  </td>
                  <td>{new Date(org.createdAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEdit(org)}
                        className="btn btn-sm btn-secondary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteOrganization(org.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OrganizationsList;
