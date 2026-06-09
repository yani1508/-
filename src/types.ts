/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Patient {
  id: string;
  cidEncrypted: string;
  diseaseCode: string;
  diseaseName: string;
  village: string;
  subDistrict: string;
  district: string;
  onsetEmanationDate: string;
  reportedDate: string;
  age: number;
  gender: 'ชาย' | 'หญิง';
}

export type AlertLevel = 'green' | 'yellow' | 'red';
export type TrendDirection = 'stable' | 'increasing' | 'outbreak';

export interface AreaStatus {
  subDistrict: string;
  district: string;
  currentCount: number;      // ผู้ป่วย 2 สัปดาห์ล่าสุด (สะสม)
  previousCount: number;     // ผู้ป่วย 2 สัปดาห์ก่อนหน้า
  avgHistorical: number;     // ค่าเฉลี่ยประวัติศาสตร์รายปักษ์
  diseaseSummary: { [code: string]: number }; // จำนวนผู้ป่วยแยกตามรายโรค
  status: AlertLevel;        // เขียว / เหลือง / แดง
  trend: TrendDirection;
}

export interface PredictiveAlert {
  id: string;
  subDistrict: string;
  district: string;
  diseaseCode: string;
  diseaseName: string;
  message: string;
  severity: 'yellow' | 'red';
  createdAt: string;
  resolved: boolean;
}

export interface AreaResource {
  subDistrict: string;
  district: string;
  abateSandApplied: 'yes' | 'no' | 'partial';
  foggingDone: 'yes' | 'no' | 'partial';
  medicalStaffAssigned: 'yes' | 'no';
  educationGiven: 'yes' | 'no';
  lastUpdated: string;
}

export interface DispatchCommand {
  id: string;
  targetSubDistrict: string;
  targetDistrict: string;
  commandTitle: string;
  urgency: 'medium' | 'high' | 'critical';
  items: { name: string; quantity: number; unit: string }[];
  instructions: string;
  status: 'pending' | 'received' | 'completed';
  senderName: string;
  senderRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiseaseCategory {
  code: string;
  name: string;
  incubationDays: number;
  thresholdYellow: number; // เกณฑ์จำนวนผู้ป่วยสะสม 2 สัปดาห์ในการยกสถานะเป็น สีเหลือง
  thresholdRed: number;    // เกณฑ์จำนวนผู้ป่วยสะสม 2 สัปดาห์ในการยกสถานะเป็น สีแดง
}
