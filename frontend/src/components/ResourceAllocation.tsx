import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface Resource {
  id: string;
  name: string;
  type: string;
  availableQuantity: number;
}

interface Allocation {
  id: string;
  eventId: string;
  resourceId: string;
  quantity: number;
  event?: Event;
  resource?: Resource;
}

function ResourceAllocation() {
  const { user, isAdmin } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    eventId: '',
    resourceId: '',
    quantity: 1,
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (!isAdmin && user?.organizationId) {
        params.organizationId = user.organizationId;
      }
      const [allocationsRes, eventsRes, resourcesRes] = await Promise.all([
        api.get('/allocations'),
        api.get('/events', { params }),
        api.get('/resources', { params }),
      ]);
      setAllocations(allocationsRes.data);
      setEvents(eventsRes.data);
      setResources(resourcesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/allocations', formData);
      setFormData({ eventId: '', resourceId: '', quantity: 1 });
      setShowForm(false);
      loadData();
    } catch (error: any) {
      console.error('Failed to allocate resource:', error);
      alert(error.response?.data?.message || 'Failed to allocate resource');
    }
  };

  const deleteAllocation = async (id: string) => {
    if (!confirm('Are you sure you want to remove this allocation?')) return;
    try {
      await api.delete(`/allocations/${id}`);
      loadData();
    } catch (error) {
      console.error('Failed to delete allocation:', error);
      alert('Failed to delete allocation');
    }
  };

  if (!user?.organizationId && !isAdmin) {
    return <div className="card">You must belong to an organization to manage allocations</div>;
  }

  if (loading) {
    return <div className="card">Loading allocations...</div>;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Resource Allocations</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? 'Cancel' : 'Allocate Resource'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Event *</label>
              <select
                value={formData.eventId}
                onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                required
              >
                <option value="">Select Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({new Date(event.startTime).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Resource *</label>
              <select
                value={formData.resourceId}
                onChange={(e) => setFormData({ ...formData, resourceId: e.target.value })}
                required
              >
                <option value="">Select Resource</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} ({resource.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Allocate</button>
          </form>
        )}

        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Resource</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center' }}>
                  No allocations found. Allocate a resource to an event!
                </td>
              </tr>
            ) : (
              allocations
                .filter((alloc) => {
                  const event = events.find((e) => e.id === alloc.eventId);
                  return event && event.id;
                })
                .map((allocation) => {
                  const event = events.find((e) => e.id === allocation.eventId);
                  const resource = resources.find((r) => r.id === allocation.resourceId);
                  return (
                    <tr key={allocation.id}>
                      <td>{event?.title || 'Unknown'}</td>
                      <td>{resource?.name || 'Unknown'}</td>
                      <td>
                        <span className={`badge badge-${resource?.type === 'exclusive' ? 'warning' : resource?.type === 'shareable' ? 'info' : 'success'}`}>
                          {resource?.type || 'Unknown'}
                        </span>
                      </td>
                      <td>{allocation.quantity}</td>
                      <td>
                        <button
                          onClick={() => deleteAllocation(allocation.id)}
                          className="btn btn-small btn-danger"
                        >
                          Remove
                        </button>
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

export default ResourceAllocation;
