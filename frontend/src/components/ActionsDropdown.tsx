import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

interface ActionsDropdownProps {
  actions: Array<{
    label: string;
    onClick?: () => void;
    to?: string;
    className?: string;
    danger?: boolean;
  }>;
}

function ActionsDropdown({ actions }: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (action: typeof actions[0]) => {
    if (action.onClick) {
      action.onClick();
    }
    setIsOpen(false);
  };

  return (
    <div className="actions-dropdown" ref={dropdownRef}>
      <button
        className="btn btn-sm btn-secondary"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="Actions"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
        Actions
      </button>
      {isOpen && (
        <div className="actions-dropdown-menu">
          {actions.map((action, index) => {
            const content = (
              <div
                key={index}
                className={`actions-dropdown-item ${action.danger ? 'danger' : ''} ${action.className || ''}`}
                onClick={() => handleAction(action)}
              >
                {action.label}
              </div>
            );

            if (action.to) {
              return (
                <Link key={index} to={action.to} className="actions-dropdown-link">
                  {content}
                </Link>
              );
            }

            return content;
          })}
        </div>
      )}
    </div>
  );
}

export default ActionsDropdown;
