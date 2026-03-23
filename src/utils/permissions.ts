/**
 * Role-based permissions for SafeSphere Emergency Preparedness and Response System.
 *
 * Admin: Full access and permissions.
 * Responder: Can create sessions/courses, approve reporter requests, reply to reporters,
 *   respond to emergency reports, manage prepare content, manage resources, edit safety map,
 *   broadcast alerts. Less than Admin (no user management, no delete records).
 * Reporter: Public - submit reports, request assistance, book sessions. No approval or creation rights.
 */

import type { User } from '../types';

export type UserRole = 'Admin' | 'Responder' | 'Reporter';

/** Can manage all content (checklist, tutorials, learn items) - Admin and Responder */
export const canManagePrepareContent = (user: User | null): boolean =>
    user?.role === 'Admin' || user?.role === 'Responder';

/** Can create and manage sessions/courses (drills) - Admin and Responder */
export const canManageSessionsAndCourses = (user: User | null): boolean =>
    user?.role === 'Admin' || user?.role === 'Responder';

/** Can manage resources (add/edit/delete) - Admin and Responder */
export const canManageResources = (user: User | null): boolean =>
    user?.role === 'Admin' || user?.role === 'Responder';

/** Can access Admin/Response panel (incidents, approve, reply) - Admin and Responder */
export const canAccessAdminPanel = (user: User | null): boolean =>
    user?.role === 'Admin' || user?.role === 'Responder';

/** Can approve reporter requests - Admin and Responder (with permission) */
export const canApproveReports = (user: User | null): boolean =>
    user?.role === 'Admin' || (user?.role === 'Responder' && (user.permissions?.includes('approve_reports') ?? false));

/** Can manage users (team tab) - Admin only */
export const canManageUsers = (user: User | null): boolean =>
    user?.role === 'Admin';

/** Can edit safety map - Admin and Responder */
export const canEditSafetyMap = (user: User | null): boolean =>
    user?.role === 'Admin' || user?.role === 'Responder';

/** Can delete records - Admin only */
export const canDeleteRecords = (user: User | null): boolean =>
    user?.role === 'Admin';

/** Can broadcast alerts - Admin and Responder */
export const canBroadcastAlerts = (user: User | null): boolean =>
    user?.role === 'Admin' || user?.role === 'Responder';

/** Admin Mode badge - Admin only (Responder has their own Response Panel, not Admin Mode) */
export const isAdminOnly = (user: User | null): boolean =>
    user?.role === 'Admin';
