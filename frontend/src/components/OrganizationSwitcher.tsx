import { useState, useEffect } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import api from '../services/api';
import toast from 'react-hot-toast';

interface Organization {
  id: string;
  name: string;
}

function OrganizationSwitcher() {
  const { selectedOrgId, setSelectedOrgId } = useOrganization();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const response = await api.get('/organizations');
      setOrganizations(response.data);
      if (response.data.length > 0 && !selectedOrgId) {
        setSelectedOrgId(response.data[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load organizations:', error);
      toast.error(error.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading organizations...</div>;
  }

  return (
    <div>
      <label htmlFor="org-select" style={{ marginRight: '0.5rem', color: 'white' }}>
        Organization:
      </label>
      <select
        id="org-select"
        value={selectedOrgId || ''}
        onChange={(e) => setSelectedOrgId(e.target.value || null)}
        style={{ padding: '0.5rem', borderRadius: '4px', border: 'none' }}
      >
        <option value="">Select Organization</option>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default OrganizationSwitcher;
