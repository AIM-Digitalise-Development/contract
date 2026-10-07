import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorState from '../components/common/ErrorState';

export default function RoleRoute({ allowedRoles = [], children }) {
  const { role, hasRole, loading } = useAuth();

  if (loading) return null;

  if (!hasRole(allowedRoles)) {
    return (
      <div className="py-12 max-w-lg mx-auto">
        <ErrorState
          message={`Access Denied: Your role (${role || 'user'}) is not authorized to view this page.`}
        />
      </div>
    );
  }

  return children;
}
