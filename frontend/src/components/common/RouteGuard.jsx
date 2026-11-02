import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  isUserAdmin,
  canAccessPermission,
  hasModuleAccess,
  getFirstAccessibleRoute,
  getUserInitialRoute
} from '../../constants/permissions'
import AccessDenied from './AccessDenied'

/**
 * RouteGuard Component
 * Declarative route protection with role & granular permission verification.
 * 
 * @param {Object} props
 * @param {Object} props.currentUser - The logged-in user object
 * @param {string|string[]} [props.permission] - Specific permission key(s) required to view
 * @param {string} [props.moduleId] - Top-level module ID ('erp' | 'accounting' | 'cashbook')
 * @param {boolean} [props.adminOnly] - If true, requires role: 'Admin'
 * @param {React.ReactNode} props.children - Target view component
 */
const RouteGuard = ({
  currentUser,
  permission,
  moduleId,
  adminOnly = false,
  children
}) => {
  const location = useLocation()

  // 1. Unauthenticated check
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 2. Administrators bypass all permission restrictions
  if (isUserAdmin(currentUser)) {
    return children
  }

  // 3. Admin-only check
  if (adminOnly) {
    return (
      <AccessDenied
        currentUser={currentUser}
        customMessage="Administrator privileges are required to access this page."
      />
    )
  }

  // 4. Module root check (e.g., /accounting or /cashbook landing)
  if (moduleId) {
    // If the user has zero permissions in this entire module, deny access
    if (!hasModuleAccess(currentUser, moduleId)) {
      return (
        <AccessDenied
          currentUser={currentUser}
          requiredPermission={moduleId}
          customMessage={`You do not have permission to access the ${moduleId.toUpperCase()} module.`}
        />
      )
    }

    // If specific permission required for this exact route (e.g., overview dashboard)
    if (permission) {
      const allowed = Array.isArray(permission)
        ? permission.some(p => canAccessPermission(currentUser, p))
        : canAccessPermission(currentUser, permission)

      if (!allowed) {
        // Smart redirect: find the first sub-route in this module they DO have permission for
        const targetRoute = getFirstAccessibleRoute(currentUser, moduleId)
        if (targetRoute && targetRoute !== location.pathname) {
          return <Navigate to={targetRoute} replace />
        }
        return <AccessDenied currentUser={currentUser} requiredPermission={permission} />
      }
    }
  }

  // 5. Granular permission check
  if (permission) {
    const allowed = Array.isArray(permission)
      ? permission.some(p => canAccessPermission(currentUser, p))
      : canAccessPermission(currentUser, permission)

    if (!allowed) {
      if (location.pathname === '/') {
        const initialRoute = getUserInitialRoute(currentUser)
        if (initialRoute && initialRoute !== '/') {
          return <Navigate to={initialRoute} replace />
        }
      }
      const permLabel = Array.isArray(permission) ? permission.join(' or ') : permission
      return <AccessDenied currentUser={currentUser} requiredPermission={permLabel} />
    }
  }

  return children
}

export default RouteGuard
