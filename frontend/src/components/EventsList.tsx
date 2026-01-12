import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import ActionsDropdown from './ActionsDropdown';
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
  organizationId?: string | null;
  resourceCount?: number;
}

interface Attendance {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: Date | null;
  event?: {
    startTime: string;
    endTime: string;
  };
}

function EventsList() {
  const { user, isAdmin, isOrg } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]); // Store all events from API
  const [myAttendances, setMyAttendances] = useState<Attendance[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'registered' | 'ongoing' | 'past' | 'upcoming'>('available');
  const [eventFilter, setEventFilter] = useState<'all' | 'my-org' | 'global'>('all');
  
  // Set default tab based on role after mount
  useEffect(() => {
    if (isAdmin || isOrg) {
      setActiveTab('upcoming');
    }
  }, [isAdmin, isOrg]);

  useEffect(() => {
    loadData();
  }, [user, eventFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, attendancesRes] = await Promise.all([
        api.get('/events'),
        user ? api.get('/attendances').catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);
      
      const eventsData = eventsRes.data || [];
      setAllEvents(eventsData);
      
      // Apply filter
      let filteredEvents = eventsData;
      if (eventFilter === 'my-org' && user?.organizationId) {
        filteredEvents = eventsData.filter((e: Event) => e.organizationId === user.organizationId);
      } else if (eventFilter === 'global') {
        filteredEvents = eventsData.filter((e: Event) => 
          e.organizationId !== user?.organizationId || e.allowExternalAttendees
        );
      }
      setEvents(filteredEvents);
      
      // Filter attendances for current user and attach event details
      const allAttendances = attendancesRes.data || [];
      const userAttendances = allAttendances
        .filter((att: Attendance) => att.userId === user?.id)
        .map((att: Attendance) => {
          const event = eventsData.find((e: Event) => e.id === att.eventId);
          return { ...att, event };
        });
      setMyAttendances(userAttendances);

      // Calculate attendance counts per event
      const counts: Record<string, number> = {};
      eventsData.forEach((event: Event) => {
        counts[event.id] = allAttendances.filter((att: Attendance) => att.eventId === event.id).length;
      });
      setAttendanceCounts(counts);
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

  const checkInForEvent = async (attendanceId: string) => {
    try {
      await api.post(`/attendances/${attendanceId}/checkin`);
      alert('Successfully checked in!');
      loadData();
    } catch (error: any) {
      console.error('Failed to check in:', error);
      alert(error.response?.data?.message || 'Failed to check in');
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
  
  // Time-based filtering
  const now = new Date();
  
  // For users: ongoing events (must be registered)
  const userOngoingEvents = registeredEvents.filter(event => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    return now >= eventStart && now <= eventEnd;
  });
  
  // For users: past events (must be registered, event has ended)
  const userPastEvents = registeredEvents.filter(event => {
    const eventEnd = new Date(event.endTime);
    return now > eventEnd;
  });
  
  // For admins/org admins: all ongoing events (including draft events)
  const adminOngoingEvents = events.filter(event => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    return now >= eventStart && now <= eventEnd;
  });
  
  // For admins/org admins: upcoming events (not started yet)
  const upcomingEvents = events.filter(event => {
    const eventStart = new Date(event.startTime);
    return now < eventStart;
  });
  
  // For admins/org admins: past events (already ended)
  const adminPastEvents = events.filter(event => {
    const eventEnd = new Date(event.endTime);
    return now > eventEnd;
  });

  const displayEvents = activeTab === 'available' 
    ? availableEvents 
    : activeTab === 'ongoing'
    ? (isAdmin || isOrg ? adminOngoingEvents : userOngoingEvents)
    : activeTab === 'past'
    ? (isAdmin || isOrg ? adminPastEvents : userPastEvents)
    : activeTab === 'upcoming'
    ? upcomingEvents
    : registeredEvents;

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

      {/* Event Filter Dropdown */}
      <div style={{ 
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <label style={{ 
          fontSize: '0.875rem', 
          fontWeight: 600, 
          color: 'var(--gray-700)',
          whiteSpace: 'nowrap'
        }}>
          Filter Events:
        </label>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value as 'all' | 'my-org' | 'global')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--gray-300)',
            backgroundColor: 'white',
            fontSize: '0.875rem',
            color: 'var(--gray-900)',
            cursor: 'pointer',
            minWidth: '180px'
          }}
        >
          <option value="all">All Events</option>
          {user?.organizationId && (
            <option value="my-org">My Organization</option>
          )}
          <option value="global">Global Events</option>
        </select>
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
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`btn ${activeTab === 'ongoing' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Ongoing Events ({userOngoingEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`btn ${activeTab === 'past' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Past Events ({userPastEvents.length})
          </button>
        </div>
      )}
      
      {/* Tab Navigation for Admins/Org Admins */}
      {(isAdmin || isOrg) && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--gray-200)',
          paddingBottom: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Upcoming Events ({upcomingEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`btn ${activeTab === 'ongoing' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Ongoing Events ({adminOngoingEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`btn ${activeTab === 'past' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Past Events ({adminPastEvents.length})
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
              : activeTab === 'ongoing'
              ? 'No ongoing events at the moment.'
              : activeTab === 'past'
              ? 'No past events found.'
              : activeTab === 'upcoming'
              ? 'No upcoming events found.'
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
                {(isAdmin || isOrg) && <th>Resources</th>}
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
                    {(isAdmin || isOrg) && (
                      <td>
                        {/* Show resource count only to the owning org admin */}
                        {(isAdmin || (isOrg && event.organizationId === user?.organizationId)) ? (
                          <span className="badge badge-info">
                            {event.resourceCount || 0} resource{(event.resourceCount || 0) !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="badge badge-gray" title="Resource count only visible to event owner">
                            -
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      {(() => {
                        const actions: Array<{ label: string; onClick?: () => void; to?: string; danger?: boolean }> = [];
                        const now = new Date();
                        const eventStart = new Date(event.startTime);
                        const eventEnd = new Date(event.endTime);
                        const canCheckIn = isRegistered && !attendance?.checkedInAt && now >= eventStart && now <= eventEnd;
                        const isCheckedIn = attendance?.checkedInAt;

                        // User actions (for regular users)
                        if (!isAdmin && !isOrg) {
                          if (!isRegistered) {
                            const attendanceCount = attendanceCounts[event.id] || 0;
                            const isFull = event.capacity > 0 && attendanceCount >= event.capacity;
                            actions.push({
                              label: isFull ? 'Full' : 'Register',
                              onClick: isFull ? undefined : () => registerForEvent(event.id),
                              disabled: isFull,
                            });
                          } else {
                            actions.push({
                              label: 'View Attendees',
                              to: `/events/${event.id}/attendees`,
                            });
                            if (canCheckIn) {
                              actions.push({
                                label: 'Check In',
                                onClick: () => checkInForEvent(attendance.id),
                              });
                            }
                            actions.push({
                              label: 'Unregister',
                              onClick: () => {
                                if (confirm('Are you sure you want to unregister from this event?')) {
                                  unregisterFromEvent(attendance.id);
                                }
                              },
                              danger: true,
                            });
                          }
                        }

                        // Admin/Org Admin actions
                        if (isAdmin || (isOrg && event.organizationId === user?.organizationId)) {
                          actions.push({
                            label: 'View Attendees',
                            to: `/events/${event.id}/attendees`,
                          });
                          actions.push({
                            label: 'Edit Event',
                            to: `/events/${event.id}/edit`,
                          });
                          actions.push({
                            label: 'Delete Event',
                            onClick: () => {
                              if (confirm('Are you sure you want to delete this event?')) {
                                deleteEvent(event.id);
                              }
                            },
                            danger: true,
                          });
                        }

                        // Render dropdown with check-in badge if applicable
                        return (
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {isCheckedIn && (
                              <span className="badge badge-success" title={`Checked in: ${new Date(attendance.checkedInAt).toLocaleString()}`}>
                                ✓ Checked In
                              </span>
                            )}
                            {actions.length > 0 && <ActionsDropdown actions={actions} />}
                          </div>
                        );
                      })()}
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
