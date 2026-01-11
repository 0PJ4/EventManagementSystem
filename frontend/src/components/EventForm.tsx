import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

function EventForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    capacity: 0,
    status: 'draft',
    allowExternalAttendees: false,
    organizationId: user?.organizationId || '',
    parentEventId: '',
  });
  const [parentEvents, setParentEvents] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      if (!id) {
        // For new events, set organization from user
        setEvent((prev) => ({ ...prev, organizationId: user.organizationId || '' }));
      }
      loadParentEvents();
    }
    if (id) {
      loadEvent();
    }
  }, [id, user]);

  const loadEvent = async () => {
    try {
      const response = await api.get(`/events/${id}`);
      const eventData = response.data;
      setEvent({
        title: eventData.title || '',
        description: eventData.description || '',
        startTime: eventData.startTime ? new Date(eventData.startTime).toISOString().slice(0, 16) : '',
        endTime: eventData.endTime ? new Date(eventData.endTime).toISOString().slice(0, 16) : '',
        capacity: eventData.capacity || 0,
        status: eventData.status || 'draft',
        allowExternalAttendees: eventData.allowExternalAttendees || false,
        organizationId: eventData.organizationId || user?.organizationId || '',
        parentEventId: eventData.parentEventId || '',
      });
    } catch (error) {
      console.error('Failed to load event:', error);
      alert('Failed to load event');
    }
  };

  const loadParentEvents = async () => {
    try {
      const params: any = {};
      if (!isAdmin && user?.organizationId) {
        params.organizationId = user.organizationId;
      }
      const response = await api.get('/events', { params });
      setParentEvents(response.data.filter((e: any) => e.id !== id));
    } catch (error) {
      console.error('Failed to load parent events:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const eventData = {
        ...event,
        startTime: new Date(event.startTime).toISOString(),
        endTime: new Date(event.endTime).toISOString(),
        parentEventId: event.parentEventId || undefined,
      };

      if (id) {
        await api.patch(`/events/${id}`, eventData);
      } else {
        await api.post('/events', eventData);
      }
      navigate('/events');
    } catch (error: any) {
      console.error('Failed to save event:', error);
      alert(error.response?.data?.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">{id ? 'Edit Event' : 'Create New Event'}</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={event.title}
            onChange={(e) => setEvent({ ...event, title: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={event.description}
            onChange={(e) => setEvent({ ...event, description: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Start Time *</label>
          <input
            type="datetime-local"
            value={event.startTime}
            onChange={(e) => setEvent({ ...event, startTime: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>End Time *</label>
          <input
            type="datetime-local"
            value={event.endTime}
            onChange={(e) => setEvent({ ...event, endTime: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Capacity *</label>
          <input
            type="number"
            min="0"
            value={event.capacity}
            onChange={(e) => setEvent({ ...event, capacity: parseInt(e.target.value) })}
            required
          />
        </div>
        <div className="form-group">
          <label>Status</label>
          <select
            value={event.status}
            onChange={(e) => setEvent({ ...event, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="form-group">
          <label>Parent Event (optional)</label>
          <select
            value={event.parentEventId}
            onChange={(e) => setEvent({ ...event, parentEventId: e.target.value })}
          >
            <option value="">None</option>
            {parentEvents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.title}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={event.allowExternalAttendees}
              onChange={(e) => setEvent({ ...event, allowExternalAttendees: e.target.checked })}
            />
            Allow External Attendees
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : id ? 'Update Event' : 'Create Event'}
          </button>
          <Link to="/events" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default EventForm;
