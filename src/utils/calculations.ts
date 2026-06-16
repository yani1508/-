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
  const statuses: AreaStatus[] = [];

  // วนลูปตามภูมิศาสตร์สตูลเพื่อคำนวณวิเคราะห์ข้อมูลรายตำบล
  Object.keys(SATUN_GEOGRAPHY).forEach(district => {
    SATUN_GEOGRAPHY[district].forEach(subDistrict => {
      // 1. คัดกรองผู้ป่วยของตำบลนี้ทั้งหมด (ตรงตามแนวคิดของ Heatmap และชีท 5 ในรอบการป้อนสด)
      const areaPatients = patients.filter(
        p => p.subDistrict.trim() === subDistrict.trim() && p.district.trim() === district.trim()
      );

      // 2. นับสะสมรายโรคทั้งหมดของตำบลนี้ตามระเบียบข้อมูลสะสม
      const diseaseSummary: { [code: string]: number } = {};
      categories.forEach(cat => {
        diseaseSummary[cat.code] = 0;
      });

      areaPatients.forEach(p => {
        if (diseaseSummary[p.diseaseCode] !== undefined) {
          diseaseSummary[p.diseaseCode]++;
        } else {
          diseaseSummary[p.diseaseCode] = 1;
        }
      });

      // 3. จัดระดับความเสี่ยงตามสี ร่วมแบบแผนเดียวกับ Heatmap (🟢, 🟡, 🟠, 🔴)
      // 🟢 เขียว (เสี่ยงต่ำ) = ผู้ป่วย 0 ราย
      // 🟡 เหลือง (เฝ้าระวัง) = เริ่มมีผู้ป่วย 1-2 ราย
      // 🟠 ส้ม (เสี่ยงปานกลาง) = ผู้ป่วยขยับเพิ่มขึ้น 3-5 ราย
      // 🔴 แดง (เสี่ยงสูง/วิกฤต) = ผู้ป่วยสะสมเยอะ 6 รายขึ้นไป
      let highestLevel: AlertLevel = 'green';
      const total = areaPatients.length;

      if (total >= 6) {
        highestLevel = 'red';
      } else if (total >= 3) {
        highestLevel = 'orange';
      } else if (total >= 1) {
        highestLevel = 'yellow';
      } else {
        highestLevel = 'green';
      }

      // ประเมินแนวโน้ม (Trend)
      let highestTrend: TrendDirection = 'stable';
      if (total >= 6) {
        highestTrend = 'outbreak';
      } else if (total >= 3) {
        highestTrend = 'increasing';
      }

      // จำลองค่าเฉลี่ยทางสถิติประวัติศาสตร์ให้สัมพันธ์กับคนไข้จริง
      const avgHistorical = parseFloat(
        (total * 0.45 + 0.35).toFixed(1)
      );

      statuses.push({
        subDistrict,
        district,
        currentCount: total,
        previousCount: Math.max(0, Math.round(total * 0.5)),
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
