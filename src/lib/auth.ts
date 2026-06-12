import { StaffMember, StaffPermissionLevel } from '../types';

export interface AuthUser {
  authUserId: string;
  email?: string;
  name: string;
  role?: string;
  permissionLevel: StaffPermissionLevel;
  staffMemberId?: string;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthStatus {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

const permissionRank: Record<StaffPermissionLevel, number> = {
  owner: 60,
  manager: 50,
  lead_gm: 40,
  gm: 30,
  trainee: 20,
  viewer: 10,
};

export function normalizePermissionLevel(value: unknown, fallback: StaffPermissionLevel = 'viewer'): StaffPermissionLevel {
  if (value === 'owner' || value === 'manager' || value === 'lead_gm' || value === 'gm' || value === 'trainee' || value === 'viewer') {
    return value;
  }
  return fallback;
}

export function hasPermission(user: AuthUser | null, minimum: StaffPermissionLevel): boolean {
  if (!user?.isAuthenticated) return false;
  return permissionRank[user.permissionLevel] >= permissionRank[minimum];
}

export function canManageData(user: AuthUser | null): boolean {
  return hasPermission(user, 'manager');
}

export function canApproveVersions(user: AuthUser | null): boolean {
  return hasPermission(user, 'manager');
}

export function canAcknowledgeForStaff(user: AuthUser | null, staffId: string): boolean {
  if (!user?.isAuthenticated) return false;
  if (user.staffMemberId === staffId) return true;
  return canManageData(user);
}

export function displayNameForAuthUser(user: AuthUser | null): string {
  if (!user) return 'Unauthenticated';
  return user.name || user.email || 'Authenticated user';
}

export function linkAuthUserToStaff(user: AuthUser | null, staffMembers: StaffMember[]): AuthUser | null {
  if (!user) return null;
  const staff = staffMembers.find((member) => {
    if (member.authUserId && member.authUserId === user.authUserId) return true;
    if (member.email && user.email && member.email.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
  });

  if (!staff) return user;

  return {
    ...user,
    staffMemberId: staff.id,
    name: staff.name || user.name,
    role: staff.role || user.role,
    permissionLevel: normalizePermissionLevel(staff.permissionLevel, user.permissionLevel),
  };
}
