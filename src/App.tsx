/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, AreaStatus, AreaResource, DispatchCommand, DiseaseCategory, PredictiveAlert } from './types';
import { 
  DISEASE_CATEGORIES, 
  INITIAL_PATIENTS, 
  INITIAL_RESOURCES, 
  INITIAL_COMMANDS 
} from './data/satunData';
import { 
  recalculateAreaStatuses, 
  generatePredictiveAlerts 
} from './utils/calculations';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import DataEntryForm from './components/DataEntryForm';
import AdminPanel from './components/AdminPanel';
import { GoogleSheetsSync } from './components/GoogleSheetsSync';
import { 
  ShieldAlert, ShieldCheck, HeartPulse, LogIn, Users, Sliders, 
  Activity, Bell, BookOpen, Download, HardDrive, Info, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // --- ระบบบันทึกสะสมและซิงก์ในเครื่องเพื่อประสิทธิภาพสูงสุด (Local Storage Persistence) ---
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('satun_patients');
    return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
  });

  const [categories, setCategories] = useState<DiseaseCategory[]>(() => {
    const saved = localStorage.getItem('satun_categories');
    if (saved) {
      try {
        const parsed: DiseaseCategory[] = JSON.parse(saved);
        const requiredCodes = ['B08.4', 'J06.9', 'A90', 'B010', 'CV-19', 'H-10'];
        const hasAll = requiredCodes.every(code => parsed.some(c => c.code.toUpperCase() === code.toUpperCase()));
        const hasExtraOrOld = parsed.some(c => !requiredCodes.includes(c.code.toUpperCase()));
        if (hasAll && !hasExtraOrOld) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    localStorage.setItem('satun_categories', JSON.stringify(DISEASE_CATEGORIES));
    return DISEASE_CATEGORIES;
  });

  const [resources, setResources] = useState<AreaResource[]>(() => {
    const saved = localStorage.getItem('satun_resources');
    return saved ? JSON.parse(saved) : INITIAL_RESOURCES;
  });

  const [commands, setCommands] = useState<DispatchCommand[]>(() => {
    const saved = localStorage.getItem('satun_commands');
    return saved ? JSON.parse(saved) : INITIAL_COMMANDS;
  });

  const [authenticatedRole, setAuthenticatedRole] = useState<string | null>(() => {
    return localStorage.getItem('satun_active_role') || null;
  });

  const [authenticatedName, setAuthenticatedName] = useState<string | null>(() => {
    return localStorage.getItem('satun_active_name') || null;
  });

  // --- ระบบเครือข่ายชื่อและรหัสผ่านจาก Google Sheets ทั้ง 3 ชีตหลัก ---
  const [liveCredentials, setLiveCredentials] = useState<{
    it_provincial: { id: string; name: string; pass: string }[];
    executive: { id: string; name: string; pass: string }[];
    hospital_staff: { id: string; name: string; pass: string }[];
  }>({
    it_provincial: [
      { id: '1112', name: 'พี่ตาม', pass: 'ssj112' },
      { id: '1113', name: 'พี่่หมู', pass: 'ssj113' },
      { id: '1114', name: 'พี่สกาย', pass: 'ssj114' },
      { id: '1115', name: 'พี่ต้า', pass: 'ssj115' }
    ],
    executive: [
      { id: '1234', name: 'นายเอ', pass: 'AA1234' },
      { id: '1235', name: 'นายบี', pass: 'AA1235' },
      { id: '1236', name: 'นายซี', pass: 'AA1236' },
      { id: '1237', name: 'นายดี', pass: 'AA1237' }
    ],
    hospital_staff: [
      { id: '1212', name: 'นายหนึ่ง', pass: 'B1212' },
      { id: '1213', name: 'นายสอง', pass: 'B1213' },
      { id: '1214', name: 'นายสาม', pass: 'B1214' },
      { id: '1215', name: 'นายสี่', pass: 'B1215' }
    ]
  });

  const [syncCredsStatus, setSyncCredsStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState<'it_provincial' | 'executive' | 'hospital_staff'>('it_provincial');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showCredentialsHint, setShowCredentialsHint] = useState(false);

  // --- ทรัพยากรระบบประสานงานคลาวด์ Google Sheets ---
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return localStorage.getItem('google_sheets_access_token');
  });
  const [appsScriptUrl, setAppsScriptUrl] = useState<string | null>(() => {
    return localStorage.getItem('google_apps_script_url') || 'https://script.google.com/macros/s/AKfycbwTzIT8AP8UJfwQ_WnSUc3S8J_ZVsRVRclwaGn8wQQW8D-WAN63nRdMVhJJgGLRUDLIEQ/exec';
  });
  const [syncLogs, setSyncLogs] = useState<{ id: string; time: string; type: 'success' | 'error' | 'info'; msg: string }[]>([]);

  // ตรวจจับ hash สำเร็จลุล่วงจาก OAuth Google Sheets
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('google_sheets_access_token', token);
        setGoogleToken(token);
        // เคลียร์เศษ hash ของ URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setTimeout(() => {
          triggerNotification('เชื่อมต่อ Google Sheets คลาวด์สำเร็จ! ระบบจะซิงก์ข้อมูลไปที่ Sheet 5 & 7 แล้ว');
        }, 800);
      }
    }
  }, []);

  const addSyncLog = (type: 'success' | 'error' | 'info', msg: string) => {
    const nowLocalStr = new Date().toLocaleTimeString('th-TH');
    setSyncLogs(prev => [
      { id: Date.now().toString() + Math.random().toString().slice(-3), time: nowLocalStr, type, msg },
      ...prev
    ]);
  };

  const getResolvedSheetName = async (token: string, requestedSheet: string): Promise<string> => {
    const spreadsheetId = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
    try {
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const meta = await res.json();
        if (meta.sheets && meta.sheets.length > 0) {
          // Check if the requested sheet name exists exactly
          const exactMatch = meta.sheets.find((s: any) => s.properties.title === requestedSheet);
          if (exactMatch) {
            return exactMatch.properties.title;
          }

          // Otherwise, fallbacks
          if (requestedSheet === 'Sheet5') {
            // Patient Form writes to Sheet5, but if it doesn't exist, use the first tab matching sheetId === 0 or index 0
            const gidZero = meta.sheets.find((s: any) => s.properties.sheetId === 0);
            if (gidZero) {
              return gidZero.properties.title;
            }
            return meta.sheets[0].properties.title;
          } else if (requestedSheet === 'Sheet7') {
            // Command logs write to Sheet7, but if it doesn't exist, use the second sheet or fall back to the first sheet
            if (meta.sheets.length > 1) {
              return meta.sheets[1].properties.title;
            }
            return meta.sheets[0].properties.title;
          }
          
          // Return the first sheet title if nothing else matched
          return meta.sheets[0].properties.title;
        }
      }
    } catch (e) {
      console.error('Error in getResolvedSheetName:', e);
    }
    // Hard fallback if request fails or has issues
    return requestedSheet;
  };

  const appendToGoogleSheet = async (sheetName: string, rowValues: any[]) => {
    const tokenToUse = googleToken || localStorage.getItem('google_sheets_access_token');
    const appsScriptUrlToUse = appsScriptUrl || localStorage.getItem('google_apps_script_url');

    // Prioritize or combine with Google Apps Script Web App sync
    if (appsScriptUrlToUse) {
      try {
        addSyncLog('info', `กำลังส่งระเบียบข้อมูลไปยัง Google Apps Script Web App [${sheetName}]...`);
        await fetch(appsScriptUrlToUse, {
          method: 'POST',
          mode: 'no-cors', // standard for Apps Script to prevent OPTIONS preflight failures
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'appendRow',
            sheetName: sheetName,
            row: rowValues,
            values: [rowValues]
          })
        });
        addSyncLog('success', `✓ สำเร็จ! ซิงก์เรียลไทม์ผ่าน Google Apps Script Web App เข้าสู่ ${sheetName} แล้ว`);
        return true;
      } catch (e: any) {
        console.error('Apps Script Sync Error', e);
        addSyncLog('error', `✗ พยายามซิงก์ทาง Apps Script ล้มเหลว: ${e.message}`);
        if (!tokenToUse) return false;
      }
    }

    if (!tokenToUse) {
      addSyncLog('info', `ออฟไลน์: บันทึกข้อมูลเข้าหน่วยความจำบราวเซอร์แล้ว (ยังไม่ได้เชื่อม Google Sheets: ${sheetName})`);
      return false;
    }

    const spreadsheetId = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
    const resolvedName = await getResolvedSheetName(tokenToUse, sheetName);
    const range = encodeURIComponent(resolvedName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    try {
      addSyncLog('info', `กำลังส่งข้อมูลไปคลาวด์ ${resolvedName}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: resolvedName,
          majorDimension: 'ROWS',
          values: [rowValues]
        })
      });

      if (res.ok) {
        addSyncLog('success', `✓ สำเร็จ! ซิงก์ 1 แถวข้อมูลเข้าสู่ ${resolvedName} สำเร็จแล้ว`);
        return true;
      } else {
        const err = await res.json();
        console.error('Sheets append error', err);
        addSyncLog('error', `✗ ปฏิเสธสิทธิ์: เซิร์ฟเวอร์ฟีดแบคสิทธิ์ผิดพลาด (${err.error?.message || res.statusText})`);
        return false;
      }
    } catch (e: any) {
      console.error('Network error during Sheets sync', e);
      addSyncLog('error', `✗ ผิดพลาด: เชื่อมต่อคลาวด์ไม่ได้ (เครือข่ายขัดข้อง)`);
      return false;
    }
  };

  const appendRowsToGoogleSheet = async (sheetName: string, rowsValues: any[][]) => {
    const tokenToUse = googleToken || localStorage.getItem('google_sheets_access_token');
    const appsScriptUrlToUse = appsScriptUrl || localStorage.getItem('google_apps_script_url');

    if (appsScriptUrlToUse) {
      try {
        addSyncLog('info', `กำลังซิงก์ข้อมูลแบบกลุ่ม (${rowsValues.length} ราย) ผ่าน Google Apps Script Web App...`);
        await fetch(appsScriptUrlToUse, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: 'appendRow',
            sheetName: sheetName,
            values: rowsValues
          })
        });
        addSyncLog('success', `✓ สำเร็จ! นำเข้าข้อมูลแบบกลุ่มผ่าน Google Apps Script Web App เรียบร้อยแล้ว`);
        return true;
      } catch (e: any) {
        console.error('Apps Script bulk sync error', e);
        addSyncLog('error', `✗ พยายามนำเข้าแบบกลุ่มผ่าน Apps Script ล้มเหลว: ${e.message}`);
        if (!tokenToUse) return false;
      }
    }

    if (!tokenToUse) {
      addSyncLog('info', `ออฟไลน์: บันทึกกลุ่มผู้ป่วย ${rowsValues.length} คนเข้าส่วนหน่วยความจำแล้ว`);
      return false;
    }

    const spreadsheetId = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
    const resolvedName = await getResolvedSheetName(tokenToUse, sheetName);
    const range = encodeURIComponent(resolvedName);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    try {
      addSyncLog('info', `กำลังส่ง ${rowsValues.length} ผู้ป่วยไปที่คลาวด์ ${resolvedName}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: resolvedName,
          majorDimension: 'ROWS',
          values: rowsValues
        })
      });

      if (res.ok) {
        addSyncLog('success', `✓ สำเร็จ! นำเข้า ${rowsValues.length} แถวเข้าสู่ ${resolvedName} บน Google Sheets คลาวด์สำเร็จ`);
        return true;
      } else {
        const err = await res.json();
        addSyncLog('error', `✗ ล้มเหลว: ปฏิเสธการบันทึกแบบกลุ่ม (${err.error?.message || res.statusText})`);
        return false;
      }
    } catch (e: any) {
      addSyncLog('error', `✗ ผิดพลาด: เชื่อมต่อคลาวด์แบบกลุ่มไม่ได้`);
      return false;
    }
  };

  // ดึงรหัสผ่านเรียลไทม์จากระบบประสานงานคลาวด์ Google Sheets โรงพยาบาลปฐมภูมิสตูล
  useEffect(() => {
    const fetchLiveCredentials = async () => {
      setSyncCredsStatus('syncing');

      const scriptUrlToUse = appsScriptUrl || localStorage.getItem('google_apps_script_url') || 'https://script.google.com/macros/s/AKfycbwTzIT8AP8UJfwQ_WnSUc3S8J_ZVsRVRclwaGn8wQQW8D-WAN63nRdMVhJJgGLRUDLIEQ/exec';
      if (scriptUrlToUse) {
        try {
          const scriptRes = await fetch(`${scriptUrlToUse}?action=getCredentials`);
          if (scriptRes.ok) {
            const data = await scriptRes.json();
            if (data && data.status === "success" && (data.it_provincial || data.executive || data.hospital_staff)) {
              setLiveCredentials({
                it_provincial: data.it_provincial || [],
                executive: data.executive || [],
                hospital_staff: data.hospital_staff || []
              });
              setSyncCredsStatus('success');
              addSyncLog('success', '✓ ดึงข้อมูลบัญชีผู้ใช้ระบบและเครือข่ายความมั่นคงจาก Google Apps Script สำเร็จแล้ว');
              return;
            }
          }
        } catch (e) {
          console.log("Apps Script live credentials query failed. Trying CSV fallback...", e);
        }
      }

      try {
        const spreadsheetId = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
        
        // 1. เจ้าหน้าที่ IT สสจ.สตูล (Sheet 2) - GID 2064021083
        const itRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=2064021083`);
        // 2. ผู้บริหาร/เจ้าหน้าที่ควบคุมโรค (Sheet 3) - GID 174194219
        const execRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=174194219`);
        // 3. เจ้าหน้าที่รพ. (Sheet 4) - GID 934005991
        const hospRes = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=934005991`);

        const parsedIt: { id: string; name: string; pass: string }[] = [];
        const parsedExec: { id: string; name: string; pass: string }[] = [];
        const parsedHosp: { id: string; name: string; pass: string }[] = [];

        if (itRes.ok) {
          const text = await itRes.text();
          const lines = text.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 3) {
              parsedIt.push({ id: cols[0], name: cols[1], pass: cols[2] });
            }
          }
        }

        if (execRes.ok) {
          const text = await execRes.text();
          const lines = text.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 3) {
              parsedExec.push({ id: cols[0], name: cols[1], pass: cols[2] });
            }
          }
        }

        if (hospRes.ok) {
          const text = await hospRes.text();
          const lines = text.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 3) {
              parsedHosp.push({ id: cols[0], name: cols[1], pass: cols[2] });
            }
          }
        }

        setLiveCredentials({
          it_provincial: parsedIt.length > 0 ? parsedIt : liveCredentials.it_provincial,
          executive: parsedExec.length > 0 ? parsedExec : liveCredentials.executive,
          hospital_staff: parsedHosp.length > 0 ? parsedHosp : liveCredentials.hospital_staff
        });
        setSyncCredsStatus('success');
      } catch (e) {
        console.error('Failed to sync live credentials:', e);
        setSyncCredsStatus('error');
      }
    };

    fetchLiveCredentials();
  }, [appsScriptUrl]);

  // สำหรับการแจ้งเตือน Real-time ที่จะประเมินผลคำนวณแบบสัปดาห์ต่อสัปดาห์
  const [areaStatuses, setAreaStatuses] = useState<AreaStatus[]>([]);
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // ซิงก์ข้อมูลเมื่อมีการอัปเดตสถานะผู้ป่วย
  useEffect(() => {
    localStorage.setItem('satun_patients', JSON.stringify(patients));
    
    // ตรวจสอบและประมวลผลความเสี่ยงเฉลี่ยและแนวโน้มแบบทันท่วงที
    const computedStatuses = recalculateAreaStatuses(patients, categories);
    const computedAlerts = generatePredictiveAlerts(patients, categories);
    
    setAreaStatuses(computedStatuses);
    setAlerts(computedAlerts);
  }, [patients, categories]);

  // ซิงก์หมวดกฎการจัดเก็บอื่น ๆ
  useEffect(() => {
    localStorage.setItem('satun_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('satun_resources', JSON.stringify(resources));
  }, [resources]);

  useEffect(() => {
    localStorage.setItem('satun_commands', JSON.stringify(commands));
  }, [commands]);

  // ซิงก์บทบาทปัจจุบัน
  useEffect(() => {
    if (authenticatedRole) {
      localStorage.setItem('satun_active_role', authenticatedRole);
    } else {
      localStorage.removeItem('satun_active_role');
    }
  }, [authenticatedRole]);

  useEffect(() => {
    if (authenticatedName) {
      localStorage.setItem('satun_active_name', authenticatedName);
    } else {
      localStorage.removeItem('satun_active_name');
    }
  }, [authenticatedName]);

  // แสดง Toast แจ้งภัยแบบพลันเมื่อเกิดความเสี่ยงระดับสีแดงใหม่ขึ้น
  const triggerNotification = (message: string) => {
    setToastMessage(message);
    setShowNotificationToast(true);
    setTimeout(() => {
      setShowNotificationToast(false);
    }, 5000);
  };

  // --- ฟังก์ชันช่วยเหลือควบคุมข้อมูลกลาง ---
  
  // Mapping helpers สำหรับการเซฟลง Google Sheets
  const mapPatientToSheetRow = (p: Patient) => {
    return [
      p.cidEncrypted || '', 
      `${p.diseaseCode} - ${p.diseaseName}`, 
      `${p.village || ''}, ต.${p.subDistrict || ''}, อ.${p.district || ''}`, 
      p.onsetEmanationDate || '', 
      'ปกติ'
    ];
  };

  const mapCommandToSheetRow = (cmd: DispatchCommand) => {
    const abate = cmd.items.find(i => i.name.includes('ทราย'))?.quantity || 0;
    const chemical = cmd.items.find(i => i.name.includes('สารเคมี'))?.quantity || 0;
    const staff = cmd.items.find(i => i.name.includes('เจ้าหน้าที่') || i.name.includes('แพทย์'))?.quantity || 0;
    const urgencyName = cmd.urgency === 'critical' ? 'ด่วนที่สุด' : cmd.urgency === 'high' ? 'ด่วนมาก' : 'ด่วน';

    return [
      cmd.commandTitle || '',
      `${cmd.senderName} (${cmd.senderRole})`,
      urgencyName,
      abate,
      chemical,
      staff,
      cmd.instructions || ''
    ];
  };

  // 1. เพิ่มผู้ป่วยสอบสวนโรค
  const handleAddPatient = (p: Patient) => {
    setPatients(prev => [p, ...prev]);
    // ส่งข้อความความถี่แจ้งเตือนทันที
    triggerNotification(`พบกรณีลงทะเบียนผู้ป่วยใหม่: ${p.diseaseName.split(' ')[0]} ต.${p.subDistrict}`);
    // ซิงก์ลง Google Sheets (Sheet5) อัตโนมัติ
    appendToGoogleSheet('Sheet5', mapPatientToSheetRow(p));
  };

  // 2. นำเข้าแบบกลุ่ม (CSV)
  const handleBulkAddPatients = (pList: Patient[]) => {
    setPatients(prev => [...pList, ...prev]);
    triggerNotification(`นำเข้าผู้ป่วยใหม่แบบกลุ่มจำนวน ${pList.length} คนผ่านระบบคำนวณอัตโนมัติสำเร็จ`);
    // ซิงก์ลง Google Sheets (Sheet5) อัตโนมัติแบบกลุ่ม
    appendRowsToGoogleSheet('Sheet5', pList.map(mapPatientToSheetRow));
  };

  // 2.1 แทนที่คลังข้อมูล (เช่น ซิงก์ Google Sheets)
  const handleReplacePatients = (pList: Patient[]) => {
    setPatients(pList);
    triggerNotification(`เชื่อมโยงคลังข้อมูลใหม่ ทดแทนประวัติเดิมด้วยข้อมูล Google Sheets จำนวน ${pList.length} รายสำเร็จ`);
  };

  // 3. ปรับเกณฑ์ดักโรค
  const handleUpdateCategoryThresholds = (code: string, yellow: number, red: number) => {
    setCategories(prev => prev.map(cat => {
      if (cat.code === code) {
        return { ...cat, thresholdYellow: yellow, thresholdRed: red };
      }
      return cat;
    }));
    triggerNotification(`ปรับข้อกำหนดเกณฑ์ทริกเกอร์กลุ่มโรค ${code} สำเร็จ แผงระเบียงคำนวณเสร็จสิ้นด่วน`);
  };

  // 4. บันทึกคำสั่งกระจายทุน
  const handleAddCommand = (cmd: DispatchCommand) => {
    setCommands(prev => [cmd, ...prev]);
    triggerNotification(`บันทึกบัตรคำสั่งกระจายสิ่งของและทีมฉุกเฉิน ID ${cmd.id} สู่ รพ.สต.${cmd.targetSubDistrict} แล้ว`);
    // ซิงก์ลง Google Sheets (Sheet7) อัตโนมัติ
    appendToGoogleSheet('Sheet7', mapCommandToSheetRow(cmd));
  };

  // 5. ปรับอัปเดตอุปวรรคและทรัพยากรชุมชนรายพื้นที่
  const handleUpdateResource = (subDistrict: string, district: string, updatedFields: Partial<AreaResource>) => {
    setResources(prev => prev.map(r => {
      if (r.subDistrict === subDistrict && r.district === district) {
        return { ...r, ...updatedFields, lastUpdated: new Date().toISOString().split('T')[0] };
      }
      return r;
    }));
  };

  // 6. เคลียร์รับทราบกล่องแจ้งเตือนพื้นที่เสี่ยงภัย
  const handleResolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id === id) {
        return { ...a, resolved: true };
      }
      return a;
    }));
  };

  // 7. เคลียร์ผู้ป่วยเพื่อทดสอบใหม่หมดจด
  const handleClearPatients = () => {
    setPatients([]);
    setCommands([]);
    triggerNotification('ล้างฐานเก็บสะสมเดิมทั้งหมดเรียบร้อยแล้ว');
  };

  // 8. ย้อนค่าโรงงาน สสจ.ลพบุรีต้นทาง
  const handleRestoreDefaults = () => {
    localStorage.removeItem('satun_patients');
    localStorage.removeItem('satun_categories');
    localStorage.removeItem('satun_resources');
    localStorage.removeItem('satun_commands');
    setPatients(INITIAL_PATIENTS);
    setCategories(DISEASE_CATEGORIES);
    setResources(INITIAL_RESOURCES);
    setCommands(INITIAL_COMMANDS);
    triggerNotification('ย้อนคืนสิทธิ์ฐานข้อมูลโรงงานจังหวัดสตูลเรียบร้อยแล้ว');
  };

  // จัดการการส่งข้อมูลฟอร์มยืนยันตัวตน
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const credentialList = liveCredentials[loginRole];
    const foundUser = credentialList.find(
      u => u.id.trim() === loginId.trim() && u.pass.trim() === loginPassword.trim()
    );

    if (foundUser) {
      setAuthenticatedRole(loginRole);
      setAuthenticatedName(foundUser.name);
      triggerNotification(`เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ ${foundUser.name}`);
      setLoginId('');
      setLoginPassword('');
    } else {
      setLoginError('รหัสประจำตัว หรือ รหัสเข้าสู่ระบบไม่ถูกต้องสำหรับบทบาทที่เลือก กรุณาตรวจสอบอีกครั้ง');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white antialiased flex flex-col">
      
      {/* เอฟเฟกต์ Toaster แจ้งเตือนกระพริบเมื่อมีข้อมูลเปลี่ยนสะพัด */}
      <AnimatePresence>
        {showNotificationToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-55%', scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 z-55 w-full max-w-sm shrink-0 p-4 bg-slate-900 text-white rounded-2xl border border-indigo-500/30 flex items-center gap-3.5 shadow-2xl"
          >
            <span className="p-1 px-2.5 rounded-lg bg-indigo-505 bg-indigo-500 text-white font-black text-xs animate-pulse font-mono">
              EVENT
            </span>
            <div className="text-xs font-semibold leading-relaxed flex-1">
              {toastMessage}
            </div>
            <button 
              onClick={() => setShowNotificationToast(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ส่วนล็อกอินคัดบทบาทหน้าแรก (Login Screen Block) --- */}
      <AnimatePresence mode="wait">
        {!authenticatedRole ? (
          <motion.div
            key="login-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950"
          >
            {/* วงกลมสแกนเรเดียนด้านเบื้องหลัง */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-lg relative z-10 bg-white/5 backdrop-blur-md rounded-3xl p-6 md:p-8 border border-white/10 space-y-6 text-white shadow-2xl">
              
              <div className="space-y-2 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg">
                  <HeartPulse className="w-7 h-7 animate-pulse" />
                </div>
                <h1 className="text-xl font-black tracking-tight pt-1">
                  ศูนย์ปฏิบัติการเฝ้าระวังภัยโรคระบาด สสจ.สตูล
                </h1>
                <p className="text-xs text-indigo-200/80 leading-relaxed font-sans font-medium px-4">
                  กรุณาลงชื่อเข้าใช้ด้วยรหัสประจำตัวและรหัสผ่านที่ประสานร่วมกับฐานข้อมูล Google Sheets
                </p>

                {/* แสดงสถานะการซิงค์รหัสผ่านจากต้นทาง */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/50 border border-white/5 text-[10px] text-indigo-300 font-mono">
                  {syncCredsStatus === 'syncing' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      กำลังรีโหลดข้อมูลรหัสผ่านเชิงรับ (Sheet 2, 3, 4)...
                    </>
                  ) : syncCredsStatus === 'success' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      เชื่อมโยงสิทธิ์ Google Sheets สำเร็จแบบ Live
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      สลับสิทธิ์โปรไฟล์สำรองภายในระบบสำเร็จ
                    </>
                  )}
                </div>
              </div>

              {/* แท็บตัวเลือกบทบาทการเข้าถึง เพื่อให้ป้อนและหาจับคู่ถูกต้อง */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('it_provincial');
                    setLoginError(null);
                  }}
                  className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    loginRole === 'it_provincial'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  ⚙️ IT สสจ.
                  <span className="block text-[8.5px] opacity-75 font-normal">Sheet 2</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('executive');
                    setLoginError(null);
                  }}
                  className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    loginRole === 'executive'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  🛡️ ผู้บริหาร
                  <span className="block text-[8.5px] opacity-75 font-normal">Sheet 3</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('hospital_staff');
                    setLoginError(null);
                  }}
                  className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    loginRole === 'hospital_staff'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  🏥 รพ./รพ.สต.
                  <span className="block text-[8.5px] opacity-75 font-normal">Sheet 4</span>
                </button>
              </div>

              {/* ฟอร์มกรอกเอกลักษณ์และรหัสความมั่นคง */}
              <form onSubmit={handleLoginSubmit} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-indigo-200 flex items-center gap-1">
                    รหัสประจำตัวผู้ใช้งาน (ID Number)
                  </label>
                  <input
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={
                      loginRole === 'it_provincial' ? "เช่น 1112" :
                      loginRole === 'executive' ? "เช่น 1234" : "เช่น 1212"
                    }
                    className="w-full px-4 py-3 bg-slate-950/75 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-indigo-200 flex items-center gap-1">
                    รหัสเข้าสู่ระบบ (System Password)
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={
                      loginRole === 'it_provincial' ? "ใส่รหัสเข้าสู่ระบบ เช่น ssj112" :
                      loginRole === 'executive' ? "ใส่รหัสเข้าสู่ระบบ เช่น AA1234" : "ใส่รหัสเข้าสู่ระบบ เช่น B1212"
                    }
                    className="w-full px-4 py-3 bg-slate-950/75 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-xs text-white font-mono"
                  />
                </div>

                {loginError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-950/60 border border-red-500/30 text-red-200 rounded-xl text-xs text-left"
                  >
                    ⚠️ {loginError}
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  เข้าสู่พอร์ทัลความปลอดภัย (Secure Sign In)
                </button>
              </form>

              {/* ส่วนสับด่านแนะนำรหัสผ่านทดสอบเพื่อให้ส่องและทดสอบได้สะดวก */}
              <div className="border-t border-white/5 pt-4 space-y-2 text-left">
                <button
                  type="button"
                  onClick={() => setShowCredentialsHint(!showCredentialsHint)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center justify-between w-full cursor-pointer bg-white/5 p-2 px-3 rounded-lg border border-white/5 transition-colors"
                >
                  <span>💡 ปิ๊งแนะแนว: บัญชีทดสอบที่ดึงรายงานจริงจัง ({liveCredentials[loginRole].length} รายชื่อ)</span>
                  <span>{showCredentialsHint ? '▲ ปิดคำแนะนำ' : '▼ คลี่ดูรายชื่อและรหัสผ่าน'}</span>
                </button>

                <AnimatePresence>
                  {showCredentialsHint && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden bg-slate-950/50 rounded-xl border border-white/5 p-3 space-y-2 text-[10.5px] leading-relaxed font-mono"
                    >
                      <p className="text-slate-400 border-b border-white/5 pb-1 mb-1 font-sans text-[10px] font-bold">
                        📋 บัญชีผู้ใช้ที่แมตชิ่งตรงกับชีต {loginRole === 'it_provincial' ? '2 (เจ้าหน้าที่ IT สสจ.)' : loginRole === 'executive' ? '3 (ผู้บริหาร/คุมโรค)' : '4 (เจ้าหน้าที่ รพ.)'}:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {liveCredentials[loginRole].map((u, ui) => (
                          <div 
                            key={ui} 
                            onClick={() => {
                              setLoginId(u.id);
                              setLoginPassword(u.pass);
                              triggerNotification(`หยิบโปรไฟล์ ${u.name} มากรอกให้ฟรีแล้วครับ`);
                            }}
                            className="bg-white/5 p-1.5 px-2.5 rounded-lg border border-white/5 hover:border-indigo-500/50 hover:bg-indigo-550/10 cursor-pointer transition-all flex flex-col justify-between"
                          >
                            <span className="text-white font-black truncate">👤 {u.name}</span>
                            <span className="text-slate-400 text-[10px] pt-0.5">
                              ID: <strong className="text-indigo-300">{u.id}</strong> Pass: <strong className="text-emerald-300">{u.pass}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="text-[9.5px] text-indigo-300/60 text-center flex items-center justify-center gap-1.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                ระบบประเมินความปลอดภัยร่วมกับ สขร.สตูล (Satun Public Health PHEOC)
              </div>
            </div>

          </motion.div>
        ) : (
          
          /* --- พอร์ทัลระบบควบคุมโรคปฏิบัติการ (Main Active Portal View) --- */
          <motion.div
            key="portal-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col"
          >
            {/* บาร์หัวข้อขนาดของ สสจ (Portal Hub Header) */}
            <header className="bg-indigo-950 text-white border-b border-indigo-900 sticky top-0 z-40 shadow-md">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500 text-white rounded-xl">
                    <HeartPulse className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-xs sm:text-sm font-black tracking-tight leading-tight">
                      ศูนย์ควบคุมและควบคุมโรคระบาด จังหวัดสตูล
                    </h1>
                    <p className="text-[9.5px] text-indigo-300/90 font-mono hidden sm:block font-medium">
                      Satun Epidemic Surveillance and Emergency Despatch system
                    </p>
                  </div>
                </div>

                {/* ป้ายแสดงสถานะตำแหน่งการเข้าใช้ที่ถูกล็อกเฉพาะรอบนี้ (ล็อกตำแหน่ง ห้ามเปลี่ยนแบบ On-the-fly) */}
                <div className="flex items-center gap-3">
                  
                  <div className="bg-indigo-900/60 border border-indigo-800/60 p-1.5 px-3 rounded-xl text-xs font-bold text-indigo-100 flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="opacity-80">สิทธิ์เข้าถึง:</span>
                    <span className="text-white">
                      {authenticatedRole === 'it_provincial' && '⚙️ เจ้าหน้าที่ IT สสจ.สตูล'}
                      {authenticatedRole === 'executive' && '🛡️ ผู้บริหาร / คุมโรค'}
                      {authenticatedRole === 'hospital_staff' && '🏥 เจ้าหน้าที่ รพ./รพ.สต.'}
                    </span>
                  </div>

                  <span className="w-px h-6 bg-indigo-900" />

                  {/* ชื่อผู้ใช้และปุ่มออกระบบ */}
                  <div className="flex items-center gap-2">
                    {authenticatedName && (
                      <span className="hidden sm:inline-block text-[11px] text-indigo-200 font-bold bg-indigo-900/60 p-1 px-2.5 rounded-lg border border-indigo-800/30">
                        👤 {authenticatedName}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setAuthenticatedRole(null);
                        setAuthenticatedName(null);
                      }}
                      className="p-1 px-2.5 hover:bg-white/10 text-indigo-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-indigo-800/40 bg-indigo-900/20"
                      title="กลับไปเลือกบทบาทความปลอดภัยใหม่"
                    >
                      ออกระบบ
                    </button>
                  </div>

                </div>

              </div>
            </header>

            {/* ส่วนแสดงแท็บเนื้อหาหลัก (Main Screen Workspace) */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              
              {/* บอร์ดแสดงเบี้ยบทบาทปัจจุบัน */}
              <div className="bg-white p-4 rounded-2xl border border-indigo-50/50 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/20 to-white">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
                    {authenticatedRole === 'it_provincial' ? <Sliders className="w-4 h-4" /> :
                     authenticatedRole === 'hospital_staff' ? <Users className="w-4 h-4" /> :
                     <Activity className="w-4 h-4" />}
                  </span>
                  <div>
                    <h2 className="text-xs font-black text-slate-900">
                      พอร์ทัลใช้งานบทบาท:{' '}
                      <span className="text-indigo-700 font-extrabold underline decoration-dashed decor-2 offset-2">
                        {authenticatedRole === 'it_provincial' && 'เจ้าหน้าที่ IT ของ สสจ. (ผู้ดูแลระบบ)'}
                        {authenticatedRole === 'hospital_staff' && 'เจ้าหน้าที่ IT รพ. / บันทึกคัดกรองผู้ป่วย'}
                        {authenticatedRole === 'executive' && 'ผู้บริหาร - เจ้าหน้าที่ควบคุมโรคของ สสจ.'}
                      </span>
                      {authenticatedName && <span className="text-indigo-600 font-black ml-2 text-xs bg-indigo-50/70 p-1 px-2 rounded-md border border-indigo-100/50">👤 {authenticatedName}</span>}
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {authenticatedRole === 'it_provincial' && 'สามารถทดลองลอบเปลี่ยนขีดขีดสถานะสีแดง เพื่อดูแผนที่สลับสี หรือล้างสถิติเพื่อป้อนตรวจงานใหม่'}
                      {authenticatedRole === 'hospital_staff' && 'บันทึกคนไข้เป็นรายบุคคลเสมือนจริง หรือสอบไฟล์ CSV (ดาวน์โหลดสเป็กชีตได้ฟรีจากระบบสับไฟล์)'}
                      {authenticatedRole === 'executive' && 'ตรวจคะเนจุดความร้อน สังเกตผู้ป่วยช่วงป่องค่าย คัดเลือกภัยเสี่ยง และกดใบส่งของมอบ รพ.สต.'}
                    </p>
                  </div>
                </div>

                <div className="text-[10.5px] text-indigo-650 bg-indigo-50/70 p-1.5 px-3 rounded-xl border border-indigo-100 font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                  <Activity className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  เครือข่ายความมั่นคงทางสาธารณสุขจังหวัดสตูล
                </div>
              </div>

              {/* ส่วนแสดงสถิติประมวลและซิงก์ Google Sheets */}
              <GoogleSheetsSync
                token={googleToken}
                onTokenChange={setGoogleToken}
                appsScriptUrl={appsScriptUrl}
                onAppsScriptUrlChange={setAppsScriptUrl}
                syncLogs={syncLogs}
                onClearLogs={() => setSyncLogs([])}
              />

              {/* ยัดแยก Component ตามยูนิตและโรล */}
              {authenticatedRole === 'executive' && (
                <ExecutiveDashboard
                  patients={patients}
                  areaStatuses={areaStatuses}
                  resources={resources}
                  commands={commands}
                  alerts={alerts}
                  onAddCommand={handleAddCommand}
                  onUpdateResource={handleUpdateResource}
                  onResolveAlert={handleResolveAlert}
                />
              )}

              {authenticatedRole === 'hospital_staff' && (
                <DataEntryForm
                  categories={categories}
                  patients={patients}
                  onAddPatient={handleAddPatient}
                  onBulkAddPatients={handleBulkAddPatients}
                  onReplacePatients={handleReplacePatients}
                />
              )}

              {authenticatedRole === 'it_provincial' && (
                <AdminPanel
                  categories={categories}
                  patients={patients}
                  areaStatuses={areaStatuses}
                  onUpdateCategoryThresholds={handleUpdateCategoryThresholds}
                  onClearPatients={handleClearPatients}
                  onRestoreDefaults={handleRestoreDefaults}
                />
              )}

            </main>

            {/* ส่วนท้ายแสดงข้อมูลมาตรฐาน (Portal Footer) */}
            <footer className="bg-slate-900 text-slate-400 text-[11px] py-6 border-t border-slate-800 text-center font-sans space-y-1 mt-auto">
              <p className="font-bold text-slate-355 text-slate-300">ศูนย์ประสานปฏิบัติการควบคุมโรค PHEOC สาธารณสุขจังหวัดสตูล</p>
              <p>ระบบซิงก์ประเมินผลคาดคะเนแผนผังความเสี่ยงแบบเรียลไทม์ ปลอดภัยสิทธิด้วยการจัดเก็บ Local Database</p>
              <p className="text-[9.5px] text-slate-500 pt-1">
                การวิจัยและบันทึกผู้ป่วยถูกสมมติและเฝ้าระวังเพื่อการตอบรับแบบนัยสำคัญของพื้นที่ อ.ละงู, อ.เมืองสตูล, อ.ควนโดน และอื่น ๆ
              </p>
            </footer>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
