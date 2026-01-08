// Action types and interfaces for Phase 2A: Action Proposals

export type ActionType =
  | "REQUEST_MORE_INFO"
  | "PROPOSE_ALLOCATION"
  | "FLAG_ANOMALY"
  | "CREATE_DRAFT_JOURNAL";

export type ActionRisk = "LOW" | "MEDIUM" | "HIGH";

export interface ActionCitation {
  citationId: string;
  title?: string;
}

export interface ProposedAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  risk: ActionRisk;
  payload?: Record<string, any>;
  citations: ActionCitation[];
}

export interface ActionPreviewResponse {
  outcomeText: string;
  actions: ProposedAction[];
  hasActions: boolean;
  debug?: any;
}
