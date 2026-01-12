import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

interface Resource {
  id: string;
  name: string;
  description: string;
  type: string;
  organizationId: string | null;
  availableQuantity: number;
  maxConcurrentUsage: number | null;
  isGlobal: boolean;
  allocations?: Array<{
    id: string;
    quantity: number;
    event: {
      id: string;
      title: string;
      startTime: string;
      endTime: string;
    };
  }>;
}

function ResourcesList() {
  const { user, isAdmin, isOrg } = useAuth();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'exclusive',
    availableQuantity: 1,
    maxConcurrentUsage: null as number | null,
    isGlobal: false,
  });
  const [allResources, setAllResources] = useState<Resource[]>([]); // Store all resources from API
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadResources();
    }
  }, [user]);

  const loadResources = async () => {
    try {
      setLoading(true);
      // Backend will automatically filter for org admins (own org + global resources)
      const response = await api.get('/resources');
      setAllResources(response.data || []);
    } catch (error) {
      console.error('Failed to load resources:', error);
      alert('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering with useMemo for performance
  const resources = useMemo(() => {
    if (!searchTerm.trim()) {
      return allResources;
    }
    
    const searchLower = searchTerm.toLowerCase().trim();
    return allResources.filter((r: Resource) => 
      r.name?.toLowerCase().includes(searchLower) ||
      r.type?.toLowerCase().includes(searchLower)
    );
  }, [allResources, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = user?.organizationId;
    if (!orgId && !isAdmin && !formData.isGlobal) {
      alert('You must belong to an organization to create non-global resources');
      return;
    }
    try {
      const resourceData = {
        ...formData,
        organizationId: formData.isGlobal ? null : (orgId || null),
        maxConcurrentUsage: formData.type === 'shareable' ? formData.maxConcurrentUsage : null,
      };

      if (editingResource) {
        await api.patch(`/resources/${editingResource.id}`, resourceData);
        alert('Resource updated successfully!');
      } else {
        await api.post('/resources', resourceData);
        alert('Resource created successfully!');
      }
      
      setFormData({
        name: '',
        description: '',
        type: 'exclusive',
        availableQuantity: 1,
        maxConcurrentUsage: null,
        isGlobal: false,
      });
      setShowForm(false);
      setEditingResource(null);
      loadResources();
    } catch (error: any) {
      console.error('Failed to save resource:', error);
      alert(error.response?.data?.message || 'Failed to save resource');
    }
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      name: resource.name,
      description: resource.description,
      type: resource.type,
      availableQuantity: resource.availableQuantity,
      maxConcurrentUsage: resource.maxConcurrentUsage,
      isGlobal: resource.isGlobal,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingResource(null);
    setFormData({
      name: '',
      description: '',
      type: 'exclusive',
      availableQuantity: 1,
      maxConcurrentUsage: null,
      isGlobal: false,
    });
    setShowForm(false);
  };

  const deleteResource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await api.delete(`/resources/${id}`);
      loadResources();
    } catch (error) {
      console.error('Failed to delete resource:', error);
      alert('Failed to delete resource');
    }
  };

  if (!user?.organizationId && !isAdmin) {
    return <div className="card">You must belong to an organization to manage resources</div>;
  }

  if (loading) {
    return <div className="card">Loading resources...</div>;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">Resources Management</h1>
        <button onClick={() => showForm ? handleCancelEdit() : setShowForm(true)} className="btn btn-primary">
          {showForm ? 'Cancel' : '+ Create Resource'}
        </button>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <svg
            style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '20px',
              height: '20px',
              color: 'var(--gray-400)',
              pointerEvents: 'none',
              zIndex: 1
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search resources by name or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.75rem',
              fontSize: '0.9375rem',
              lineHeight: '1.5',
              color: 'var(--gray-900)',
              background: 'white',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-500)';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--gray-300)';
              e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
            }}
          />
        </div>
      </div>

      {showForm && (
        <div style={{ padding: '1.5rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--gray-900)' }}>{editingResource ? 'Edit Resource' : 'Create New Resource'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value, maxConcurrentUsage: e.target.value === 'shareable' ? formData.maxConcurrentUsage : null })}
                required
              >
                <option value="exclusive">Exclusive</option>
                <option value="shareable">Shareable</option>
                <option value="consumable">Consumable</option>
              </select>
            </div>
            <div className="form-group">
              <label>Total Quantity *</label>
              <input
                type="number"
                min="0"
                value={formData.availableQuantity}
                onChange={(e) => setFormData({ ...formData, availableQuantity: parseInt(e.target.value) })}
                required
              />
            </div>
            {formData.type === 'shareable' && (
              <div className="form-group">
                <label>Max Concurrent Usage *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxConcurrentUsage || ''}
                  onChange={(e) => setFormData({ ...formData, maxConcurrentUsage: parseInt(e.target.value) })}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isGlobal}
                  onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                />
                Global Resource (shared across organizations)
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingResource ? 'Update Resource' : 'Create Resource'}
              </button>
              <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">
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
              <th>Type</th>
              <th>Total Quantity</th>
              <th>Active allocations</th>
              <th>Max Concurrent</th>
              <th>Global</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center' }}>
                  No resources found. Create your first resource!
                </td>
              </tr>
            ) : (
              resources.map((resource) => {
                // Calculate allocated quantity from current allocations
                const allocatedQuantity = resource.allocations?.reduce((sum, alloc) => sum + alloc.quantity, 0) || 0;
                
                return (
                  <tr key={resource.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{resource.name}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${resource.type === 'exclusive' ? 'warning' : resource.type === 'shareable' ? 'info' : 'success'}`}>
                        {resource.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '1rem', color: 'var(--gray-700)' }}>
                        {resource.availableQuantity}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${allocatedQuantity > 0 ? 'warning' : 'gray'}`}>
                        {allocatedQuantity}
                      </span>
                    </td>
                    <td>{resource.maxConcurrentUsage || '-'}</td>
                    <td>
                      {resource.isGlobal ? (
                        <span className="badge badge-info">Global</span>
                      ) : (
                        <span className="badge badge-gray">Org</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(isAdmin || (isOrg && resource.organizationId === user?.organizationId)) && (
                          <button
                            onClick={() => handleEdit(resource)}
                            className="btn btn-sm btn-secondary"
                          >
                            Edit
                          </button>
                        )}
                        {(isAdmin || (isOrg && resource.organizationId === user?.organizationId)) && (
                          <button
                            onClick={() => deleteResource(resource.id)}
                            className="btn btn-sm btn-danger"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ResourcesList;
