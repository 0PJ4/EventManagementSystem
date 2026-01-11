import { createContext, useContext } from 'react';

interface OrganizationContextType {
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
}

export const OrganizationContext = createContext<OrganizationContextType>({
  selectedOrgId: null,
  setSelectedOrgId: () => {},
});

export const useOrganization = () => useContext(OrganizationContext);
