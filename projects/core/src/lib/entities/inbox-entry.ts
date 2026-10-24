export interface InboxEntry {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  action_path: string | null;
}
export interface InboxCounts { total: number; unread: number; }
export interface InboxPage extends InboxCounts { items: InboxEntry[]; }
