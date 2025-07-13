export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Presence = "missing" | "ok";
export type Condition = "burnt" | "corroded" | "ok";
export type DefectType = string;

export interface Component {
  designator: string;
  mpn: string;
  bbox: BoundingBox;
  presence: Presence;
  condition: Condition;
  confidence: number;
  // New fields for thermal & datasheet
  temperature?: number; // in Celsius
  datasheetUrl?: string;
  maxVoltage?: number; // in Volts
}

export interface Defect {
  id: string;
  type: DefectType; // e.g., "solder_bridge", "overheating"
  bbox: BoundingBox;
  confidence: number;
  description?: string;
}

export interface Replacement {
  mpn: string;
  reason: string;
}

export interface Alternative {
  original_mpn: string;
  replacements: Replacement[];
}

export interface Advice {
  quick_actions: string[];
  alternatives: Alternative[];
  next_steps: string[];
  repair_cost?: number;
}

export interface PcbAnalysis {
  components: Component[];
  defects: Defect[];
  summary: string;
  advice: Advice;
}

// For Chat feature
export interface JumperSuggestion {
    from: { x: number; y: number };
    to: { x: number; y: number };
}

export interface ChatMessage {
    role: "user" | "model";
    text: string;
    jumperSuggestion?: JumperSuggestion;
}