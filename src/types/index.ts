// ─── Todo ───
export type TodoType = 'TODO' | 'FIXME';
export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'open' | 'active' | 'resolved';

export interface Todo {
  id: string;
  workspace_id: string;
  type: TodoType;
  text: string;
  file: string;
  line: number | null;
  assignee: string;
  priority: TodoPriority;
  status: TodoStatus;
  order: number;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TodoStats {
  total: number;
  open: number;
  active: number;
  resolved: number;
  fixme: number;
  todo: number;
}

// ─── Feed ───
export type FeedPostType = 'manual' | 'todo_detected' | 'fixme_resolved' | 'planning_done' | 'ai_event';

export interface FeedReply {
  id: string;
  author: string;
  author_id?: string;
  content: string;
  timestamp: string;
}

export interface FeedPost {
  id: string;
  workspace_id: string;
  author: string;
  author_id: string | null;
  content: string;
  type: FeedPostType;
  metadata: Record<string, unknown>;
  reactions: Record<string, string[]>;
  replies: FeedReply[];
  created_at: string;
}

// ─── Memory ───
export interface GlobalMemory {
  id: string;
  user_id: string;
  preferences: string[];
  coding_style: string | null;
  active_systems: string[];
  always_inject: string | null;
  updated_at: string;
}

export interface ProjectMemory {
  id: string;
  workspace_id: string;
  name: string;
  game_name: string | null;
  language: string | null;
  stack: string | null;
  decisions: Array<{ text: string; created: string }>;
  known_bugs: Array<{ text: string; created: string }>;
  architecture: unknown[];
  service_structure: string[];
  remote_names: string[];
  coding_style_prefs: string[];
  updated_at: string;
}

export interface MemoryData {
  global: GlobalMemory | null;
  project: ProjectMemory | null;
  session: string[];
}

// ─── Public View ───
export interface PublicView {
  version: string;
  roadmap: Array<{ title: string; status: string }>;
  patchNotes: Array<{ date: string; text: string }>;
  knownIssues: Array<{ id: string; text: string; type: string; priority: string; created_at: string }>;
  lastUpdated: string;
}

// ─── Workspace ───
export type UserRole = 'owner' | 'dev' | 'viewer';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: UserRole;
  email: string | null;
  joined_at: string;
}

// ─── Agent / Pipeline ───
export type AgentRole = 'solver' | 'critic' | 'synthesizer' | 'devil' | 'compiler' | 'finalizer';
export type AgentStatus = 'thinking' | 'streaming' | 'complete' | 'error';

export interface AgentState {
  role: AgentRole;
  status: AgentStatus;
  output: string;
  model: string;
  duration: number;
  round: number;
}

export interface PipelineConfig {
  mode: 'code' | 'planning' | 'content' | 'research' | 'debate';
  primaryOverride?: 'kimi' | 'claude' | 'auto';
  planningMode: boolean;
  maxRounds: number;
}

export interface PipelineEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}
