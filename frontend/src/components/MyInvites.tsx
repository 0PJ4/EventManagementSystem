import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatEventDateTime, formatTableDate } from '../utils/dateFormatter';
import '../App.css';

interface Invite {
  id: string;
  event: {
    id: string;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
  };
  invitedByOrganization: {
    name: string;
  };
  status: string;
  createdAt: string;
}

function MyInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const response = await api.get('/invites/my-invites');
      setInvites(response.data || []);
    } catch (error: any) {
      console.error('Failed to load invites:', error);
      toast.error(error.response?.data?.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (inviteId: string) => {
    try {
      await api.post(`/invites/${inviteId}/accept`);
      toast.success('Invite accepted! You have been registered for the event.');
      loadInvites();
    } catch (error: any) {
      console.error('Failed to accept invite:', error);
      toast.error(error.response?.data?.message || 'Failed to accept invite');
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (!window.confirm('Are you sure you want to decline this invite?')) return;
    try {
      await api.post(`/invites/${inviteId}/decline`);
      toast.success('Invite declined.');
      loadInvites();
    } catch (error: any) {
      console.error('Failed to decline invite:', error);
      toast.error(error.response?.data?.message || 'Failed to decline invite');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const pendingInvites = invites.filter(inv => inv.status === 'pending');
  const respondedInvites = invites.filter(inv => inv.status !== 'pending');

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">My Invitations</h1>
          <span className="badge badge-primary" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {pendingInvites.length} Pending
          </span>
        </div>

        {pendingInvites.length === 0 && respondedInvites.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <h3>No invitations</h3>
            <p>You don't have any event invitations at the moment.</p>
          </div>
        ) : (
          <>
            {pendingInvites.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>
                  Pending Invitations
                </h2>
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                  {pendingInvites.map((invite) => (
                    <div 
                      key={invite.id}
                      style={{
                        background: 'var(--primary-50)',
                        border: '2px solid var(--primary-200)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.5rem' }}>
                            {invite.event.title}
                          </h3>
                          <p style={{ color: 'var(--gray-600)', marginBottom: '0.5rem' }}>
                            {invite.event.description}
                          </p>
                          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                                From
                              </div>
                              <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                                {invite.invitedByOrganization.name}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                                Start Time
                              </div>
                              <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                                {formatEventDateTime(invite.event.startTime)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
                                End Time
                              </div>
                              <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                                {formatEventDateTime(invite.event.endTime)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--primary-200)' }}>
                        <button
                          onClick={() => handleAccept(invite.id)}
                          className="btn btn-success"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Accept Invitation
                        </button>
                        <button
                          onClick={() => handleDecline(invite.id)}
                          className="btn btn-secondary"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {respondedInvites.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>
                  Past Invitations
                </h2>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>From</th>
                        <th>Start Time</th>
                        <th>Status</th>
                        <th>Responded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {respondedInvites.map((invite) => (
                        <tr key={invite.id}>
                          <td style={{ fontWeight: 600 }}>{invite.event.title}</td>
                          <td>{invite.invitedByOrganization.name}</td>
                          <td>{formatTableDate(invite.event.startTime)}</td>
                          <td>
                            <span className={`badge badge-${
                              invite.status === 'accepted' ? 'success' :
                              invite.status === 'declined' ? 'danger' :
                              'gray'
                            }`}>
                              {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                            </span>
                          </td>
                          <td>{formatTableDate(invite.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default MyInvites;
