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
  INITIAL_COMMANDS,
  SATUN_GEOGRAPHY
} from './data/satunData';
import { 
  recalculateAreaStatuses, 
  generatePredictiveAlerts 
} from './utils/calculations';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import DataEntryForm from './components/DataEntryForm';
import AdminPanel from './components/AdminPanel';
import HeatmapView from './components/HeatmapView';
import { GoogleSheetsSync } from './components/GoogleSheetsSync';
import { 
  ShieldAlert, ShieldCheck, HeartPulse, LogIn, Users, Sliders, 
  Activity, Bell, BookOpen, Download, HardDrive, Info, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const safeParseJson = (text: string): any => {
  const trimmed = text.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.includes('<html') || trimmed.includes('ServiceLogin') || trimmed.includes('login') || trimmed.includes('DOCTYPE html')) {
    throw new Error('ระบบตรวจสอบพบหน้ากากลงชื่อเข้าใช้งาน (Authorization/Login HTML) จาก Google Workspace ยืนยันว่า Google Web App นี้ไม่ได้ตั้งสิทธิ์เข้าถึงเป็น "Anyone" (ทุกคนที่มีลิงก์) หรือยังไม่ได้ Deploy เป็นสาธารณะ');
  }
  return JSON.parse(text);
};

export default function App() {
  // --- ระบบบันทึกสะสมและซิงก์ในเครื่องเพื่อประสิทธิภาพสูงสุด (Local Storage Persistence) ---
  const [patients, setPatients] = useState<Patient[]>(() => {
    const isNewVersion = localStorage.getItem('satun_patients_version_v12');
    if (!isNewVersion) {
      localStorage.setItem('satun_patients_version_v12', 'true');
      localStorage.setItem('satun_patients', JSON.stringify(INITIAL_PATIENTS));
      return INITIAL_PATIENTS;
    }
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

  const [hasBackup, setHasBackup] = useState<boolean>(() => {
    return !!localStorage.getItem('satun_patients_backup');
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

  // --- สถานะการเข้าดูแแผนระบายความร้อนสาธารณะ (Heatmap Public mode) ---
  const [viewingHeatmapPublicly, setViewingHeatmapPublicly] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('view') === 'heatmap' || params.get('share') === 'heatmap';
    }
    return false;
  });

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
      const targetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const meta = safeParseJson(await res.text());
        if (meta.sheets && meta.sheets.length > 0) {
          // Check if the requested sheet name exists exactly
          const exactMatch = meta.sheets.find((s: any) => s.properties.title === requestedSheet);
          if (exactMatch) {
            return exactMatch.properties.title;
          }

          // Otherwise, fallbacks
          if (requestedSheet === 'Sheet1') {
            const thaiMatch1 = meta.sheets.find((s: any) => {
              const title = s.properties.title || '';
              return title.toLowerCase().includes('sheet1') || 
                     title.includes('ชีทที่ 1') || 
                     title.includes('ชีท 1') ||
                     title.includes('แผ่นงานที่ 1') ||
                     title.includes('แผ่นงาน 1');
            });
            if (thaiMatch1) {
              return thaiMatch1.properties.title;
            }
            return meta.sheets[0].properties.title;
          } else if (requestedSheet === 'Sheet5') {
            // Patient Form writes to Sheet5 (the 5th sheet / ชีทที่ 5).
            // Check if there is a sheet that has a related title.
            const thaiMatch5 = meta.sheets.find((s: any) => {
              const title = s.properties.title || '';
              return title.toLowerCase().includes('sheet5') || 
                     title.includes('ชีทที่ 5') || 
                     title.includes('ชีท 5') ||
                     title.includes('แผ่นงานที่ 5') ||
                     title.includes('แผ่นงาน 5');
            });
            if (thaiMatch5) {
              return thaiMatch5.properties.title;
            }
            if (meta.sheets.length >= 5) {
              return meta.sheets[4].properties.title;
            }
            const gidZero = meta.sheets.find((s: any) => s.properties.sheetId === 0);
            if (gidZero) {
              return gidZero.properties.title;
            }
            return meta.sheets[0].properties.title;
          } else if (requestedSheet === 'Sheet6') {
            // Map status logs write to Sheet6 (the 6th sheet / ชีทที่ 6)
            const specificMatch = meta.sheets.find((s: any) => s.properties.sheetId === 847706215);
            if (specificMatch) {
              return specificMatch.properties.title;
            }
            const thaiMatch6 = meta.sheets.find((s: any) => {
              const title = s.properties.title || '';
              return title.toLowerCase().includes('sheet6') || 
                     title.includes('ชีทที่ 6') || 
                     title.includes('ชีท 6') ||
                     title.includes('แผ่นงานที่ 6') ||
                     title.includes('แผ่นงาน 6');
            });
            if (thaiMatch6) {
              return thaiMatch6.properties.title;
            }
            if (meta.sheets.length >= 6) {
              return meta.sheets[5].properties.title;
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
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(appsScriptUrlToUse)}`;
        const scriptRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'appendRow',
            sheetName: sheetName,
            row: rowValues,
            values: [rowValues]
          })
        });

        if (scriptRes.ok) {
          const resData = safeParseJson(await scriptRes.text());
          if (resData.status === 'success' || resData.status === 'ok') {
            addSyncLog('success', `✓ สำเร็จ! ซิงก์เรียลไทม์ผ่าน Google Apps Script Web App เข้าสู่ ${sheetName} แล้ว: ${resData.message || 'เรียบร้อย'}`);
            return true;
          } else {
            console.warn('Apps Script returned non-success:', resData);
            addSyncLog('success', `✓ ส่งข้อมูลถึง Apps Script สำเร็จแล้ว (${resData.message || 'รอดำเนินการ'})`);
            return true;
          }
        } else {
          throw new Error(`เซิร์ฟเวอร์ตอบกลับผิกพลาด (HTTP ${scriptRes.status})`);
        }
      } catch (e: any) {
        console.error('Apps Script Sync Error', e);
        addSyncLog('error', `✗ พยายามซิงก์ทาง Apps Script ล้มเหลว (สลับเข้าโหมดสำรอง): ${e.message}`);
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
      addSyncLog('info', `กำลังส่งข้อมูลไปคลาวด์ ${resolvedName} (ผ่าน API Proxy)...`);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
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
        const err = safeParseJson(await res.text());
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
        addSyncLog('info', `กำลังส่งกลุ่มระเบียบข้อมูล (${rowsValues.length} ราย) ผ่าน Google Apps Script Web App...`);
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(appsScriptUrlToUse)}`;
        const scriptRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'appendRow',
            sheetName: sheetName,
            values: rowsValues
          })
        });

        if (scriptRes.ok) {
          const resData = safeParseJson(await scriptRes.text());
          if (resData.status === 'success' || resData.status === 'ok') {
            addSyncLog('success', `✓ สำเร็จ! นำเข้าข้อมูลแบบกลุ่มผ่าน Google Apps Script Web App เรียบร้อยแล้ว: ${resData.message || 'เสร็จสิ้น'}`);
            return true;
          } else {
            addSyncLog('success', `✓ ส่งข้อมูลถึง Apps Script สำเร็จแล้ว (${resData.message || 'รอดำเนินการ'})`);
            return true;
          }
        } else {
          throw new Error(`เซิร์ฟเวอร์ตอบกลับผิกพลาด (HTTP ${scriptRes.status})`);
        }
      } catch (e: any) {
        console.error('Apps Script bulk sync error', e);
        addSyncLog('error', `✗ พยายามนำเข้าแบบกลุ่มถึง Apps Script ล้มเหลว (สลับเข้าโหมดสำรอง): ${e.message}`);
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
      addSyncLog('info', `กำลังส่ง ${rowsValues.length} ผู้ป่วยไปที่คลาวด์ ${resolvedName} (ผ่าน API Proxy)...`);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
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
        const err = safeParseJson(await res.text());
        addSyncLog('error', `✗ ล้มเหลว: ปฏิเสธการบันทึกแบบกลุ่ม (${err.error?.message || res.statusText})`);
        return false;
      }
    } catch (e: any) {
      addSyncLog('error', `✗ ผิดพลาด: เชื่อมต่อคลาวด์แบบกลุ่มไม่ได้ (เครือข่ายขัดข้อง)`);
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
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(`${scriptUrlToUse}?action=getCredentials`)}`;
          const scriptRes = await fetch(proxyUrl);
          if (scriptRes.ok) {
            const data = safeParseJson(await scriptRes.text());
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
        const token = googleToken || localStorage.getItem('google_sheets_access_token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Use proxy to completely avoid browser CORS restrictions
        const itProxyUrl = `/api/proxy?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=2064021083`)}`;
        const execProxyUrl = `/api/proxy?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=174194219`)}`;
        const hospProxyUrl = `/api/proxy?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=934005991`)}`;

        // 1. เจ้าหน้าที่ IT สสจ.สตูล (Sheet 2) - GID 2064021083
        const itRes = await fetch(itProxyUrl, { headers });
        // 2. ผู้บริหาร/เจ้าหน้าที่ควบคุมโรค (Sheet 3) - GID 174194219
        const execRes = await fetch(execProxyUrl, { headers });
        // 3. เจ้าหน้าที่รพ. (Sheet 4) - GID 934005991
        const hospRes = await fetch(hospProxyUrl, { headers });

        const parsedIt: { id: string; name: string; pass: string }[] = [];
        const parsedExec: { id: string; name: string; pass: string }[] = [];
        const parsedHosp: { id: string; name: string; pass: string }[] = [];

        if (itRes.ok) {
          const contentType = itRes.headers.get('content-type') || '';
          const text = await itRes.text();
          
          if (!contentType.includes('text/html') && !text.includes('<!DOCTYPE html>') && !text.includes('ServiceLogin')) {
            const lines = text.split('\n');
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
              if (cols.length >= 3) {
                parsedIt.push({ id: cols[0], name: cols[1], pass: cols[2] });
              }
            }
          } else {
            console.warn("Sheet2 CSV download returned HTML (Auth redirection). Private Sheet access bypassed.");
          }
        }

        if (execRes.ok) {
          const contentType = execRes.headers.get('content-type') || '';
          const text = await execRes.text();
          
          if (!contentType.includes('text/html') && !text.includes('<!DOCTYPE html>') && !text.includes('ServiceLogin')) {
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
        }

        if (hospRes.ok) {
          const contentType = hospRes.headers.get('content-type') || '';
          const text = await hospRes.text();
          
          if (!contentType.includes('text/html') && !text.includes('<!DOCTYPE html>') && !text.includes('ServiceLogin')) {
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
      p.age || 25,
      p.gender || 'ชาย',
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

  // ระบบซิงก์แผนผังความเสี่ยงระดับตำบลเข้าสู่ Sheet 6 ทุกกครั้งที่มีการปรับปรุงข้อมูลประวัติผู้ป่วย
  const syncSheet6MapData = async (currentPatients: Patient[]) => {
    // ยกเลิกการเชื่อมต่อกับ Sheet 6 ตามคำสั่งผู้ใช้
    return;
  };

  // ระบบซิงก์สรุปยอดรายตำบลเข้าสู่ Sheet 1 ทุกครั้งที่มีการเพิ่มข้อมูลคนไข้ หรือเมื่อคลิกทำความสะอาดสแกนยอดตำบล
  const syncSheet1OnAddition = async (newPatients: Patient[]) => {
    // ยกเลิกการเชื่อมต่อกับ Sheet 1 ตามคำสั่งผู้ใช้
    return;
  };

  // 1. เพิ่มผู้ป่วยสอบสวนโรค
  const handleAddPatient = (p: Patient) => {
    setPatients(prev => {
      const nextList = [p, ...prev];
      // ซิงก์แผนผังระดับตำบลเข้าสู่ Sheet 6
      syncSheet6MapData(nextList);
      return nextList;
    });
    // ส่งข้อความความถี่แจ้งเตือนทันที
    triggerNotification(`พบกรณีลงทะเบียนผู้ป่วยใหม่: ${p.diseaseName.split(' ')[0]} ต.${p.subDistrict}`);
    // ซิงก์ลง Google Sheets (Sheet5) อัตโนมัติ
    appendToGoogleSheet('Sheet5', mapPatientToSheetRow(p));
    // ซิงก์สะสมอัปเดตสรุปยอดรายอำเภอตำบลที่ Sheet 1
    syncSheet1OnAddition([p]);
  };

  // 2. นำเข้าแบบกลุ่ม (CSV)
  const handleBulkAddPatients = (pList: Patient[]) => {
    setPatients(prev => {
      const nextList = [...pList, ...prev];
      // ซิงก์แผนผังระดับตำบลเข้าสู่ Sheet 6
      syncSheet6MapData(nextList);
      return nextList;
    });
    triggerNotification(`นำเข้าผู้ป่วยใหม่แบบกลุ่มจำนวน ${pList.length} คนผ่านระบบคำนวณอัตโนมัติสำเร็จ`);
    // ซิงก์ลง Google Sheets (Sheet5) อัตโนมัติแบบกลุ่ม
    appendRowsToGoogleSheet('Sheet5', pList.map(mapPatientToSheetRow));
    // ซิงก์สะสมอัปเดตสรุปยอดรายอำเภอตำบลที่ Sheet 1 แบบรวมกลุ่ม
    syncSheet1OnAddition(pList);
  };

  // 2.1 แทนที่คลังข้อมูล (เช่น ซิงก์ Google Sheets)
  const handleReplacePatients = (pList: Patient[]) => {
    setPatients(pList);
    triggerNotification(`เชื่อมโยงคลังข้อมูลใหม่ ทดแทนประวัติเดิมด้วยข้อมูล Google Sheets จำนวน ${pList.length} รายสำเร็จ`);
    // ซิงก์แผนผังระดับตำบลเข้าสู่ Sheet 6
    syncSheet6MapData(pList);
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

  const clearGoogleSheet = async (sheetName: string): Promise<boolean> => {
    if (sheetName === 'Sheet1' || sheetName === 'Sheet6') {
      return true;
    }
    const tokenToUse = googleToken || localStorage.getItem('google_sheets_access_token');
    const appsScriptUrlToUse = appsScriptUrl || localStorage.getItem('google_apps_script_url');

    if (appsScriptUrlToUse) {
      try {
        addSyncLog('info', `กำลังส่งคำสั่งล้างข้อมูลชีตเดิมไปยัง Google Apps Script [${sheetName}]...`);
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(appsScriptUrlToUse)}`;
        const scriptRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'clearSheet',
            sheetName: sheetName
          })
        });

        if (scriptRes.ok) {
          const resData = safeParseJson(await scriptRes.text());
          if (resData.status === 'success' || resData.status === 'ok') {
            addSyncLog('success', `✓ สำเร็จ! ล้างข้อมูลบน Google Sheets ผ่าน Apps Script แล้ว`);
            return true;
          }
        }
        throw new Error('เกิดข้อขัดข้องในการล้างข้อมูล');
      } catch (e: any) {
        console.error('Apps Script clear error', e);
        addSyncLog('error', `✗ พยายามล้างชีตผ่าน Apps Script ล้มเหลว: ${e.message}`);
        if (!tokenToUse) return false;
      }
    }

    if (!tokenToUse) {
      return false;
    }

    const spreadsheetId = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
    const resolvedName = await getResolvedSheetName(tokenToUse, sheetName);
    const range = encodeURIComponent(`${resolvedName}!A2:Z1000`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`;

    try {
      addSyncLog('info', `กำลังล้างระเบียนคลาวด์เดิมบนแผ่นงาน ${resolvedName} (ผ่าน API Proxy)...`);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (res.ok) {
        addSyncLog('success', `✓ สำเร็จ! ล้างตารางชีต ${resolvedName} เดิมเรียบร้อยแล้ว`);
        return true;
      } else {
        const err = safeParseJson(await res.text());
        addSyncLog('error', `✗ ปฏิเสธการล้างแผ่นงาน: ${err.error?.message || res.statusText}`);
        return false;
      }
    } catch (e: any) {
      addSyncLog('error', `✗ ไม่สามารถเชื่อมต่อกับคลาวด์เพื่อสั่งล้างข้อมูลได้`);
      return false;
    }
  };

  const overwriteGoogleSheet = async (sheetName: string, rowsValues: any[][]) => {
    if (sheetName === 'Sheet1' || sheetName === 'Sheet6') {
      return true;
    }
    const cleared = await clearGoogleSheet(sheetName);
    if (!cleared) {
      addSyncLog('error', `✗ ยกเลิกการซิงก์เขียนคำสั่งเนื่องจากไม่สามารถล้างแผ่นงานข้อมูลเดิมขยะได้`);
      return false;
    }
    if (rowsValues.length > 0) {
      return await appendRowsToGoogleSheet(sheetName, rowsValues);
    } else {
      addSyncLog('success', `✓ สำเร็จ! ล้างข้อมูลคลาวด์เสร็จสิ้น (กรณีผู้ป่วยเป็น 0 ราย)`);
      return true;
    }
  };

  const handleOverwriteCloud = async () => {
    const rows = patients.map(mapPatientToSheetRow);
    const success = await overwriteGoogleSheet('Sheet5', rows);
    if (success) {
      await syncSheet6MapData(patients);
      triggerNotification(`ซิงก์ข้อมูลทับสำเร็จ! อัปเดตข้อมูลผู้ป่วยปัจจุบัน ${patients.length} รายขึ้น Google Sheets แล้ว`);
      alert(`อัปโหลดและเขียนทับข้อมูลประวัติคนไข้บูรณาการจังหวัดสตูล รวม ${patients.length} รายการ ไปยัง Google Sheets สำเร็จเรียบร้อย!`);
      return true;
    } else {
      triggerNotification(`การสั่งเขียนทับข้อมูล Google Sheets คลาวด์ล้มเหลว`);
      alert(`ไม่สามารถเขียนทับข้อมูลคลาวด์ได้ กรุณาตรวจสอบสถานะ/สิทธิ์ล็อกอิน Token หรือการเชื่อมโยงของ Apps Script`);
      return false;
    }
  };

  const handleSyncAccumulations = async (): Promise<boolean> => {
    try {
      await syncSheet1OnAddition([]);
      await syncSheet6MapData(patients);
      return true;
    } catch (e: any) {
      console.error(e);
      triggerNotification(`การซิงก์สรุปยอดตำบลเกิดข้อผิดพลาด: ${e.message}`);
      return false;
    }
  };

  const handleDeletePatient = async (id: string) => {
    const patientToDelete = patients.find(p => p.id === id);
    if (!patientToDelete) return;

    const updatedPatients = patients.filter(p => p.id !== id);
    setPatients(updatedPatients);
    triggerNotification(`ลบคนไข้รหัส ${id} สำเร็จแล้ว`);

    // ไหลไปอัปเดต Google Sheet ทันทีหากเชื่อมอริจินัลแลกเปลี่ยน
    const tokenToUse = googleToken || localStorage.getItem('google_sheets_access_token');
    const appsScriptUrlToUse = appsScriptUrl || localStorage.getItem('google_apps_script_url');

    if (appsScriptUrlToUse || tokenToUse) {
      addSyncLog('info', `ตรวจพบการลบข้อมูลคนไข้ กำลังเริ่มปรับข้อมูลบนคลาวด์เขียนทับ...`);
      const rows = updatedPatients.map(mapPatientToSheetRow);
      await overwriteGoogleSheet('Sheet5', rows);
      await syncSheet6MapData(updatedPatients);
    }
  };

  // 7. เคลียร์ผู้ป่วยเพื่อทดสอบใหม่หมดจด
  const handleClearPatients = async () => {
    setPatients([]);
    setCommands([]);
    triggerNotification('ล้างฐานเก็บสะสมเดิมทั้งหมดเรียบร้อยแล้ว');

    const tokenToUse = googleToken || localStorage.getItem('google_sheets_access_token');
    const appsScriptUrlToUse = appsScriptUrl || localStorage.getItem('google_apps_script_url');

    if (appsScriptUrlToUse || tokenToUse) {
      addSyncLog('info', `กำลังส่งคำสั่งล้างตารางทั้งหมดบนคลาวด์...`);
      await clearGoogleSheet('Sheet5');
      await clearGoogleSheet('Sheet6');
      await clearGoogleSheet('Sheet7');
    }
  };

  // 8. ย้อนค่าโรงงาน สสจ.สตูลต้นทาง
  const handleRestoreDefaults = () => {
    // เก็บ Backup ชั่วคราวก่อนย้อนคืนเพื่อความปลอดภัย
    try {
      localStorage.setItem('satun_patients_backup', JSON.stringify(patients));
      localStorage.setItem('satun_categories_backup', JSON.stringify(categories));
      localStorage.setItem('satun_resources_backup', JSON.stringify(resources));
      localStorage.setItem('satun_commands_backup', JSON.stringify(commands));
      setHasBackup(true);
    } catch (e) {
      console.error('ไม่สามารถจำล็อกไฟล์กู้ฐานข้อมูลอัตโนมัติได้:', e);
    }

    localStorage.removeItem('satun_patients');
    localStorage.removeItem('satun_categories');
    localStorage.removeItem('satun_resources');
    localStorage.removeItem('satun_commands');
    setPatients(INITIAL_PATIENTS);
    setCategories(DISEASE_CATEGORIES);
    setResources(INITIAL_RESOURCES);
    setCommands(INITIAL_COMMANDS);
    triggerNotification('ย้อนคืนสิทธิ์ฐานข้อมูลโรงงานจังหวัดสตูลเรียบร้อยแล้ว (สามารถกดปุ่มกู้คืนข้อมูลเดิมในแผงควบคุมแอดมินได้ทันที)');
  };

  // 8.5 กู้ข้อมูลหลังเผลอกดรีเซ็ตระบบ
  const handleUndoRestoreDefaults = () => {
    const backupPatients = localStorage.getItem('satun_patients_backup');
    const backupCategories = localStorage.getItem('satun_categories_backup');
    const backupResources = localStorage.getItem('satun_resources_backup');
    const backupCommands = localStorage.getItem('satun_commands_backup');

    if (backupPatients || backupCategories || backupResources || backupCommands) {
      if (backupPatients) {
        setPatients(JSON.parse(backupPatients));
        localStorage.setItem('satun_patients', backupPatients);
      }
      if (backupCategories) {
        setCategories(JSON.parse(backupCategories));
        localStorage.setItem('satun_categories', backupCategories);
      }
      if (backupResources) {
        setResources(JSON.parse(backupResources));
        localStorage.setItem('satun_resources', backupResources);
      }
      if (backupCommands) {
        setCommands(JSON.parse(backupCommands));
        localStorage.setItem('satun_commands', backupCommands);
      }

      localStorage.removeItem('satun_patients_backup');
      localStorage.removeItem('satun_categories_backup');
      localStorage.removeItem('satun_resources_backup');
      localStorage.removeItem('satun_commands_backup');
      setHasBackup(false);
      triggerNotification('✓ กู้คืนข้อมูลเดิมก่อนการย้อนค่าโรงงานให้เรียบร้อยแล้ว!');
    } else {
      triggerNotification('ไม่พบประวัติข้อมูลสำรองเพื่อทำการกู้คืน');
    }
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
        {viewingHeatmapPublicly ? (
          <motion.div
            key="heatmap-view-block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col"
          >
            <HeatmapView 
              onBackToLogin={() => {
                if (typeof window !== 'undefined') {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
                setViewingHeatmapPublicly(false);
              }}
              categories={categories}
              authenticatedRole={authenticatedRole}
            />
          </motion.div>
        ) : !authenticatedRole ? (
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

              {hasBackup && (
                <div className="bg-amber-500/10 border border-amber-550/30 rounded-2xl p-3 text-center space-y-2 animate-pulse">
                  <p className="text-[10.5px] text-amber-200 font-bold leading-tight">
                    ⚠️ ตรวจพบข้อมูลสำรองจากการคืนค่าโรงงาน!
                  </p>
                  <button
                    type="button"
                    onClick={handleUndoRestoreDefaults}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition-all shadow-md inline-block"
                  >
                    กู้ข้อมูลทั้งหมดคืนทันที (Undo Restore)
                  </button>
                </div>
              )}

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
                  ⚙️ Admin (IT สสจ.)
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
                    placeholder="ระบุรหัสประจำตัวผู้ใช้งาน"
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
                    placeholder="ระบุรหัสเข้าสู่ระบบ"
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

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/5" />
                  <span className="flex-shrink mx-3 text-indigo-300/40 text-[9px] font-bold uppercase font-mono">หรือ</span>
                  <div className="flex-grow border-t border-white/5" />
                </div>

                <button
                  type="button"
                  onClick={() => setViewingHeatmapPublicly(true)}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border border-rose-500/20"
                >
                  <MapPin className="w-4 h-4" />
                  เข้าชม Heatmap สาธารณะ (ไม่ต้องใช้รหัสผ่าน) 🗺️
                </button>
              </form>

              <div className="text-[9.5px] text-indigo-300/60 text-center flex items-center justify-center gap-1.5 font-mono pt-4 border-t border-white/5">
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
                      {authenticatedRole === 'it_provincial' && '⚙️ ผู้ดูแลระบบ Admin (IT สสจ.สตูล)'}
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
                      onClick={() => setViewingHeatmapPublicly(true)}
                      className="p-1.5 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs border border-rose-500/30 text-[11px]"
                      title="เปิดแผนภูมิความร้อนและขีดประดับสีสาธารณะ"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      ดู Heatmap
                    </button>
                    <button
                      onClick={() => {
                        setAuthenticatedRole(null);
                        setAuthenticatedName(null);
                      }}
                      className="p-1.5 px-2.5 hover:bg-white/10 text-indigo-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-indigo-800/40 bg-indigo-900/20 text-[11px]"
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

              {hasBackup && (
                <div id="undo-restore-banner" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-pulse">
                  <div className="flex items-start gap-3">
                    <span className="p-2 bg-amber-100 text-amber-800 rounded-xl font-bold shrink-0 text-xs">⚠️ ตรวจพบข้อมูลเดิม</span>
                    <div>
                      <h4 className="text-xs font-black text-amber-900">ตรวจพบข้อมูลสำรอง (ก่อนทำการย้อนค่าโรงงาน)</h4>
                      <p className="text-[10px] text-amber-700 mt-0.5">ระบบได้จัดเก็บและสำรองข้อมูลทั้งหมดของคุณไว้โดยอัตโนมัติก่อนการคืนค่าโรงงาน คุณสามารถกู้คืนข้อมูลจังหวัดสตูลเดิมกลับมาได้ทันทีที่นี่!</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUndoRestoreDefaults}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition-all shadow-sm self-start sm:self-auto shrink-0 active:scale-95"
                  >
                    กู้คืนข้อมูลดั้งเดิมกลับมาเลย (Undo Restore)
                  </button>
                </div>
              )}
              
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
                        {authenticatedRole === 'it_provincial' && 'ผู้ดูแลระบบระบบ (Admin) - เจ้าหน้าที่ IT สสจ.สตูล'}
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

              {/* ส่วนแสดงสถิติประมวลและซิงก์ Google Sheets - เฉพาะ IT สสจ.สตูล เท่านั้น */}
              {authenticatedRole === 'it_provincial' && (
                <GoogleSheetsSync
                  token={googleToken}
                  onTokenChange={setGoogleToken}
                  appsScriptUrl={appsScriptUrl}
                  onAppsScriptUrlChange={setAppsScriptUrl}
                  syncLogs={syncLogs}
                  onClearLogs={() => setSyncLogs([])}
                  onOverwriteCloud={handleOverwriteCloud}
                  onSyncAccumulations={handleSyncAccumulations}
                  patientsCount={patients.length}
                />
              )}

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
                  onDeletePatient={handleDeletePatient}
                  hasBackup={hasBackup}
                  onUndoRestore={handleUndoRestoreDefaults}
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
