/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Patient, DiseaseCategory, AreaResource, DispatchCommand } from '../types';

export const DISEASE_CATEGORIES: DiseaseCategory[] = [
  { code: 'B08.4', name: 'มือเท้าปาก', incubationDays: 5, thresholdYellow: 3, thresholdRed: 6 },
  { code: 'J06.9', name: 'โรคระบบทางเดินหายใจ', incubationDays: 5, thresholdYellow: 4, thresholdRed: 8 },
  { code: 'A90', name: 'ไข้เลือดออก', incubationDays: 7, thresholdYellow: 4, thresholdRed: 8 },
  { code: 'B010', name: 'ไข้หวัดใหญ่', incubationDays: 3, thresholdYellow: 10, thresholdRed: 20 },
  { code: 'CV-19', name: 'covit-19', incubationDays: 14, thresholdYellow: 3, thresholdRed: 6 },
  { code: 'H-10', name: 'โรคหัด', incubationDays: 10, thresholdYellow: 2, thresholdRed: 4 }
];

export const SATUN_GEOGRAPHY: { [district: string]: string[] } = {
  'เมืองสตูล': ['คลองขุด', 'พิมาน', 'บ้านควน', 'ฉลุง', 'เกาะสาหร่าย', 'ตันหยงโป', 'เจ๊ะบิลัง', 'ควนโพธิ์', 'ปูยู'],
  'ควนโดน': ['ควนโดน', 'ควนสตอ', 'ย่านซื่อ', 'วังประจัน'],
  'ควนกาหลง': ['ควนกาหลง', 'ทุ่งนุ้ย', 'อุไดเจริญ'],
  'ท่าแพ': ['ท่าแพ', 'แป-ระ', 'สาคร', 'ท่าเรือ'],
  'ละงู': ['ละงู', 'กำแพง', 'ปากน้ำ', 'น้ำผุด', 'แหลมสน', 'เขาขาว'],
  'ทุ่งหว้า': ['ทุ่งหว้า', 'นาทอน', 'ขอนคลาน', 'ทุ่งบุหลัง', 'ป่าแก่บ่อหิน'],
  'มะนัง': ['ปาล์มพัฒนา', 'นิคมพัฒนา']
};

// สุ่มเลขบัตรประจำตัวประชาชนแบบปิดบังเพื่อความสมจริง
export function generateMaskedCID() {
  const segment1 = Math.floor(Math.random() * 9) + 1;
  const segment2 = Math.floor(Math.random() * 90) + 10;
  return `${segment1}-${segment2}XX-XXXXX-XX-X`;
}

// สร้างข้อมูลผู้ป่วยเริ่มต้น
const getPastDateString = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // Format as YYYY-MM-DD
  return d.toISOString().split('T')[0];
};

export const INITIAL_PATIENTS: Patient[] = [
  // --- ต.พิมาน (เมืองสตูล) จำนวน 11 ราย (แดง: เสี่ยงสูง/วิกฤต) ---
  {
    id: 'PT-001',
    cidEncrypted: '3-91XX-XXXXX-12-3',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 1 คลองขุดใต้',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(2),
    reportedDate: getPastDateString(1),
    age: 12,
    gender: 'ชาย'
  },
  {
    id: 'PT-002',
    cidEncrypted: '1-91XX-XXXXX-98-4',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 1 คลองขุดใต้',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(3),
    reportedDate: getPastDateString(2),
    age: 9,
    gender: 'หญิง'
  },
  {
    id: 'PT-003',
    cidEncrypted: '3-91XX-XXXXX-45-1',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 2 ถนนสฤษดิ์ภูมินทร์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(4),
    reportedDate: getPastDateString(3),
    age: 15,
    gender: 'ชาย'
  },
  {
    id: 'PT-004',
    cidEncrypted: '1-90XX-XXXXX-33-2',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 2 ถนนสฤษดิ์ภูมินทร์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(5),
    reportedDate: getPastDateString(4),
    age: 23,
    gender: 'หญิง'
  },
  {
    id: 'PT-005',
    cidEncrypted: '5-91XX-XXXXX-40-1',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 3 ชุมชนหลังไปรษณีย์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(6),
    reportedDate: getPastDateString(5),
    age: 11,
    gender: 'ชาย'
  },
  {
    id: 'PT-006',
    cidEncrypted: '3-90XX-XXXXX-11-2',
    diseaseCode: 'B08.4',
    diseaseName: 'มือเท้าปาก',
    village: 'หมู่ 4 ชุมชนบ้านนาลาน',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(8),
    reportedDate: getPastDateString(7),
    age: 4,
    gender: 'หญิง'
  },
  {
    id: 'PT-007',
    cidEncrypted: '1-93XX-XXXXX-72-9',
    diseaseCode: 'B08.4',
    diseaseName: 'มือเท้าปาก',
    village: 'หมู่ 4 ชุมชนบ้านนาลาน',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(9),
    reportedDate: getPastDateString(8),
    age: 3,
    gender: 'ชาย'
  },
  {
    id: 'PT-008',
    cidEncrypted: '1-90XX-XXXXX-51-6',
    diseaseCode: 'J06.9',
    diseaseName: 'โรคระบบทางเดินหายใจ',
    village: 'หมู่ 5 ถนนเรืองฤทธิ์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(10),
    reportedDate: getPastDateString(10),
    age: 37,
    gender: 'ชาย'
  },
  {
    id: 'PT-009',
    cidEncrypted: '1-91XX-XXXXX-09-5',
    diseaseCode: 'J06.9',
    diseaseName: 'โรคระบบทางเดินหายใจ',
    village: 'หมู่ 5 ถนนเรืองฤทธิ์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(11),
    reportedDate: getPastDateString(11),
    age: 26,
    gender: 'หญิง'
  },
  {
    id: 'PT-010',
    cidEncrypted: '8-91XX-XXXXX-22-3',
    diseaseCode: 'B010',
    diseaseName: 'ไข้หวัดใหญ่',
    village: 'หมู่ 3 ชุมชนหลังไปรษณีย์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(12),
    reportedDate: getPastDateString(11),
    age: 13,
    gender: 'หญิง'
  },
  {
    id: 'PT-011',
    cidEncrypted: '3-95XX-XXXXX-81-0',
    diseaseCode: 'B010',
    diseaseName: 'ไข้หวัดใหญ่',
    village: 'หมู่ 2 ถนนสฤษดิ์ภูมินทร์',
    subDistrict: 'พิมาน',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(3),
    reportedDate: getPastDateString(2),
    age: 24,
    gender: 'ชาย'
  },

  // --- ต.ควนโพธิ์ (เมืองสตูล) จำนวน 2 ราย (เหลือง: เฝ้าระวัง) ---
  {
    id: 'PT-012',
    cidEncrypted: '1-90XX-XXXXX-55-4',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 2 บ้านควนโพธิ์',
    subDistrict: 'ควนโพธิ์',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(5),
    reportedDate: getPastDateString(4),
    age: 32,
    gender: 'หญิง'
  },
  {
    id: 'PT-013',
    cidEncrypted: '3-91XX-XXXXX-12-9',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 3 บ้านทุ่งสะเดา',
    subDistrict: 'ควนโพธิ์',
    district: 'เมืองสตูล',
    onsetEmanationDate: getPastDateString(7),
    reportedDate: getPastDateString(6),
    age: 15,
    gender: 'ชาย'
  },

  // --- ต.ควนกาหลง (ควนกาหลง) จำนวน 1 ราย (เหลือง: เฝ้าระวัง) ---
  {
    id: 'PT-014',
    cidEncrypted: '6-90XX-XXXXX-03-3',
    diseaseCode: 'B08.4',
    diseaseName: 'มือเท้าปาก',
    village: 'หมู่ 1 บ้านควนกาหลง',
    subDistrict: 'ควนกาหลง',
    district: 'ควนกาหลง',
    onsetEmanationDate: getPastDateString(9),
    reportedDate: getPastDateString(8),
    age: 5,
    gender: 'หญิง'
  },

  // --- ต.ป่าแก่บ่อหิน (ทุ่งหว้า) จำนวน 2 ราย (เหลือง: เฝ้าระวัง) ---
  {
    id: 'PT-015',
    cidEncrypted: '1-90XX-XXXXX-19-1',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 3 บ้านโคกทราย',
    subDistrict: 'ป่าแก่บ่อหิน',
    district: 'ทุ่งหว้า',
    onsetEmanationDate: getPastDateString(11),
    reportedDate: getPastDateString(10),
    age: 14,
    gender: 'ชาย'
  },
  {
    id: 'PT-016',
    cidEncrypted: '3-91XX-XXXXX-71-2',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 1 บ้านป่าแก่',
    subDistrict: 'ป่าแก่บ่อหิน',
    district: 'ทุ่งหว้า',
    onsetEmanationDate: getPastDateString(6),
    reportedDate: getPastDateString(5),
    age: 32,
    gender: 'หญิง'
  },

  // --- ต.กำแพง (ละงู) จำนวน 1 ราย (เหลือง: เฝ้าระวัง) ---
  {
    id: 'PT-017',
    cidEncrypted: '3-92XX-XXXXX-90-5',
    diseaseCode: 'A90',
    diseaseName: 'ไข้เลือดออก',
    village: 'หมู่ 2 บ้านศาลาแดง',
    subDistrict: 'กำแพง',
    district: 'ละงู',
    onsetEmanationDate: getPastDateString(13),
    reportedDate: getPastDateString(12),
    age: 45,
    gender: 'ชาย'
  }
];

// สร้างทรัพยากรเริ่มต้น
export const INITIAL_RESOURCES: AreaResource[] = [];

// เติมทรัพยากรเริ่มต้นให้ครบทุกตำบลในจังหวัดสตูล
Object.keys(SATUN_GEOGRAPHY).forEach(district => {
  SATUN_GEOGRAPHY[district].forEach(subDistrict => {
    // ให้บางพื้นที่ระบาด มีการควบคุมบางส่วน แต่พื้นที่ทั่วไปไม่มีหรือเรียบร้อยดี
    let abate: 'yes' | 'no' | 'partial' = 'no';
    let fog: 'yes' | 'no' | 'partial' = 'no';
    let med: 'yes' | 'no' = 'no';
    let edu: 'yes' | 'no' = 'no';

    if (subDistrict === 'กำแพง' && district === 'ละงู') {
      abate = 'partial';
      fog = 'yes';
      med = 'yes';
      edu = 'yes';
    } else if (subDistrict === 'คลองขุด' && district === 'เมืองสตูล') {
      abate = 'yes';
      med = 'yes';
    }

    INITIAL_RESOURCES.push({
      subDistrict,
      district,
      abateSandApplied: abate,
      foggingDone: fog,
      medicalStaffAssigned: med,
      educationGiven: edu,
      lastUpdated: getPastDateString(1)
    });
  });
});

// คำสั่งการ / การกระจายทรัพยากรเริ่มต้น
export const INITIAL_COMMANDS: DispatchCommand[] = [
  {
    id: 'CMD-001',
    targetSubDistrict: 'กำแพง',
    targetDistrict: 'ละงู',
    commandTitle: 'จัดส่งชุดพ่นหมอกควันและทรายอะเบทฉุกเฉิน',
    urgency: 'critical',
    items: [
      { name: 'ทรายอะเบท (ซอง)', quantity: 300, unit: 'ซอง' },
      { name: 'สารเคมีกำจัดยุง (ขวด)', quantity: 15, unit: 'ขวด' },
      { name: 'พนักงานฉีดพ่น', quantity: 4, unit: 'คน' }
    ],
    instructions: 'พบคลัสเตอร์ผู้ป่วยไข้เลือดออกจำนวน 11 คนบริเวณ หมู่ 2 บ้านศาลาแดง ขอให้ดำเนินการสุ่มตรวจลูกน้ำยุงลายและพ่นสารเคมีโดยรอบในรัศมี 100 เมตรทันที',
    status: 'received',
    senderName: 'นพ. วิทยา ชลาพันธ์',
    senderRole: 'หัวหน้ากลุ่มงานควบคุมโรค สสจ.สตูล',
    createdAt: getPastDateString(1) + 'T08:30:00Z',
    updatedAt: getPastDateString(1) + 'T09:15:00Z'
  },
  {
    id: 'CMD-002',
    targetSubDistrict: 'คลองขุด',
    targetDistrict: 'เมืองสตูล',
    commandTitle: 'เฝ้าระวังโรคมือเท้าปากในสถานพัฒนาเด็กปฐมวัย',
    urgency: 'medium',
    items: [
      { name: 'น้ำยาฆ่าเชื้อแอลกอฮอล์', quantity: 20, unit: 'แกลลอน' },
      { name: 'โปสเตอร์แผ่นพับสุขศึกษา', quantity: 100, unit: 'แผ่น' }
    ],
    instructions: 'ประสานงานศูนย์เด็กเล็กและอนุบาลในพื้นที่คลองขุด ทำความสะอาดของเล่นและคัดกรองอุณหภูมิเด็กหน้าโรงเรียนทุกเช้า หลังพบผู้ป่วยเด็กสะสม 5 คน',
    status: 'completed',
    senderName: 'นพ. วิทยา ชลาพันธ์',
    senderRole: 'หัวหน้ากลุ่มงานควบคุมโรค สสจ.สตูล',
    createdAt: getPastDateString(2) + 'T10:15:00Z',
    updatedAt: getPastDateString(1) + 'T16:00:00Z'
  }
];
