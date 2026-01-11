import { useState, useEffect } from 'react';
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
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'exclusive',
    availableQuantity: 1,
    maxConcurrentUsage: null as number | null,
    isGlobal: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  useEffect(() => {
    if (user) {
      loadResources();
    }
  }, [user]);

  const loadResources = async () => {
    try {
      // Backend will automatically filter for org admins (own org + global resources)
      const response = await api.get('/resources');
      setResources(response.data);
    } catch (error) {
      console.error('Failed to load resources:', error);
      alert('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

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
