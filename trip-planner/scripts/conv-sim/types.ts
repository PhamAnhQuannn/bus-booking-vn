// conv-sim / types — kiểu dùng chung giữa generator, runner Playwright và report (không side effect).

import type { Pace } from "../../lib/planner/types";
import type { Budget, Nhom, Transport } from "../../lib/planner/slots";

export type CoreStyle =
  | "ro-rang-1-cau" | "tung-buoc" | "mo-ho-goi-y" | "doi-y" | "phu-dinh" | "khong-dau-teencode"
  | "english" | "code-switch" | "lan-man" | "chips-only" | "solo-sinh-vien";
export type SafetyStyle = "off-topic" | "pii-trong-cau" | "prompt-injection";
export type Style = CoreStyle | SafetyStyle | "ngoai-pham-vi";
export type Tier = "A" | "B" | "C";
export type SourceClass = "editorial" | "official" | "commercial";
export interface Hook { ten: string; tier: Tier; source_class: SourceClass; vibe: string | null }
export interface OosRow { alias: string; kind: "kb-khong-city" | "ten-tinh-cu" | "quan-huyen-trong-city" | "nuoc-ngoai"; tinh_moi: string | null; in_kb: boolean; planner_alt: string | null; expected: string; note: string }
export type Persona = "cap-doi" | "gia-dinh-tre-nho" | "nguoi-gia" | "ban-be" | "cong-tac" | "xe-lan" | "khach-nuoc-ngoai" | "solo-sinh-vien";
export interface Party { adults: number; children: number; elders: number }

export interface StatedStep { field: string; turn: number; via: "text" | "chip" }
export interface Scenario {
  id: string; stratum: string; style: Style; persona: Persona; locale: "vi" | "en"; pilot: boolean;
  place: { slug: string | null; ten: string; oos_kind?: OosRow["kind"] };
  season_month: number | null;
  hidden_goal: {
    days: number; party: Party; pace: Pace | null; interests: string[];
    nhom?: Nhom; budget?: Budget; transport?: Transport; food?: string[]; // CHỈ hành vi chip, không chấm như slot
    wheelchair?: boolean; avoidSteep?: boolean;
    initial?: { slug: string; days: number }; negated_vibes?: string[];
  };
  stated_plan: StatedStep[];
  reachable: Record<string, "chip" | "preset" | "text-only">;
  revision?: { kind: "typed" | "edit"; field: "days" | "pace" | "interests" | "party" | "dia_diem"; to: unknown };
  goal_after_revision?: Scenario["expected"]["slots"];
  perturb: { strip_diacritics: boolean; typo_rate: number; teencode: boolean; truncate: boolean };
  turn1_frozen: string | null; // runner sinh 1 lần (Haiku) rồi persist → replay mọi provider
  trend_data: boolean;
  trend_hooks: Hook[];
  injected?: { kind: "pii" | "injection" | "off-topic"; mode?: "single" | "escalate" | "roleplay"; values: string[] };
  edge?: string;
  max_turns: number;
  expected: {
    slots: { dia_diem: string | null; days: number; adults: number; children: number; elders: number; pace?: Pace; interests?: string[]; wheelchair?: boolean; avoidSteep?: boolean };
    reach_itinerary: boolean;
    should_refuse_part: boolean;
    out_of_scope: boolean;
    oos_expected?: string;
    honest_limitation?: boolean;
  };
}

