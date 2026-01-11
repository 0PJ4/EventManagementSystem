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
  const [editingAllocation, setEditingAllocation] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);

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

  const handleEdit = (allocation: Allocation) => {
    setEditingAllocation(allocation.id);
    setEditQuantity(allocation.quantity);
  };

  const handleCancelEdit = () => {
    setEditingAllocation(null);
    setEditQuantity(1);
  };

  const handleUpdateAllocation = async (id: string) => {
    try {
      await api.patch(`/allocations/${id}`, { quantity: editQuantity });
      setEditingAllocation(null);
      setEditQuantity(1);
      loadData();
    } catch (error: any) {
      console.error('Failed to update allocation:', error);
      alert(error.response?.data?.message || 'Failed to update allocation');
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

        {allocations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-600)' }}>
            No allocations found. Allocate a resource to an event!
          </div>
        ) : (
          (() => {
            const now = new Date();
            
            // Helper function to format date/time
            const formatDateTime = (dateString: string): string => {
              const date = new Date(dateString);
              return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
            };

            // Helper function to get event status
            const getEventStatus = (startTime: string, endTime: string): { label: string; badge: string } => {
              const start = new Date(startTime);
              const end = new Date(endTime);
              if (end < now) return { label: 'Past', badge: 'gray' };
              if (start <= now && end >= now) return { label: 'Ongoing', badge: 'info' };
              return { label: 'Upcoming', badge: 'success' };
            };

            // Helper function to calculate duration
            const calculateDuration = (startTime: string, endTime: string): string => {
              const start = new Date(startTime);
              const end = new Date(endTime);
              const diffMs = end.getTime() - start.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              
              if (diffHours > 0) {
                return `${diffHours}h ${diffMinutes > 0 ? `${diffMinutes}m` : ''}`.trim();
              }
              return `${diffMinutes}m`;
            };

            // Group allocations by resource
            const allocationsWithData = allocations
              .filter((alloc) => {
                const event = events.find((e) => e.id === alloc.eventId);
                return event && event.id;
              })
              .map((allocation) => {
                const event = events.find((e) => e.id === allocation.eventId);
                const resource = resources.find((r) => r.id === allocation.resourceId);
                return {
                  ...allocation,
                  event,
                  resource,
                };
              });

            // Group by resource
            const groupedByResource: { [resourceId: string]: typeof allocationsWithData } = {};
            allocationsWithData.forEach((alloc) => {
              if (alloc.resource) {
                if (!groupedByResource[alloc.resourceId]) {
                  groupedByResource[alloc.resourceId] = [];
                }
                groupedByResource[alloc.resourceId].push(alloc);
              }
            });

            const resourceIds = Object.keys(groupedByResource).sort((a, b) => {
              const resourceA = resources.find((r) => r.id === a);
              const resourceB = resources.find((r) => r.id === b);
              return (resourceA?.name || '').localeCompare(resourceB?.name || '');
            });

            return resourceIds.map((resourceId) => {
              const resource = resources.find((r) => r.id === resourceId);
              let resourceAllocations = groupedByResource[resourceId];

              // Sort allocations by start time (upcoming first, then past)
              resourceAllocations = [...resourceAllocations].sort((a, b) => {
                const startA = a.event?.startTime ? new Date(a.event.startTime).getTime() : 0;
                const startB = b.event?.startTime ? new Date(b.event.startTime).getTime() : 0;
                return startB - startA; // Descending (newest/upcoming first)
              });

              return (
                <div key={resourceId} style={{ marginBottom: '2rem' }}>
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      background: 'var(--gray-50)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '0.75rem',
                      border: '1px solid var(--gray-200)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--gray-900)' }}>
                          {resource?.name || 'Unknown Resource'}
                        </h3>
                        <span
                          className={`badge badge-${
                            resource?.type === 'exclusive' ? 'warning' : resource?.type === 'shareable' ? 'info' : 'success'
                          }`}
                        >
                          {resource?.type || 'Unknown'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                        <span>
                          <strong>{resourceAllocations.length}</strong> allocation{resourceAllocations.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Start Time</th>
                          <th>End Time</th>
                          <th>Duration</th>
                          <th>Status</th>
                          <th>Quantity</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resourceAllocations.map((allocation) => {
                          const startTime = allocation.event?.startTime || '';
                          const endTime = allocation.event?.endTime || '';
                          const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 'N/A';
                          const status = startTime && endTime ? getEventStatus(startTime, endTime) : { label: 'Unknown', badge: 'gray' };

                          return (
                            <tr key={allocation.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                                  {allocation.event?.title || 'Unknown'}
                                </div>
                              </td>
                              <td style={{ fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                                {startTime ? formatDateTime(startTime) : 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                                {endTime ? formatDateTime(endTime) : 'N/A'}
                              </td>
                              <td style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                                {duration}
                              </td>
                              <td>
                                <span className={`badge badge-${status.badge}`} style={{ fontSize: '0.75rem' }}>
                                  {status.label}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {editingAllocation === allocation.id ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                    <input
                                      type="number"
                                      min="1"
                                      value={editQuantity}
                                      onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                      style={{ width: '80px', padding: '0.25rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)' }}
                                    />
                                  </div>
                                ) : (
                                  <span className={`badge badge-${allocation.quantity > 1 ? 'info' : 'gray'}`}>
                                    {allocation.quantity}
                                  </span>
                                )}
                              </td>
                              <td>
                                {editingAllocation === allocation.id ? (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      onClick={() => handleUpdateAllocation(allocation.id)}
                                      className="btn btn-sm btn-primary"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="btn btn-sm btn-secondary"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      onClick={() => handleEdit(allocation)}
                                      className="btn btn-sm btn-secondary"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteAllocation(allocation.id)}
                                      className="btn btn-sm btn-danger"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}

export default ResourceAllocation;
