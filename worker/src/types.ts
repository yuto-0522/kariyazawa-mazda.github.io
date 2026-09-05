export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  DEALER_KEY: string;
}

export interface Participant {
  id: string;
  name: string;
  points: number;
  created_at: string;
}

export type RoundStatus = "open" | "settled" | "cancelled";

export interface Round {
  id: string;
  slot_a_label: string | null;
  slot_a_value: string | null;
  slot_b_label: string | null;
  slot_b_value: string | null;
  status: RoundStatus;
  created_at: string | null;
  settled_at: string | null;
  archived_at: string | null;
}
