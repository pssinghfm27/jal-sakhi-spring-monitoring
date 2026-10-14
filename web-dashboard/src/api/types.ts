// SPDX-License-Identifier: MIT

export type Role = 'krp' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  phone?: string;
}

export interface AuthResponse {
  ok: boolean;
  token: string;
  user: User;
}

export type Status = 'green' | 'amber' | 'red' | 'unknown';

export interface MapMarker {
  id: string;
  code: string | null;
  name_en: string;
  name_hi: string;
  lat: number;
  lon: number;
  village: string;
  block: string;
  district: string;
  last_quality_at: string | null;
  days_since: number | null;
  status: Status;
}

export interface DashboardSummary {
  counts: {
    springs: number;
    krps: number;
    villages: number;
    discharge_30d: number;
    quality_30d: number;
  };
  status_mix: Record<Status, number>;
  recent_activity: Array<{
    kind: 'discharge' | 'quality';
    id: string;
    recorded_at: string;
    name_en: string;
    krp_name: string;
  }>;
}

export interface DischargePoint {
  recorded_at: string;
  discharge_lpm: number;
  method: string;
  weather: string;
  anomaly: boolean;
}

export interface QualityPoint {
  recorded_at: string;
  ph: number | null;
  tds: number | null;
  turbidity: number | null;
  hardness: number | null;
  alkalinity: number | null;
  chloride: number | null;
  iron: number | null;
  fecal_coliform: number | null;
  anomaly: boolean;
  photo_url: string | null;
}

export interface SpringTrends {
  spring: {
    id: string;
    code: string | null;
    name_en: string;
    name_hi: string;
    lat: number;
    lon: number;
    altitude_m: number | null;
    spring_type: string | null;
    project_name: string | null;
    village: string;
    block: string;
    district: string;
  };
  discharge: DischargePoint[];
  quality: QualityPoint[];
  health: {
    total: number;
    components: {
      discharge_stability: number;
      bis_compliance: number;
      sampling_regularity: number;
    };
  };
}

export interface BlockRollup {
  block: string;
  district: string;
  spring_count: number;
  avg_discharge_lpm: number | null;
  discharge_change_pct: number | null;
  status_mix: Record<Status, number>;
}

export interface AlertItem {
  kind: 'discharge' | 'quality';
  id: string;
  recorded_at: string;
  value: number | null;
  spring_id: string;
  name_en: string;
  village: string;
  krp_name: string | null;
  krp_phone: string | null;
}

export interface OverdueItem {
  id: string;
  name_en: string;
  village: string;
  block: string;
  last_test: string | null;
  days_since: number;
  krp_name: string | null;
  krp_phone: string | null;
}

export interface KrpRow {
  id: string;
  name: string;
  phone: string;
  village: string | null;
  block: string | null;
  discharge_count: number;
  quality_count: number;
  last_active: string | null;
}

export interface SpringManaged {
  id: string; code: string; name_en: string; name_hi: string | null;
  lat: number | null; lon: number | null; altitude_m: number | null;
  spring_type: string | null; project_name: string | null;
  active: boolean; created_at: string; updated_at: string;
  village_id: string; village_name: string; gp: string | null; block: string; district: string;
  discharge_count: number; quality_count: number;
  last_discharge_at: string | null; last_quality_at: string | null;
}

export interface UploadResult {
  ok: boolean;
  summary: {
    total_parsed: number; created: number; updated: number;
    errors: number; error_details: { row: number; message: string }[];
  };
}

export interface UploadHistoryItem {
  id: string; filename: string; uploaded_by_name: string;
  total_rows: number; created_count: number; updated_count: number;
  error_count: number; created_at: string;
}

export interface ReadingRow {
  kind: 'discharge' | 'quality'; id: string; spring_id: string; krp_id: string;
  recorded_at: string; lat: number; lon: number;
  discharge_lpm: number | null; method: string | null; weather: string | null;
  ph: number | null; tds: number | null; turbidity: number | null;
  hardness: number | null; alkalinity: number | null;
  chloride: number | null; iron: number | null; fecal_coliform: number | null;
  anomaly: boolean; synced_at: string | null; photo_url: string | null;
  spring_code: string; spring_name: string;
  village_name: string; block: string; district: string;
  krp_name: string | null; krp_phone: string | null;
}

export interface PaginatedReadings {
  items: ReadingRow[]; total: number; page: number; limit: number; pages: number;
}

export interface KrpManaged {
  id: string; name: string; phone: string; role: string;
  active: boolean; approval_status: string;
  created_at: string; approved_at: string | null;
  rejected_reason: string | null; signup_note: string | null;
  village_id: string | null; village_name: string | null; block: string | null; district: string | null;
  discharge_count: number; quality_count: number; last_active: string | null;
}

export interface Village {
  id: string; name: string; gp: string | null; block: string; district: string;
  spring_count: number; krp_count: number;
}
