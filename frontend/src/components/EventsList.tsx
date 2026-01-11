import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../App.css';

interface Event {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status: string;
  allowExternalAttendees: boolean;
  organization?: { name: string };
}

interface Attendance {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: Date | null;
}

function EventsList() {
  const { user, isAdmin, isOrg } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'registered'>('available');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, attendancesRes] = await Promise.all([
        api.get('/events'),
        user ? api.get('/attendances').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);
      
      setEvents(eventsRes.data || []);
      
      // Filter attendances for current user
      const userAttendances = (attendancesRes.data || []).filter(
        (att: Attendance) => att.userId === user?.id
      );
      setMyAttendances(userAttendances);
    } catch (error: any) {
      console.error('Failed to load events:', error);
      alert(error.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const registerForEvent = async (eventId: string) => {
    if (!user) {
      alert('Please login to register for events');
      return;
    }
    
    try {
      await api.post('/attendances', {
        eventId,
        userId: user.id,
      });
      alert('Successfully registered for event!');
      loadData();
    } catch (error: any) {
      console.error('Failed to register:', error);
      alert(error.response?.data?.message || 'Failed to register for event');
    }
  };

  const unregisterFromEvent = async (attendanceId: string) => {
    if (!confirm('Are you sure you want to unregister from this event?')) return;
    
    try {
      await api.delete(`/attendances/${attendanceId}`);
      alert('Successfully unregistered from event');
      loadData();
    } catch (error: any) {
      console.error('Failed to unregister:', error);
      alert(error.response?.data?.message || 'Failed to unregister');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      loadData();
    } catch (error: any) {
      console.error('Failed to delete event:', error);
      alert(error.response?.data?.message || 'Failed to delete event');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  // Segregate events
  const registeredEventIds = new Set(myAttendances.map(att => att.eventId));
  const registeredEvents = events.filter(event => registeredEventIds.has(event.id));
  const availableEvents = events.filter(event => !registeredEventIds.has(event.id));

  const displayEvents = activeTab === 'available' ? availableEvents : registeredEvents;

  return (
    <div className="card">
      <div className="card-header">
        <h1 className="card-title">Events</h1>
        <div className="card-actions">
          {(isAdmin || isOrg) && (
            <Link to="/events/new" className="btn btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create Event
            </Link>
          )}
        </div>
      </div>

      {/* Tab Navigation for Users */}
      {!isAdmin && !isOrg && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--gray-200)',
          paddingBottom: '0.5rem'
        }}>
          <button
            onClick={() => setActiveTab('available')}
            className={`btn ${activeTab === 'available' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Available Events ({availableEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('registered')}
            className={`btn ${activeTab === 'registered' ? 'btn-primary' : 'btn-secondary'}`}
          >
            My Registered Events ({registeredEvents.length})
          </button>
        </div>
      )}

      {displayEvents.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3>No events found</h3>
          <p>
            {activeTab === 'available' 
              ? 'No available events at the moment. Check back later!' 
              : 'You haven\'t registered for any events yet.'}
          </p>
          {(isAdmin || isOrg) && activeTab === 'available' && (
            <Link to="/events/new" className="btn btn-primary">
              Create Event
            </Link>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Organization</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Capacity</th>
                <th>Status</th>
                {(isAdmin || isOrg) && <th>External</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayEvents.map((event) => {
                const attendance = myAttendances.find(att => att.eventId === event.id);
                const isRegistered = !!attendance;
                
                return (
                  <tr key={event.id}>
                    <td style={{ fontWeight: 600 }}>{event.title}</td>
                    <td>{event.organization?.name || 'N/A'}</td>
                    <td>{new Date(event.startTime).toLocaleString()}</td>
                    <td>{new Date(event.endTime).toLocaleString()}</td>
                    <td>{event.capacity}</td>
                    <td>
                      <span className={`badge badge-${
                        event.status === 'published' ? 'success' :
                        event.status === 'draft' ? 'warning' :
                        'gray'
                      }`}>
                        {event.status}
                      </span>
                    </td>
                    {(isAdmin || isOrg) && (
                      <td>
                        {event.allowExternalAttendees ? (
                          <span className="badge badge-info">Yes</span>
                        ) : (
                          <span className="badge badge-gray">No</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* User Registration Actions */}
                        {!isAdmin && !isOrg && (
                          <>
                            {!isRegistered ? (
                              <button
                                onClick={() => registerForEvent(event.id)}
                                className="btn btn-sm btn-success"
                              >
                                Register
                              </button>
                            ) : (
                              <>
                                <Link 
                                  to={`/events/${event.id}/attendees`}
                                  className="btn btn-sm btn-secondary"
                                >
                                  View Attendees
                                </Link>
                                <button
                                  onClick={() => unregisterFromEvent(attendance.id)}
                                  className="btn btn-sm btn-danger"
                                >
                                  Unregister
                                </button>
                              </>
                            )}
                          </>
                        )}
                        
                        {/* Admin/Org Admin Actions */}
                        {(isAdmin || isOrg) && (
                          <>
                            <Link 
                              to={`/events/${event.id}/attendees`}
                              className="btn btn-sm btn-secondary"
                            >
                              Attendees
                            </Link>
                            <Link to={`/events/${event.id}/edit`} className="btn btn-sm btn-secondary">
                              Edit
                            </Link>
                            <button
                              onClick={() => deleteEvent(event.id)}
                              className="btn btn-sm btn-danger"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EventsList;
