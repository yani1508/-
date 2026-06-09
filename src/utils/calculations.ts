/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Patient, AreaStatus, DiseaseCategory, AlertLevel, TrendDirection, PredictiveAlert } from '../types';
import { DISEASE_CATEGORIES, SATUN_GEOGRAPHY } from '../data/satunData';

/**
 * คำนวณความต่างวัน
 */
export function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * สำหรับคำนวณแยกตามตำบลในสตูล และระบุระดับความเสี่ยง
 */
export function recalculateAreaStatuses(
  patients: Patient[],
  categories: DiseaseCategory[] = DISEASE_CATEGORIES
): AreaStatus[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date();

  // จัดกลุ่มผู้ป่วยในช่วงเวลา
  // 14 วันล่าสุด (2 สัปดาห์ปัจจุบัน)
  // 15 - 28 วันก่อนหน้า (2 สัปดาห์ก่อนหน้า)
  const recentPatients = patients.filter(p => {
    const diff = getDaysDifference(p.onsetEmanationDate, todayStr);
    const pDate = new Date(p.onsetEmanationDate);
    return diff <= 14 && pDate <= today;
  });

  const priorPatients = patients.filter(p => {
    const diff = getDaysDifference(p.onsetEmanationDate, todayStr);
    const pDate = new Date(p.onsetEmanationDate);
    return diff > 14 && diff <= 28 && pDate <= today;
  });

  const statuses: AreaStatus[] = [];

  // วนลูปตามภูมิศาสตร์สตูลเพื่อคำนวณวิเคราะห์ข้อมูลรายตำบล
  Object.keys(SATUN_GEOGRAPHY).forEach(district => {
    SATUN_GEOGRAPHY[district].forEach(subDistrict => {
      // 1. คัดกรองผู้ป่วยของตำบลนี้
      const areaRecent = recentPatients.filter(
        p => p.subDistrict.trim() === subDistrict.trim() && p.district.trim() === district.trim()
      );
      const areaPrior = priorPatients.filter(
        p => p.subDistrict.trim() === subDistrict.trim() && p.district.trim() === district.trim()
      );

      // 2. นับสะสมรายโรคของสัปดาห์ปัจจุบัน
      const diseaseSummary: { [code: string]: number } = {};
      categories.forEach(cat => {
        diseaseSummary[cat.code] = 0;
      });

      areaRecent.forEach(p => {
        if (diseaseSummary[p.diseaseCode] !== undefined) {
          diseaseSummary[p.diseaseCode]++;
        } else {
          diseaseSummary[p.diseaseCode] = 1;
        }
      });

      // 3. วิเคราะห์หาโรคที่มีความเสี่ยงสูงสุดในพื้นที่นี้
      let highestLevel: AlertLevel = 'green';
      let highestTrend: TrendDirection = 'stable';

      categories.forEach(cat => {
        const currentCount = diseaseSummary[cat.code] || 0;
        
        // นับปักษ์ก่อนหน้าสำหรับโรคนั้น ๆ เพื่อดูแนวโน้ม
        const priorCount = areaPrior.filter(p => p.diseaseCode === cat.code).length;

        // เกณฑ์เปรียบเทียบความเสี่ยงตามนโยบายควบคุมโรค
        let level: AlertLevel = 'green';
        if (currentCount >= cat.thresholdRed) {
          level = 'red';
        } else if (currentCount >= cat.thresholdYellow) {
          level = 'yellow';
        } else if (currentCount > 0 && currentCount > priorCount) {
          // หากกรณีผู้ป่วยเริ่มเพิ่มขึ้นแม้ยังไม่ถึงเกณฑ์ เป็นเฝ้าระวังต่ำ (เหลืองอ่อน/เหลือง)
          level = 'yellow';
        }

        // ประเมินทิศทางแนวโน้ม (Trend)
        let trend: TrendDirection = 'stable';
        if (currentCount > priorCount && currentCount >= 2) {
          trend = currentCount >= cat.thresholdRed ? 'outbreak' : 'increasing';
        }

        // หาจุดที่มีความเสี่ยงสูงสุดเพื่อสรุปผลของตำบลนั้น
        if (level === 'red') {
          highestLevel = 'red';
        } else if (level === 'yellow' && highestLevel !== 'red') {
          highestLevel = 'yellow';
        }

        if (trend === 'outbreak') {
          highestTrend = 'outbreak';
        } else if (trend === 'increasing' && highestTrend !== 'outbreak') {
          highestTrend = 'increasing';
        }
      });

      // จำลองค่าเฉลี่ยทางสถิติประวัติศาสตร์ของตำบล (เพื่อคำนวณหาค่าเฉลี่ยและลากสถิติ)
      // โดยทั่วไปกำหนดค่าเฉลี่ยคงที่ประมาณ 1.5 รายต่อตำบลเพื่อเป็นฐานอ้างอิง
      const avgHistorical = parseFloat(
        ((areaRecent.length + areaPrior.length) / 2 + 0.3).toFixed(1)
      );

      statuses.push({
        subDistrict,
        district,
        currentCount: areaRecent.length,
        previousCount: areaPrior.length,
        avgHistorical: avgHistorical || 0.5,
        diseaseSummary,
        status: highestLevel,
        trend: highestTrend
      });
    });
  });

  return statuses;
}

/**
 * สร้างการแจ้งเตือนพยากรณ์โรคอัตโนมัติ (Predictive Alerts) ตามเงื่อนไขความเสี่ยงแบบ Real-time
 */
export function generatePredictiveAlerts(
  patients: Patient[],
  categories: DiseaseCategory[] = DISEASE_CATEGORIES
): PredictiveAlert[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const areaStatuses = recalculateAreaStatuses(patients, categories);
  const alerts: PredictiveAlert[] = [];

  areaStatuses.forEach(area => {
    if (area.status === 'green') return;

    // หาว่าโรคไหนที่ทำให้เกิดการแจ้งเตือน
    categories.forEach(cat => {
      const currentCount = area.diseaseSummary[cat.code] || 0;
      
      if (currentCount >= cat.thresholdYellow) {
        const severity = currentCount >= cat.thresholdRed ? 'red' : 'yellow';
        const severityText = severity === 'red' ? 'แพร่ระบาดฉับพลัน' : 'เฝ้าระวังสูงสุด';

        alerts.push({
          id: `ALERT-${area.district}-${area.subDistrict}-${cat.code}`.replace(/\s+/g, ''),
          subDistrict: area.subDistrict,
          district: area.district,
          diseaseCode: cat.code,
          diseaseName: cat.name,
          message: `ตำบล${area.subDistrict} (อำเภอ${area.district}) ตรวจพบแนวโน้มผู้ป่วยโรค${cat.name} เพิ่มขึ้นอย่างผิดปกติสะสมถึง ${currentCount} รายในรอบ 2 สัปดาห์ จัดเป็นพื้นที่เสี่ยงระดับควบคุม [สี${severity === 'red' ? 'แดง' : 'เหลือง'} - ${severityText}]`,
          severity,
          createdAt: new Date().toISOString(),
          resolved: false
        });
      }
    });
  });

  return alerts;
}
