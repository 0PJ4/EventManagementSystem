import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { formatTableDate } from '../utils/dateFormatter';
import '../App.css';

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  allowExternalAttendees: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Attendance {
  id: string;
  eventId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  checkedInAt: string | null;
  registeredAt: string;
  event?: Event;
  user?: User;
}

function AttendeeRegistration() {
  const { user, isAdmin } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    eventId: '',
    userId: '',
    userEmail: '',
    userName: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (!isAdmin && user?.organizationId) {
        params.organizationId = user.organizationId;
      }
      
      const [attendancesRes, eventsRes, usersRes] = await Promise.all([
        api.get('/attendances'),
        api.get('/events', { params }),
        api.get('/users', { params: !isAdmin && user?.organizationId ? { organizationId: user.organizationId } : {} }),
      ]);
      setAttendances(attendancesRes.data);
      setEvents(eventsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = (eventId: string) => {
    const event = events.find((e) => e.id === eventId);
    setSelectedEvent(event || null);
    setFormData({
      ...formData,
      eventId,
      userId: event?.allowExternalAttendees ? formData.userId : formData.userId,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const attendanceData: any = {
        eventId: formData.eventId,
      };

      if (formData.userId) {
        attendanceData.userId = formData.userId;
      } else if (selectedEvent?.allowExternalAttendees) {
        attendanceData.userEmail = formData.userEmail;
        attendanceData.userName = formData.userName;
      } else {
        alert('This event does not allow external attendees. Please select a user.');
        return;
      }

      await api.post('/attendances', attendanceData);
      setFormData({ eventId: '', userId: '', userEmail: '', userName: '' });
      setSelectedEvent(null);
      setShowForm(false);
      loadData();
    } catch (error: any) {
      console.error('Failed to register attendee:', error);
      alert(error.response?.data?.message || 'Failed to register attendee');
    }
  };

  const handleCheckIn = async (attendanceId: string) => {
    try {
      await api.post(`/attendances/${attendanceId}/checkin`);
      loadData();
    } catch (error: any) {
      console.error('Failed to check in:', error);
      alert(error.response?.data?.message || 'Failed to check in');
    }
  };

  const deleteAttendance = async (id: string) => {
    if (!confirm('Are you sure you want to remove this attendance?')) return;
    try {
      await api.delete(`/attendances/${id}`);
      loadData();
    } catch (error) {
      console.error('Failed to delete attendance:', error);
      alert('Failed to delete attendance');
    }
  };

  // Regular users can see their own attendances, admins/orgs see org attendances

  if (loading) {
    return <div className="card">Loading attendances...</div>;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Attendee Registration</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? 'Cancel' : 'Register Attendee'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div className="form-group">
              <label>Event *</label>
              <select
                value={formData.eventId}
                onChange={(e) => handleEventChange(e.target.value)}
                required
              >
                <option value="">Select Event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({formatTableDate(event.startTime)})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Register as User</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value, userEmail: '', userName: '' })}
              >
                <option value="">Select User</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            {selectedEvent?.allowExternalAttendees && !formData.userId && (
              <>
                <div className="form-group">
                  <label>Email (External) *</label>
                  <input
                    type="email"
                    value={formData.userEmail}
                    onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                    required={!formData.userId}
                  />
                </div>
                <div className="form-group">
                  <label>Name (External) *</label>
                  <input
                    type="text"
                    value={formData.userName}
                    onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                    required={!formData.userId}
                  />
                </div>
              </>
            )}
            {!formData.userId && (!selectedEvent || !selectedEvent.allowExternalAttendees) && (
              <p style={{ color: '#e74c3c' }}>Please select a user, or select an event that allows external attendees.</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={!formData.userId && (!formData.userEmail || !formData.userName)}>
              Register
            </button>
          </form>
        )}

        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Attendee</th>
              <th>Type</th>
              <th>Registered At</th>
              <th>Checked In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendances.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center' }}>
                  No attendances found. Register an attendee!
                </td>
              </tr>
            ) : (
              attendances.map((attendance) => (
                <tr key={attendance.id}>
                  <td>{attendance.event?.title || 'Unknown'}</td>
                  <td>
                    {attendance.user ? `${attendance.user.name} (${attendance.user.email})` : `${attendance.userName} (${attendance.userEmail})`}
                  </td>
                  <td>
                    <span className={`badge badge-${attendance.userId ? 'success' : 'info'}`}>
                      {attendance.userId ? 'User' : 'External'}
                    </span>
                  </td>
                  <td>{formatTableDate(attendance.registeredAt)}</td>
                  <td>
                    {attendance.checkedInAt ? (
                      <span className="badge badge-success">
                        {formatTableDate(attendance.checkedInAt)}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCheckIn(attendance.id)}
                        className="btn btn-small btn-primary"
                      >
                        Check In
                      </button>
                    )}
                  </td>
                  <td>
                    {(() => {
                      // Check if 15 minutes have passed since event start
                      const eventStartTime = attendance.event ? new Date(attendance.event.startTime) : null;
                      const now = new Date();
                      const canDeregister = eventStartTime 
                        ? now < new Date(eventStartTime.getTime() + 15 * 60 * 1000) // 15 minutes after start
                        : true; // If no event data, allow (backend will validate)
                      
                      if (canDeregister) {
                        return (
                          <button
                            onClick={() => deleteAttendance(attendance.id)}
                            className="btn btn-small btn-danger"
                          >
                            Remove
                          </button>
                        );
                      } else {
                        return (
                          <button
                            disabled
                            className="btn btn-small btn-secondary"
                            title="Cannot remove attendance 15 minutes after event starts"
                          >
                            Locked
                          </button>
                        );
                      }
                    })()}
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

export default AttendeeRegistration;
