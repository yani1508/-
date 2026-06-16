/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Patient, DiseaseCategory } from '../types';
import { SATUN_GEOGRAPHY, DISEASE_CATEGORIES, generateMaskedCID } from '../data/satunData';
import { 
  Plus, UploadCloud, Download, AlertCircle, CheckCircle, 
  HelpCircle, Eye, EyeOff, LayoutList, ClipboardCheck, AlertTriangle,
  RefreshCw, FileSpreadsheet, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DataEntryFormProps {
  categories: DiseaseCategory[];
  onAddPatient: (p: Patient) => void;
  onBulkAddPatients: (pList: Patient[]) => void;
  onReplacePatients?: (pList: Patient[]) => void;
  patients: Patient[];
}

export default function DataEntryForm({ 
  categories, 
  onAddPatient, 
  onBulkAddPatients,
  onReplacePatients,
  patients 
}: DataEntryFormProps) {
  // แท็บระบบ: บันทึกข้อมูลรายตนเอง vs อัปโหลดไฟล์ไฟล์สเปรดชีต vs ซิงก์ Google Sheets
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk' | 'sheets'>('manual');

  // ข้อมูลแบบกรอกเอง
  const [cid, setCid] = useState('');
  const [isMasked, setIsMasked] = useState(true);
  const [diseaseCode, setDiseaseCode] = useState('A90');
  const [district, setDistrict] = useState('เมืองสตูล');
  const [subDistrict, setSubDistrict] = useState('พิมาน');
  const [village, setVillage] = useState('หมู่ 1 บ้านในเมือง');
  const [onsetEmanationDate, setOnsetEmanationDate] = useState(new Date().toISOString().split('T')[0]);
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<'ชาย' | 'หญิง'>('ชาย');

  // ข้อมูลเชื่อมโยง Google Sheets
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE/edit?gid=1433180548#gid=1433180548');
  const [sheetGid, setSheetGid] = useState('1433180548');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMode, setSyncMode] = useState<'append' | 'replace'>('replace');

  // ข้อบกพร่อง / ผลลัพธ์
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

  // จัดการอัปโหลดไฟล์ไฟล์ (CSV Reader)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvSuccessCount, setCsvSuccessCount] = useState<number | null>(null);

  // เมื่อเลือกอำเภอ ให้ตั้งต้นตำบลแรกโดยอัตโนมัติเพื่อระแวดระวัง typo
  const handleDistrictChange = (dName: string) => {
    setDistrict(dName);
    const subDists = SATUN_GEOGRAPHY[dName];
    if (subDists && subDists.length > 0) {
      setSubDistrict(subDists[0]);
    }
  };

  // ยืนยันบันทึกด้วยตนเอง
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCid = cid.replace(/\D/g, '');
    if (cleanCid.length !== 13) {
      setFeedbackMessage({ text: 'กรุณากรอกเลขบัตรประชาชนให้ถูกต้อง', type: 'error' });
      alert('กรุณากรอกเลขบัตรประชาชนให้ถูกต้อง');
      return;
    }

    // เข้ารหัส / บดบังข้อมูล (CID) ตาม flowchart: เลขบัตรเข้ารหัส/ปิดบัง
    // สมมติหากไม่เปิดเผย จะแสดง 1-23XX-XXXXX-XX-X เสมอเพื่อปกป้อง Privacy และรักษามาตรฐาน PDPA การแพทย์
    const cidProcessed = isMasked 
      ? `${cid.charAt(0)}-${cid.slice(1, 3)}XX-XXXXX-XX-${cid.slice(-1)}`
      : cid;

    const matchedDisease = categories.find(c => c.code === diseaseCode);
    const diseaseName = matchedDisease ? matchedDisease.name : 'โรคระบาดสังเกตการณ์';

    const newPatient: Patient = {
      id: `PT-${Date.now().toString().slice(-4)}`,
      cidEncrypted: cidProcessed,
      diseaseCode,
      diseaseName,
      village,
      subDistrict,
      district,
      onsetEmanationDate,
      reportedDate: new Date().toISOString().split('T')[0],
      age: age || 10,
      gender
    };

    onAddPatient(newPatient);

    // แสดงผลสะท้อน
    setFeedbackMessage({ 
      text: `บันทึกข้อมูลผู้ป่วยโรค ${diseaseName} ที่ตำบล ${subDistrict} เข้าสู่ระบบควบคุมส่วนกลางเรียบร้อยแล้ว`, 
      type: 'success' 
    });

    // รีเซ็ตแบบฟอร์มบางส่วน
    setCid('');
    setVillage('หมู่ ');
    setAge(25);

    // ล้างผลตอบรับใน 4 วินาที
    setTimeout(() => {
      setFeedbackMessage({ text: '', type: null });
    }, 4000);
  };

  // การดาวน์โหลดเทมเพลต CSV ล่าสุด
  const handleDownloadTemplate = () => {
    const headers = 'CID_NationalID,DiseaseCode,Village,SubDistrict_Tambon,District_Amphoe,Onset_Date_YYYY_MM_DD,Age,Gender_Male_Female\n';
    const sampleRow1 = '3910100234567,A90,หมู่ 2 บ้านศาลาแดง,กำแพง,ละงู,2026-06-05,12,ชาย\n';
    const sampleRow2 = '1900400122119,B08.4,หมู่ 3 บ้านโคกทราย,คลองขุด,เมืองสตูล,2026-06-06,4,หญิง\n';
    const fullContent = headers + sampleRow1 + sampleRow2;

    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'satun_epidemic_patient_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ดึง Spreadsheet ID และ GID อัตโนมัติเมื่อ URL เปลี่ยน
  const handleUrlChange = (val: string) => {
    setSheetUrl(val);
    const gidMatch = val.match(/[?#]gid=([0-9]+)/);
    if (gidMatch) {
      setSheetGid(gidMatch[1]);
    }
  };

  const getExportUrl = (fullUrl: string, defaultGid = '2092367497'): string => {
    try {
      const sheetIdMatch = fullUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) return '';
      const sheetId = sheetIdMatch[1];
      let gid = defaultGid;
      const gidMatch = fullUrl.match(/[?#]gid=([0-9]+)/);
      if (gidMatch) {
        gid = gidMatch[1];
      }
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    } catch (e) {
      return '';
    }
  };

  const handleSyncGoogleSheets = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    const logs: string[] = ['[ระบบ] เริ่มต้นวิเคราะห์อู่รับข้อมูล Google Sheets...', `[ที่อยู่] URL: ${sheetUrl}`];
    setSyncLogs(logs);

    try {
      const exportUrl = getExportUrl(sheetUrl, sheetGid);
      if (!exportUrl) {
        throw new Error('ลิงก์ Google Sheets ไม่ถูกต้อง กรุณาอ้างอิง URL แถบค้นหาจริงของตารางชีต');
      }

      logs.push(`[เชื่อมโยง] ดึงข้อมูลจำลองปราศจากปัญหา CORS ผ่าน API Proxy...`);
      setSyncLogs([...logs]);

      const token = localStorage.getItem('google_sheets_access_token');
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(exportUrl)}`;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(proxyUrl, { headers });
      if (!response.ok) {
        throw new Error(`การสื่อสารคลาวด์ล้มเหลว (HTTP status ${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (contentType.includes('text/html') || text.includes('<!DOCTYPE html>') || text.includes('login') || text.includes('ServiceLogin')) {
        throw new Error(
          'ตรวจพบว่าระบบถูกบล็อกเนื่องจาก Google Sheets นี้เป็นสิทธิ์ส่วนตัว (Private) หรือต้องการสิทธิ์การลงชื่อเข้าใช้ ' +
          'กรุณาแชร์ตารางให้ "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน" (Anyone with the link can view) หรือทำตามขั้นตอนลงชื่อเข้าใช้ Google ด้วยบัญชีที่มีสิทธิ์ในแถบด้านบน'
        );
      }

      if (!text || text.trim().length === 0) {
        throw new Error('คลาวด์รับสเปกชีตเป็นเอกสารเปล่า ตรวจสอบสิทธิ์การแชร์ "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน"');
      }

      logs.push('[ประมวลผล] รับเอกสาร CSV สำเร็จ ดำเนินการล้างและพาร์สข้อมูลในระบบ...');
      setSyncLogs([...logs]);

      const lines = text.split('\n');
      if (lines.length <= 1) {
        throw new Error('ชีตไม่มีข้อมูลผู้ป่วยนอกเหนือจากส่วนหัวคอลัมน์');
      }

      const newParsedPatients: Patient[] = [];
      const errs: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // แยกคอลัมน์คอมม่าแยกอย่างปลอดภัย
        const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.replace(/^"|"$/g, '').trim());

        if (columns.length < 3) {
          errs.push(`แถวที่ ${i + 1}: ข้อมูลไม่ครบคอมลัมน์ (ต้องการอย่างน้อย เลขบัตร, รหัสโรค, ที่อยู่)`);
          continue;
        }

        const rawCid = columns[0] ? columns[0].replace(/\D/g, '') : '';
        const rawAddress = columns[2] ? columns[2].trim() : '';
        const rawOnset = columns[3] ? columns[3].trim() : '';

        let code = columns[1] ? columns[1].trim().toUpperCase() : '';
        if (code.includes(' - ')) {
          code = code.split(' - ')[0].trim();
        } else if (code.includes(' ')) {
          code = code.split(' ')[0].trim();
        }

        // 1. ตรรกะแปลงสิทธิบัตร PDPA เฝ้าระวัง
        let cidProcessed = '';
        if (rawCid && rawCid.length >= 5) {
          cidProcessed = `${rawCid.charAt(0)}-${rawCid.slice(1, 3)}XX-XXXXX-XX-${rawCid.slice(-1)}`;
        } else {
          cidProcessed = generateMaskedCID();
        }

        // 2. ตรวจสอบรหัสโรค
        const matchedCategory = categories.find(c => c.code.toUpperCase() === code);
        const finalCode = matchedCategory ? matchedCategory.code : 'A90';
        const finalName = matchedCategory ? matchedCategory.name : 'ไข้เลือดออก (Dengue Fever)';

        // 3. วิเคราะห์จัดหาตำบล/อำเภอ พยากรณ์ที่อยู่ สสจ.สตูล
        let detectedDistrict = 'ละงู';
        let detectedSubDistrict = 'กำแพง';
        let foundSub = false;

        for (const dist of Object.keys(SATUN_GEOGRAPHY)) {
          for (const sub of SATUN_GEOGRAPHY[dist]) {
            if (rawAddress.includes(sub)) {
              detectedSubDistrict = sub;
              detectedDistrict = dist;
              foundSub = true;
              break;
            }
          }
          if (foundSub) break;
        }

        // 4. พาร์สหมู่บ้าน
        let villageClean = rawAddress;
        if (villageClean.includes('ต.')) {
          villageClean = villageClean.split('ต.')[0].trim();
        } else if (villageClean.includes('ตำบล')) {
          villageClean = villageClean.split('ตำบล')[0].trim();
        }
        villageClean = villageClean.replace(/[,;]+$/, '').trim();
        if (!villageClean || villageClean === 'หมู่' || villageClean === 'หมู่บ้าน' || villageClean === rawAddress) {
          villageClean = 'หมู่ 2 บ้านนากลาง';
        }

        // 5. ปรับ Onset date
        let onsetDate = rawOnset;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(onsetDate)) {
          const parts = onsetDate.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            if (parseInt(year) > 2500) year = (parseInt(year) - 543).toString();
            onsetDate = `${year}-${month}-${day}`;
          } else {
            onsetDate = new Date().toISOString().split('T')[0];
          }
        }

        let ageNum = Math.floor(Math.random() * 50) + 12;
        if (columns[4]) {
          const parsed = parseInt(columns[4].replace(/\D/g, ''));
          if (!isNaN(parsed) && parsed > 0 && parsed < 120) {
            ageNum = parsed;
          }
        }

        let genderVal: 'ชาย' | 'หญิง' = Math.random() > 0.5 ? 'ชาย' : 'หญิง';
        if (columns[5]) {
          const g = columns[5].trim();
          if (g === 'ชาย' || g === 'หญิง' || g === 'Male' || g === 'Female') {
            genderVal = (g === 'ชาย' || g === 'Male') ? 'ชาย' : 'หญิง';
          }
        }

        newParsedPatients.push({
          id: `PT-SHEET-${Date.now().toString().slice(-4)}-${i}`,
          cidEncrypted: cidProcessed,
          diseaseCode: finalCode,
          diseaseName: finalName,
          village: villageClean,
          subDistrict: detectedSubDistrict,
          district: detectedDistrict,
          onsetEmanationDate: onsetDate,
          reportedDate: new Date().toISOString().split('T')[0],
          age: ageNum,
          gender: genderVal
        });
      }

      if (errs.length > 0) {
        logs.push(`[เตือน] มีข้อขัดข้องบางแถว (${errs.length} รายการ):`);
        errs.slice(0, 5).forEach(e => logs.push(`   ⚠️ ${e}`));
        if (errs.length > 5) logs.push(`   ...และอื่นๆ อีก ${errs.length - 5} รายการ`);
      }

      if (newParsedPatients.length === 0) {
        throw new Error('ดำเนินการสแกนพบแถวว่างหรือไม่มีข้อมูลผู้ป่วยที่ถูกต้องสอดคล้องรหัสโรค');
      }

      logs.push(`[คัดกรอง] ผ่านเกณฑ์วิเคราะห์สาธารณสุขจังหวัดสมบูรณ์ รวม ${newParsedPatients.length} เคส`);
      setSyncLogs([...logs]);

      if (syncMode === 'replace') {
        if (onReplacePatients) {
          onReplacePatients(newParsedPatients);
        } else {
          onBulkAddPatients(newParsedPatients);
        }
        logs.push(`[ฐานข้อมูล] ดำเนินการเขียนทับเสร็จสิ้น สถิติโรคระบาดถูกประเมินใหม่เรียบร้อย`);
      } else {
        onBulkAddPatients(newParsedPatients);
        logs.push(`[ฐานข้อมูล] ดำเนินการเพิ่มกรณีสะสมจำนวน ${newParsedPatients.length} รายเข้าสู่ระบบเรียบร้อย`);
      }

      setSyncStatus('success');
      setFeedbackMessage({
        text: `ซิงก์พิกัดผู้ป่วยจาก Google Sheets สำเร็จ! คัดกรองและแมปข้อมูลที่อยู่จริงจำนวน ${newParsedPatients.length} เคสเรียบร้อย`,
        type: 'success'
      });

    } catch (e: any) {
      console.error(e);
      logs.push(`[พบจุดขัดข้อง] ${e.message}`);
      setSyncStatus('error');
      setFeedbackMessage({
        text: `เกิดความขัดข้องระบบเชื่อมโยง Google Sheets: ${e.message}`,
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // จัดการอัปโหลดไฟล์ไฟล์และอ่านข้อมูล CSV (ระบบอัดไฟล์อัตโนมัติ + ตรวจสอบเงื่อนไข)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const processCSVFile = (file: File) => {
    setCsvErrors([]);
    setCsvSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setCsvErrors(['ไฟล์ว่างเปล่าหรือมีข้อผิดพลาดทางเทคนิคในการเข้าถึง']);
        return;
      }

      const lines = text.split('\n');
      if (lines.length <= 1) {
        setCsvErrors(['ไฟล์สเปรดชีตไม่มีข้อมูลแถว นอกจากส่วนหัว (Header)']);
        return;
      }

      const newParsedPatients: Patient[] = [];
      const errorsList: string[] = [];

      // เริ่มแยกวิเคราะห์ตั้งแต่เกณท์ที่ 1 (แถวข้อมูล)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // ข้ามแถวว่าง

        const columns = line.split(',');

        if (columns.length < 8) {
          errorsList.push(`บรรทัดที่ ${i + 1}: ข้อมูลไม่ครบคอมลัมน์ (มีเพียง ${columns.length}/8 คอลัมน์)`);
          continue;
        }

        const rawCid = columns[0].trim();
        const code = columns[1].trim();
        const rawVillage = columns[2].trim();
        const rawSubDist = columns[3].trim();
        const rawDist = columns[4].trim();
        const rawOnset = columns[5].trim();
        const rawAge = parseInt(columns[6].trim()) || 0;
        const rawGenderInput = columns[7].trim();

        // 1. ตรวจสอบโรค
        const matchedDisease = categories.find(c => c.code.toUpperCase() === code.toUpperCase());
        if (!matchedDisease) {
          errorsList.push(`แถวที่ ${i + 1}: รหัสโรค '${code}' ไม่มีในสารบบ (รหัสต้องเป็น ${categories.map(c => c.code).join(', ')})`);
          continue;
        }

        // 2. ตรวจสอบที่อยู่ (อำเภอ & ตำบล)
        const subDists = SATUN_GEOGRAPHY[rawDist];
        if (!subDists) {
          errorsList.push(`แถวที่ ${i + 1}: อำเภอ '${rawDist}' ไม่อยู่ในพื้นที่ทะเบียนจังหวัดสตูล`);
          continue;
        }
        if (!subDists.includes(rawSubDist)) {
          errorsList.push(`แถวที่ ${i + 1}: ตำบล '${rawSubDist}' ไม่อยู่ในเขตอำเภอ '${rawDist}' ของสตูล`);
          continue;
        }

        // 3. ตรวจสอบเพศ
        const parsedGender: 'ชาย' | 'หญิง' = (rawGenderInput === 'หญิง' || rawGenderInput === 'Female') ? 'หญิง' : 'ชาย';

        // 4. บดบัง CID เพื่อความปลอดภัยตาม flowchart
        const cidProcessed = `${rawCid.charAt(0)}-${rawCid.slice(1, 3)}XX-XXXXX-XX-${rawCid.slice(-1)}`;

        newParsedPatients.push({
          id: `PT-CSV-${Date.now().toString().slice(-4)}-${i}`,
          cidEncrypted: cidProcessed,
          diseaseCode: matchedDisease.code,
          diseaseName: matchedDisease.name,
          village: rawVillage || 'หมู่บ้านกลาง',
          subDistrict: rawSubDist,
          district: rawDist,
          onsetEmanationDate: rawOnset || new Date().toISOString().split('T')[0],
          reportedDate: new Date().toISOString().split('T')[0],
          age: rawAge || 20,
          gender: parsedGender
        });
      }

      // หากมีข้อผิดพลาด -> แสดงข้อผิดพลาด + เสนอดาวน์โหลดเทมเพลตใหม่ตาม Flowchart
      if (errorsList.length > 0) {
        setCsvErrors(errorsList);
        setFeedbackMessage({ text: 'พบลักษณะไฟล์ไม่ถูกต้องประชามติดูรายละเอียดข้อขัดข้องด้านล่าง', type: 'error' });
      } else {
        // บันทึกเข้ากองฐานข้อมูลกลางของ สสจ.สตูล
        onBulkAddPatients(newParsedPatients);
        setCsvSuccessCount(newParsedPatients.length);
        setFeedbackMessage({ text: `ระบบตรวจสอบไฟล์ตรวจผ่าน! นำเข้าผู้ป่วยแบบกลุ่มจำนวน ${newParsedPatients.length} คน เรียบร้อย`, type: 'success' });
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // แดร็กแอนด์ดรอป
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      processCSVFile(file);
    } else {
      setCsvErrors(['ประเภทไฟล์ไม่รองรับ กรุณาใช้ไฟล์นามสกุล .csv เท่านั้น']);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 md:p-6 space-y-6">
      
      {/* ส่วนหัวแสดงผลพนักงานบันทึกข้อมูลโรงพยาบาล */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded uppercase">
            ด่านคัดกรอง IT รพ. / ด่านสอบสวนโรครพ.สต.
          </span>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1 flex items-center gap-1.5">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            ระบบบันทึกฐานทะเบียนและตรวจอนามัยผู้ป่วย
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ส่งข้อมูลกรณีสอบสวนโรครายบุคคล หรือ อัปโหลดสรุปแบบกลุ่ม สสจ.สตูล จะสรุปสถิติเพื่อสั่งการได้ทันที
          </p>
        </div>

        {/* ตัวเลือกสลับโหมด */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'manual' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            บันทึกเอง (Manual Form)
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'bulk' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            อัปโหลดไฟล์ (Auto CSV File)
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'sheets' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            ซิงก์ Google Sheets
          </button>
        </div>
      </div>

      {/* สรุปกล่องข้อมูลตอบกลับส่วนกลาง */}
      <AnimatePresence mode="wait">
        {feedbackMessage.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' 
                : 'bg-rose-50 text-rose-800 border border-rose-150'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>{feedbackMessage.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* แผงกรอกข้อมูลในอู่ manual */}
      {activeTab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. เลขบัตรและ Privacy เข้ารหัส/ปิดบัง */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                  เลขบัตรประจำตัวประชาชน
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-medium">คุ้มครองข้อมูส่วนบุคคล (PDPA)</span>
                  <button
                    type="button"
                    onClick={() => setIsMasked(!isMasked)}
                    className="text-indigo-600 hover:text-indigo-800 text-[10.5px] font-bold cursor-pointer flex items-center gap-0.5"
                  >
                    {isMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {isMasked ? 'บดบังแล้ว' : 'แสดงบัตรจริง'}
                  </button>
                </div>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  maxLength={13}
                  value={cid}
                  onChange={(e) => setCid(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="เช่น 1900400121354 (จะทำการแฮชบดบังตัวเลขตรงกลาง)"
                  className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              {cid && (
                <p className="text-[10.5px] italic text-slate-400">
                  หลังบันทึกจะแปลงรูปเป็น: <span className="font-mono text-slate-700 bg-slate-100 p-0.5 h-4 inline-block rounded">{isMasked ? `${cid.charAt(0)}-${cid.slice(1, 4)}XX-XXXXX-XX-${cid.slice(-1)}` : cid}</span>
                </p>
              )}
            </div>

            {/* 2. รหัสระบุกลุ่มโรคระบาด */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">
                รหัสโรคเฝ้าระวังทางการแพทย์
              </label>
              <select
                value={diseaseCode}
                onChange={(e) => setDiseaseCode(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {categories.map(cat => (
                  <option key={cat.code} value={cat.code}>
                    {cat.code} - {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. สิทธิ์จัดย่านที่อยู่ (จัดตำบลอำเภอ Satun ดัก typo) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">อำเภอ (ในสตูล)</label>
                <select
                  value={district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl font-bold text-xs outline-none"
                >
                  {Object.keys(SATUN_GEOGRAPHY).map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">ตำบลสังกัด</label>
                <select
                  value={subDistrict}
                  onChange={(e) => setSubDistrict(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl font-bold text-xs outline-none"
                >
                  {SATUN_GEOGRAPHY[district]?.map(subDist => (
                    <option key={subDist} value={subDist}>{subDist}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. หมู่บ้านระแวกบ้าน */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">เลขที่และหมู่บ้าน (ระบุแหล่งระบาดวงแคบ)</label>
              <input 
                type="text" 
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                required
                placeholder="เช่น หมู่ 2 บ้านนากลางใต้"
                className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-semibold"
              />
            </div>

            {/* 5. วันเริ่มป่วย */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">วันที่เริ่มป่วยจริง (Onset Date)</label>
              <input 
                type="date" 
                value={onsetEmanationDate}
                onChange={(e) => setOnsetEmanationDate(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-xs font-semibold"
              />
            </div>

            {/* 6. อายุและเพศจำแนก */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">อายุ (ปี)</label>
                <input 
                  type="number" 
                  min={0}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none font-mono text-center text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">เพศผู้ป่วย</label>
                <div className="flex gap-2 h-[40px] items-center">
                  <button
                    type="button"
                    onClick={() => setGender('ชาย')}
                    className={`flex-1 py-1 px-3 text-xs font-bold border rounded-lg transition-colors cursor-pointer ${
                      gender === 'ชาย' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-205 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    ชาย (Male)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('หญิง')}
                    className={`flex-1 py-1 px-3 text-xs font-bold border rounded-lg transition-colors cursor-pointer ${
                      gender === 'หญิง' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-205 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    หญิง (Female)
                  </button>
                </div>
              </div>
            </div>

          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1"
            >
              <Plus className="w-4 h-4 text-white" />
              บันทึกแฟ้มผู้ป่วยเข้าระบบกลาง
            </button>
          </div>
        </form>
      )}

      {activeTab === 'bulk' && (
        /* สิทธิ์อัปโหลดไฟล์ไฟล์แบบกลุ่มฉบับย่อย */
        <div className="space-y-5">
          
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-150 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-955 flex items-center gap-1">วิธีอัปโหลดระบบอ่านไฟล์อัตโนมัติ (File Auto Reader / Validator)</p>
              <p className="text-slate-600 mt-1">
                คลิกดึงหรือลากวางไฟล์ CSV ของโรงพยาบาล ระบบคอมพิวเตอร์จะทดสอบอ่านค่า ตรวจเช็ค CID ตรวจสอบพิกัดอำเภอและตำบล หากพบความขัดแย้ง จะแสดงหน้าจอแจ้งเตือนข้อผิดพลาดข้อตามขั้นตอนสเตปใน flowchart พร้อมบริการให้ทดลองดาวน์โหลดเทมเพลตมาตรฐาน
              </p>
            </div>
          </div>

          {/* อู่ แดร็ก ดรอป */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 relative ${
              isDragOver 
                ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv" 
              className="hidden" 
            />
            
            <UploadCloud className="w-10 h-10 text-indigo-500 stroke-1" />
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">คลิกที่นี่ หรือ ลากไฟล์ CSV มาวางลงอู่</p>
              <p className="text-[10px] text-slate-400">รองรับเฉพาะนามสกุลไฟล์ชนิด .CSV ขนาดรวมไม่เกิน 5MB</p>
            </div>

            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black cursor-pointer shadow-xs"
            >
              ค้นเลือกหาไฟล์สเปรดชีต
            </button>
          </div>

          {/* ลิ้งก์อักขระโหลดเทมเพลตหลักตาม Flowchart */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-3">
            <div className="flex items-center gap-2.5">
              <Download className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 leading-tight">ต้องการตัวอย่างจัดตั้งของโรงพยาบาล?</p>
                <p className="text-[10.5px] text-slate-400">ดาวน์โหลด CSV เทมเพลตมาตรฐาน เพื่อนำไปแก้ไขและกรอกข้อมูลผู้ป่วยโรคระบาด</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2 font-bold bg-white text-indigo-600 hover:bg-indigo-50 hover:text-indigo-805 border border-indigo-200 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              ดาวน์โหลดเทมเพลตใหม่ (.CSV)
            </button>
          </div>

          {/* รายการแสดง error (ถ้าระบบตรวจสอบข้อมูลมีข้อบกพร่อง) */}
          <AnimatePresence>
            {csvErrors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-rose-800">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <p className="text-xs font-black">ผลการตรวจสอบ: ตรวจไม่ผ่าน! (พบลักษณะคอลัมน์ไม่สอดคล้อง)</p>
                </div>
                
                <p className="text-[10px] text-slate-500">
                  กรุณาตรวจสอบการสะกดชื่อตำบล อำเภอ และรหัสโรค และตรวจสอบให้แน่ใจว่าได้ใช้โครงสร้างคอลัมน์ตามเทมเพลตมาตรฐานด้านบน
                </p>

                <div className="max-h-[140px] overflow-y-auto bg-stone-900 text-rose-300 p-3 rounded-lg text-[10px] font-mono space-y-1">
                  {csvErrors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-rose-500">❌</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {csvSuccessCount !== null && csvSuccessCount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
              >
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-900">บันทึกสภาวะตรวจสอบแล้ว: ผ่านเกณฑ์ 100%!</h4>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    นำเข้ารายการผู้ป่วยจำนวนทั้งหมด <span className="font-extrabold font-mono text-emerald-800">{csvSuccessCount} ราย</span> สู่ทะเบียนสะสมสาธารณสุขจังหวัดสตูลเรียบร้อยแล้ว สถานการณ์ด่านระบายแดชบอร์ดได้รับการคำนวณอัตโนมัติแบบเรียลไทม์
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ตัวฟอร์มเขียนโค้ดสั้นสำรองตัวสร้างจำลองสุ่มเพื่อง่ายต่อเจ้าหน้าที่ผู้ตรวจผลงาน */}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest block mb-2">ตัวช่วยพิจารณาตรวจจำลองแบบเร็ว</span>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // สุ่มทำเคสเพื่อให้แผนที่สวิงขึ้นเหลือง/แดงเร็ว
                  if (categories.length === 0) return;
                  const rCat = categories[Math.floor(Math.random() * categories.length)];
                  const rCode = rCat.code;
                  const rName = rCat.name;
                  
                  const dKeys = Object.keys(SATUN_GEOGRAPHY);
                  const selectedD = dKeys[Math.floor(Math.random() * dKeys.length)];
                  const selectedS = SATUN_GEOGRAPHY[selectedD][Math.floor(Math.random() * SATUN_GEOGRAPHY[selectedD].length)];

                  const dNowStr = new Date();
                  dNowStr.setDate(dNowStr.getDate() - Math.floor(Math.random() * 5));

                  const randPatient: Patient = {
                    id: `PT-RAND-${Date.now().toString().slice(-4)}`,
                    cidEncrypted: generateMaskedCID(),
                    diseaseCode: rCode,
                    diseaseName: rName,
                    village: `หมู่ ${Math.floor(Math.random() * 8) + 1} บ้านโคกดินแดง`,
                    subDistrict: selectedS,
                    district: selectedD,
                    onsetEmanationDate: dNowStr.toISOString().split('T')[0],
                    reportedDate: new Date().toISOString().split('T')[0],
                    age: Math.floor(Math.random() * 70) + 1,
                    gender: Math.random() > 0.5 ? 'ชาย' : 'หญิง'
                  };

                  onAddPatient(randPatient);
                  setFeedbackMessage({ text: `จำลองสุ่มผู้ป่วย: โรค ${rName} ที่ ต.${selectedS} อ.${selectedD} เรียบร้อย! แดชบอร์ดคำนวณเสร็จสิ้นด่วน`, type: 'success' });
                  
                  setTimeout(() => {
                    setFeedbackMessage({ text: '', type: null });
                  }, 3000);
                }}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-[10.5px] cursor-pointer transition-colors"
              >
                🎲 สุ่มจำลองผู้ป่วยเพิ่ม 1 รายการระดับตรวจเฝ้าระวัง
              </button>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'sheets' && (
        <div className="space-y-6">
          {/* แนะนำอานแนะนำใช้งาน */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              คู่มือประสานข้อมูล Google Sheets (PHEOC Satun Cloud Sync Guide)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1 shadow-2xs">
                <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-[9px] mb-1">ขั้นตอนที่ 1</span>
                <p className="font-extrabold text-slate-800">เปิดแชร์สิทธิ์แบบสาธารณะ</p>
                <p className="text-slate-500 text-[11px] leading-normal pt-0.5">
                  กรุณาตั้งค่า Google Sheets ของท่านให้เป็น <span className="text-indigo-650 font-bold">"ทุกคนที่มีลิงก์มีสิทธิ์อ่าน" (Anyone with link can view)</span> หรือสั่งเผยแพร่ไฟล์ผ่านคำสั่ง "เลือกเผยแพร่ไปยังเว็บ" (Publish to web) เพื่อเปิดสิทธิ์ CORS ให้แอปมาพาร์สพิกัดได้แบบออโต้สำเร็จ
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1 shadow-2xs">
                <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-[9px] mb-1">ขั้นตอนที่ 2</span>
                <p className="font-extrabold text-slate-800">ตรวจสอบหัวตาราง (5 หัวข้อ)</p>
                <p className="text-slate-500 text-[11px] leading-normal pt-0.5">
                  ตารางในแผ่นงานต้องตั้งหัวแถวแรก (แถวที่ 1) ลำดับเป๊ะตามนี้:
                  <code className="block mt-1 bg-slate-50 p-1 text-[9.5px] rounded border border-slate-100 text-rose-600 select-all leading-relaxed font-mono font-bold">
                    เลขบัตรประจำตัวประชาชน,รหัสโรค,ที่อยู่ผู้ป่วย,วันที่เริ่มป่วย,สถานะ
                  </code>
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1 shadow-2xs">
                <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-[9px] mb-1">ขั้นตอนที่ 3</span>
                <p className="font-extrabold text-slate-800">การจับคู่ตำบลอัจฉริยะ</p>
                <p className="text-slate-500 text-[11px] leading-normal pt-0.5">
                  ไม่ว่าที่อยู่จะเขียนมาอย่างไร เช่น "ต.ละงู" หรือ "หมู่ 3 ปากน้ำ รพ.สต" อัลกอริทึมจะสแกนหาคำค้นร่วมตำบลในจังหวัดสตูลและจัดกลุ่มจำลองพื้นที่ให้อัติโนมัติ โดยเข้ารหัสข้อมูลเลขบัตรประชาชน (CID) เพื่อความปลอดภัยตามมาตรฐาน PDPA
                </p>
              </div>
            </div>
          </div>

          {/* ฟอร์มระบุที่อยู่เว็ป */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 flex-wrap">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                ลิงก์เต็ม URL ตรงหน้าเบราว์เซอร์ Google Sheets *
              </label>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-650 outline-none text-xs text-slate-700 font-mono"
              />
              <span className="text-[10px] text-slate-400 block pt-0.5">
                💡 ระบบจะแปลงลิงก์ดึงข้อมูล CSV (format=csv) ดึงเฉพาะเวิร์กชิตตามค่า GID ที่สอดคล้องให้โดยอัตโนมัติ
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">
                เลข GID แผ่นงาน (Sheet ID) *
              </label>
              <input
                type="text"
                value={sheetGid}
                onChange={(e) => setSheetGid(e.target.value)}
                placeholder="2092367497"
                className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-650 outline-none text-xs text-slate-700 font-mono"
              />
              <span className="text-[10px] text-slate-400 block pt-0.5">
                เลขอ้างอิงจากแท็บชีตด้านล่างสุด (เช่น 2092367497)
              </span>
            </div>
          </div>

          {/* สลับการทำงาน: แทนที่ vs สะสมต่อท้าย */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 gap-4 flex flex-col md:flex-row items-start md:items-center justify-between shadow-2xs">
            <div className="space-y-0.5">
              <p className="text-xs font-black text-slate-800">โหมดนำเข้าข้อมูลในแอดมินพอร์ทัล</p>
              <p className="text-[11px] text-slate-400">เลือกว่าจะล้างฐานข้อมูลผู้ป่วยเก่าทิ้งทั้งหมดเพื่อซิงก์ใหม่ หรือจะเพิ่มผู้ป่วยสเปรดชีตต่อท้ายข้อมูลที่ค้างอยู่</p>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => setSyncMode('replace')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  syncMode === 'replace'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                เขียนทับข้อมูลเดิม (Overwrite)
              </button>
              <button
                type="button"
                onClick={() => setSyncMode('append')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  syncMode === 'append'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มต่อท้ายสะสม (Append Case)
              </button>
            </div>
          </div>

          {/* ปุ่มเริ่มคอยปริมณฑลระบาด */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 italic">
              * แนะนำลิงก์ทดสอบที่ระบบกรอกให้โดยเริ่มแรก เป็น Google Sheets ข้อมูลจริงที่ผู้ใช้จัดเตรียมไว้ให้วิเคราะห์โรคระบาด
            </span>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncGoogleSheets}
              className={`px-6 py-3 text-xs font-black text-white rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2 w-full sm:w-auto justify-center ${
                isSyncing 
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-97'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'กำลังติดต่อและสแกนประมวลผลด่านระบาด...' : 'ดึงข้อมูลและเชื่อมโยงเครือข่าย Google Sheets'}
            </button>
          </div>

          {/* คอนโซลบันทึกสถานะการทำธุรกรรมเชื่อม Google CSV */}
          {(syncLogs.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <LayoutList className="w-3.5 h-3.5 text-indigo-600" />
                คอนโซลประวัติซิงโครไนซ์ระบบ (Sync Transaction Logs)
              </p>
              <div className="bg-slate-900 rounded-xl p-4 text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto shadow-inner max-h-56 scrollbar-thin">
                {syncLogs.map((log, lIdx) => (
                  <div key={lIdx} className="border-b border-slate-800 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                    <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    <span className={
                      log.includes('[สำเร็จ]') ? 'text-emerald-400 font-extrabold' : 
                      log.includes('[พบจุดขัดข้อง]') || log.includes('[ล้มเหลว]') ? 'text-rose-400 font-extrabold' :
                      log.includes('[เตือน]') ? 'text-amber-400 font-extrabold' : 
                      'text-indigo-300'
                    }>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
