import {Role} from './role';

export interface AdminUser {
  uuid: string;
  name: string;
  email: string;
  active: boolean;
  role: Role;
  /** True only when a signup email verification was completed. */
  verified: boolean;
  /** Registration timestamp in UTC (ISO 8601). */
  created_at: string;
  channel_name: string | null;
  channel_uuid: string | null;
}

export interface AdminUserPage {
  users: AdminUser[];
  total: number;
}
