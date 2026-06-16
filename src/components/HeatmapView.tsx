/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, DiseaseCategory } from '../types';
import { SATUN_GEOGRAPHY, DISEASE_CATEGORIES, INITIAL_PATIENTS } from '../data/satunData';
import { 
  MapPin, 
  RefreshCw, 
  HeartPulse, 
  ExternalLink, 
  Share2, 
  Copy, 
  Check, 
  ShieldCheck, 
  LogIn, 
  ChevronRight, 
  Users, 
  TrendingUp, 
  AlertCircle,
  Clock,
  History,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ประกาศอินเตอร์เฟซเฉพาะสำหรับตำบลความร้อน
export interface HeatmapArea {
  subDistrict: string;
  district: string;
  count: number;
  patients: Patient[];
  diseaseSummary: { [code: string]: number };
  status: 'green' | 'yellow' | 'orange' | 'red';
}

interface HeatmapViewProps {
  onBackToLogin: () => void;
  categories?: DiseaseCategory[];
  authenticatedRole?: string | null;
}

export default function HeatmapView({ onBackToLogin, categories = DISEASE_CATEGORIES, authenticatedRole }: HeatmapViewProps) {
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('google_heatmap_sheet_id') || '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE';
  });
  
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('satun_patients');
    return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedAreaKey, setSelectedAreaKey] = useState<{ subDistrict: string; district: string } | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [sheetUrlInput, setSheetUrlInput] = useState<string>(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?gid=1433180548`
  );

  const sheetGid = '1433180548'; // Sheet 5 GID

  // ดึง Spreadsheet ID จาก URL
  const extractSpreadsheetId = (url: string): string => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  // โหลดและซิงก์ข้อมูลจาก Google Sheets
  const fetchLivePatientsFromSheet = async (idToUse?: string, isSilent = false) => {
    const targetId = idToUse || spreadsheetId;
    if (!isSilent) {
      setIsLoading(true);
      setErrorMsg(null);
      setSelectedAreaKey(null);
    }

    // หากใช้ไอดี Spreadsheet ตัวอย่างเริ่มต้น ให้ใช้รายการคนไข้ของระบบ (สอดคล้องกับ Sheet5 และโครงร่างในหน้าควบคุมหลัก)
    if (targetId === '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE') {
      const saved = localStorage.getItem('satun_patients');
      const localPatients = saved ? JSON.parse(saved) : INITIAL_PATIENTS;
      setPatients(localPatients);
      setLastUpdated(new Date());
      setIsLoading(false);
      return;
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${targetId}/export?format=csv&gid=${sheetGid}`;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(exportUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`ไม่สามารถเข้าถึง Google Sheets ได้ (HTTP status ${response.status})`);
      }

      const text = await response.text();

      if (text.includes('<!DOCTYPE html>') || text.includes('ServiceLogin') || text.includes('login') || text.includes('DOCTYPE html')) {
        throw new Error(
          'โปรดตรวจสอบว่าได้เปิดสิทธิ์แชร์ไฟล์ Google Sheets นี้เป็น "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน" (Anyone with the link can view) เรียบร้อยแล้ว'
        );
      }

      // พาร์สผู้ป่วยจาก CSV
      const lines = text.split('\n');
      const loadedPatients: Patient[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // แบ่งเว้นด้วย Regex เพื่อรองรับเครื่องหมายคำพูดคู่ (CORS CSV standard)
        const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(item => item.replace(/^"|"$/g, '').trim());
        if (columns.length < 3) continue;

        const rawCid = columns[0] || '';
        const rawAddress = columns[2] || '';
        const rawOnset = columns[3] || '';
        let rawDisease = columns[1] || '';

        // แยกโค้ดโรคและชื่อโรค
        let dCode = 'A90';
        let dName = 'ไข้เลือดออก';
        if (rawDisease.includes(' - ')) {
          const split = rawDisease.split(' - ');
          dCode = split[0].trim();
          dName = split[1].trim();
        } else if (rawDisease.includes(' ')) {
          const split = rawDisease.split(' ');
          dCode = split[0].trim();
          dName = split[1].trim();
        } else {
          dCode = rawDisease.trim();
          const matched = categories.find(c => c.code.toUpperCase() === dCode.toUpperCase());
          if (matched) dName = matched.name;
        }

        // ค้นหาตำแหน่งอำเภอ/ตำบลจากชื่อจังหวัดหรือข้อมูลสตูล
        let detectedDistrict = 'เมืองสตูล';
        let detectedSubDistrict = 'พิมาน';
        let foundGeog = false;

        for (const dist of Object.keys(SATUN_GEOGRAPHY)) {
          for (const sub of SATUN_GEOGRAPHY[dist]) {
            if (rawAddress.includes(sub)) {
              detectedSubDistrict = sub;
              detectedDistrict = dist;
              foundGeog = true;
              break;
            }
          }
          if (foundGeog) break;
        }

        // คลีนชื่อหมู่บ้าน
        let villageClean = rawAddress;
        if (villageClean.includes('ต.')) villageClean = villageClean.split('ต.')[0];
        if (villageClean.includes('ตำบล')) villageClean = villageClean.split('ตำบล')[0];
        villageClean = villageClean.replace(/[,;]+$/, '').trim() || 'หมู่ 1';

        loadedPatients.push({
          id: `live-heatmap-${i}`,
          cidEncrypted: rawCid || 'X-XXXX-XXXXX-XX-X',
          diseaseCode: dCode,
          diseaseName: dName,
          village: villageClean,
          subDistrict: detectedSubDistrict,
          district: detectedDistrict,
          onsetEmanationDate: rawOnset || new Date().toISOString().split('T')[0],
          reportedDate: rawOnset || new Date().toISOString().split('T')[0],
          age: parseInt(columns[4]) || 25,
          gender: columns[5] === 'หญิง' ? 'หญิง' : 'ชาย'
        });
      }

      setPatients(loadedPatients);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Heatmap Data Fetch Error:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets');
    } finally {
      setIsLoading(false);
    }
  };

  // ดึงข้อมูลเมื่อเริ่มแอปครั้งแรกหรือเมื่อ ID เปลี่ยน และตั้งเวลาอัปเดตแบบเรียลไทม์เสมอทุก 3 วินาที
  useEffect(() => {
    fetchLivePatientsFromSheet();

    // สร้างกลไก Live Polling พื้นหลังอัปเดตข้อมูลให้สดใหม่เสมอ (ทั้งเมื่อเผลอแก้ไข/เพิ่มใน LocalStorage หรือ Google Sheet)
    const intervalId = setInterval(() => {
      fetchLivePatientsFromSheet(spreadsheetId, true);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [spreadsheetId]);

  // คำนวณความร้อนและสถานะตำบลแยกรายอำเภอ (4 สี)
  const getSubDistrictHeatmapData = (): HeatmapArea[] => {
    const list: HeatmapArea[] = [];

    Object.keys(SATUN_GEOGRAPHY).forEach(district => {
      SATUN_GEOGRAPHY[district].forEach(subDistrict => {
        // คัดกรองผู้ป่วยของตำบลนี้
        const areaPatients = patients.filter(
          p => p.subDistrict.trim() === subDistrict.trim() && p.district.trim() === district.trim()
        );

        // นับจำนวนรายโรค
        const diseaseSummary: { [code: string]: number } = {};
        areaPatients.forEach(p => {
          diseaseSummary[p.diseaseCode] = (diseaseSummary[p.diseaseCode] || 0) + 1;
        });

        // จัดระดับความเสี่ยงตามสี (🟢, 🟡, 🟠, 🔴)
        // 🟢 เขียว (เสี่ยงต่ำ) = ผู้ป่วยน้อยกว่ากลุ่มสีเหลือง (0 คน)
        // 🟡 เหลือง (เฝ้าระวัง) = เริ่มมีผู้ป่วย (1-2 คน)
        // 🟠 ส้ม (เสี่ยงปานกลาง) = ผู้ป่วยเพิ่มขึ้น (3-5 คน)
        // 🔴 แดง (เสี่ยงสูง) = ผู้ป่วยมาก (ตั้งแต่ 6 คนขึ้นไป)
        let status: 'green' | 'yellow' | 'orange' | 'red' = 'green';
        const total = areaPatients.length;

        if (total >= 6) {
          status = 'red';
        } else if (total >= 3) {
          status = 'orange';
        } else if (total >= 1) {
          status = 'yellow';
        }

        list.push({
          subDistrict,
          district,
          count: total,
          patients: areaPatients,
          diseaseSummary,
          status
        });
      });
    });

    return list;
  };

  const heatmapData = getSubDistrictHeatmapData();
  const selectedArea = selectedAreaKey 
    ? heatmapData.find(h => h.subDistrict === selectedAreaKey.subDistrict && h.district === selectedAreaKey.district) || null
    : null;

  const setSelectedArea = (area: HeatmapArea | null) => {
    if (area) {
      setSelectedAreaKey({ subDistrict: area.subDistrict, district: area.district });
    } else {
      setSelectedAreaKey(null);
    }
  };

  // จัดพิกัดการจัดวาง Grid ทางภูมิศาสตร์ของสตูลให้สวยงาม
  const DISTRICT_POSITIONS: { [district: string]: { gridClass: string; desc: string; theme: string } } = {
    'ทุ่งหว้า': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-1 lg:col-start-1', desc: 'ตอนเหนือสุดชายฝั่งทะเลอันดามัน ติดจังหวัดตรัง', theme: 'border-cyan-100 bg-cyan-50/20' },
    'มะนัง': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-1 lg:col-start-6', desc: 'ฝั่งตะวันออกแผ่นดิน หุบเขาและป่าไม้', theme: 'border-emerald-100 bg-emerald-50/20' },
    'ละงู': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-7 xl:col-span-6 lg:row-start-2 lg:col-start-1', desc: 'เมืองท่องเที่ยวชายฝั่ง เกาะหลีเป๊ะ และปากน้ำ', theme: 'border-sky-100 bg-sky-50/20' },
    'ควนกาหลง': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-2 lg:col-start-7', desc: 'ตอนกลางสวนยางพารา แหล่งปะปรายนกแอร์', theme: 'border-amber-100 bg-amber-50/20' },
    'ท่าแพ': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-3 lg:col-start-2', desc: 'เส้นทางเชื่อมระเบียงเศรษฐกิจปีกตะวันตก', theme: 'border-indigo-100 bg-indigo-50/20' },
    'ควนโดน': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-3 lg:col-start-7', desc: 'ชายแดนติดประเทศมาเลเซีย ด่านวังประจัน', theme: 'border-blue-100 bg-blue-50/20' },
    'เมืองสตูล': { gridClass: 'col-span-12 md:col-span-12 lg:col-span-10 xl:col-span-8 lg:row-start-4 lg:col-start-2', desc: 'ศูนย์กลางราชการ เกาะสาหร่าย และท่าเรือเจ๊ะบิลัง', theme: 'border-slate-100 bg-slate-50/20' }
  };

  const getHeatmapColorClasses = (status: 'green' | 'yellow' | 'orange' | 'red') => {
    switch (status) {
      case 'red':
        return {
          bg: 'bg-rose-50 hover:bg-rose-100 border-rose-300',
          dot: 'bg-rose-500 animate-ping',
          indicator: 'bg-rose-500',
          text: 'text-rose-900',
          badge: 'bg-rose-500 text-white',
          label: '🔴 เสี่ยงสูง (ผู้ป่วย 6 คนขึ้นไป)'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50 hover:bg-orange-100 border-orange-300',
          dot: 'bg-orange-500 animate-pulse',
          indicator: 'bg-orange-500',
          text: 'text-orange-900',
          badge: 'bg-orange-500 text-white',
          label: '🟠 เสี่ยงปานกลาง (ผู้ป่วย 3-5 คน)'
        };
      case 'yellow':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
          dot: 'bg-amber-400',
          indicator: 'bg-amber-400',
          text: 'text-amber-900',
          badge: 'bg-amber-500 text-slate-900',
          label: '🟡 เฝ้าระวัง (เริ่มมีผู้ป่วย 1-2 คน)'
        };
      case 'green':
      default:
        return {
          bg: 'bg-emerald-50/30 hover:bg-emerald-50 border-emerald-100',
          dot: 'bg-emerald-400',
          indicator: 'bg-emerald-400',
          text: 'text-emerald-800',
          badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
          label: '🟢 เสี่ยงต่ำ (ไม่มีผู้ป่วย)'
        };
    }
  };

  // คัดลอกลิงก์แชร์
  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=heatmap`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ยืนยันการเปลี่ยนแปลง Google Sheet ID แอดมิน
  const handleUpdateSheetSource = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = extractSpreadsheetId(sheetUrlInput);
    if (newId) {
      setSpreadsheetId(newId);
      localStorage.setItem('google_heatmap_sheet_id', newId);
      setShowConfig(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen">
      {/* ส่วนหัว Heatmap Landing Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-900/30">
              <HeartPulse className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-0.5 px-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[9.5px] font-black tracking-widest font-mono uppercase">
                  PUBLIC HEATMAP
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] text-emerald-400 font-bold hidden xs:inline">เชื่อมต่อสด Sheet5</span>
              </div>
              <h1 className="text-sm sm:text-base font-black tracking-tight mt-0.5">
                ระบบแผนภูมิความร้อนและเฝ้าระวังภูมิศาสตร์สตูล (GIS Tracker)
              </h1>
            </div>
          </div>

          {/* ปุ่มควบคุมด้านขวา */}
          <div className="flex items-center gap-2">
            
            {/* รีโหลดแบบด่วน */}
            <button
              onClick={() => fetchLivePatientsFromSheet()}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 border border-slate-700"
              title="ดึงข้อมูลความร้อนทันใจจาก Google Sheets ล่าสุด"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              โหลดใหม่
            </button>

            {/* คัดลอกลิงก์แชร์ */}
            <button
              onClick={handleCopyLink}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700"
              title="คัดลอกลิงก์สำหรับส่งต่อให้ผู้อื่นเข้าชมผลแผนที่ภูมิศาสตร์นี้ได้"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'คัดลอกแล้ว!' : 'แชร์ลิงก์'}
            </button>

            {/* แอดมินตั้งค่าลิงก์ชีต */}
            {authenticatedRole === 'it_provincial' && (
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                เปลี่ยนชีต
              </button>
            )}

            <span className="w-px h-6 bg-slate-800 mx-1" />

            {/* กลับสู่ระบบ Secure portal */}
            <button
              onClick={onBackToLogin}
              className="p-2.5 px-4 bg-indigo-600 hover:bg-indigo-505 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-indigo-950/40"
            >
              <LogIn className="w-3.5 h-3.5" />
              ออกจากหน้า Heatmap
            </button>
          </div>

        </div>
      </header>

      {/* บาร์เตือนสีความเสี่ยง */}
      <div className="bg-slate-900 border-b border-slate-850 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1 font-mono text-[10.5px]">
            <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>อัปเดตแกนนำจาก Sheet5: </span>
            {lastUpdated ? (
              <span className="text-white font-bold">{lastUpdated.toLocaleString('th-TH')}</span>
            ) : (
              <span className="text-amber-400">กำลังเชื่อมต่อข้อมูล...</span>
            )}
            <span className="text-slate-500 ml-1">({patients.length} ระเบียนผู้ป่วย)</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-sans">
            <span className="font-semibold text-slate-500">ระดับความเสี่ยง:</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              🟢 เขียว (เสี่ยงต่ำ)
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              🟡 เหลือง (เฝ้าระวัง 1-2 ราย)
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
              🟠 ส้ม (เสี่ยงปานกลาง 3-5 ราย)
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
              🔴 แดง (เสี่ยงสูง 6 รายขึ้นไป)
            </span>
          </div>
        </div>
      </div>

      {/* ส่วนแสดงหลัก Main Map Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ตู้ตั้งค่า Google Sheets แหล่งข้อมูล */}
        <AnimatePresence>
          {showConfig && authenticatedRole === 'it_provincial' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <form onSubmit={handleUpdateSheetSource} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                      ตั้งค่า Google Sheets เป้ายอดบันทึกข้อมูล (สำหรับแอดมินหรือผู้ตรวจสอบ)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      ท่านสามารถป้อน ลิงก์เบราว์เซอร์ของ Google Sheets ที่แชร์เป็นสาธารณะ เพื่อให้ระบบเปลี่ยนไปคำนวณและวัดความร้อนจากไฟล์ของท่านได้โดยสะดวก
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConfig(false)}
                    className="text-slate-500 hover:text-white px-2 cursor-pointer"
                  >
                    ปิด
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-9 space-y-1.5">
                    <label className="text-[10.5px] font-bold text-slate-350">ที่อยู่ Google Sheet สำหรับประมวล Heatmap (ต้องเปิด share เป็น Anyone with the link can view เท่านั้น)</label>
                    <input
                      type="text"
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      placeholder="เช่น https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 text-xs text-slate-200 font-mono outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      เชื่อมโยงไฟล์ชุดนี้
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ข้อมูลแสดงความล้มเหลว หรือกำลังโหลด */}
        {isLoading ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-850 p-16 text-center space-y-4 shadow-xl">
            <RefreshCw className="w-10 h-10 mx-auto text-rose-500 animate-spin" />
            <div>
              <p className="font-bold text-slate-200">กำลังสแกนวิเคราะห์ประเด็นผู้ป่วยจาก Google Sheet 5...</p>
              <p className="text-xs text-slate-500 mt-1">อ่านข้อมูลเปรียบเทียบพิกัดตำบล ละงู ทุ่งหว้า มะนัง เมืองสตูล ควนโดน ท่าแพ เพื่อร่างแผนภูมิระเบิดความร้อน</p>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="bg-rose-950/40 border border-rose-900/50 rounded-2xl p-6 text-slate-200 space-y-3 shadow-lg">
            <div className="flex items-center gap-2 text-rose-400 font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>ไม่สามารถซิงก์ดึงข้อมูลความร้อนได้สำเร็จ</span>
            </div>
            <p className="text-xs text-rose-300/90 leading-relaxed font-sans font-medium">
              เหตุขัดข้อง: <span className="font-mono bg-slate-950/70 p-1 px-2 rounded ml-1 text-[11px]">{errorMsg}</span>
            </p>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-rose-950/60 flex flex-wrap gap-3">
              <button 
                onClick={() => fetchLivePatientsFromSheet()}
                className="text-rose-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> ลองอีกครั้ง
              </button>
              <button 
                onClick={() => {
                  setSpreadsheetId('1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE');
                  setSheetUrlInput('https://docs.google.com/spreadsheets/d/1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE/edit?gid=1433180548');
                  fetchLivePatientsFromSheet('1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE');
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                คืนค่าลิงก์ชีตทดสอบของระบบ
              </button>
            </div>
          </div>
        ) : (
          /* สองฝั่งซ้ายขวา: ฝั่งขวาแสดงแถบลอยแสดงข้อมูลผู้ป่วย ฝั่งซ้ายคือตัวแผนที่ */
          <div className="grid grid-cols-12 gap-6 items-start">
            
            {/* ฝั่งซ้าย: แผนพิกัดภูมิศาสตร์ ( col-span-12 lg:col-span-8 ) */}
            <div className="col-span-12 lg:col-span-8 space-y-5">
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-850 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="border-b border-slate-800 pb-3 mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px] font-bold">GRID MAP V2</span>
                    <h2 className="text-sm font-bold text-white">แผงพิกัดทางภูมิศาสตร์จังหวัดสตูล (4 ระดับความเสี่ยง)</h2>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    คลิกในแผนผังเพื่อดูผู้ป่วยในแต่ละตำบลอย่างละเอียด
                  </span>
                </div>

                {/* Grid ตารางแผนที่สตูล */}
                <div className="grid grid-cols-12 gap-5">
                  {Object.keys(DISEASE_CATEGORIES).length > 0 && Object.keys(SATUN_GEOGRAPHY).map(district => {
                    const dConfig = DISTRICT_POSITIONS[district] || { gridClass: 'col-span-12', desc: '', theme: 'bg-slate-850' };
                    const subDistricts = SATUN_GEOGRAPHY[district];

                    // ตรวจจับผู้ติดเชื้อรวมในอำเภอนี้
                    const dPatientsCount = heatmapData.filter(s => s.district === district).reduce((sum, item) => sum + item.count, 0);

                    return (
                      <motion.div
                        layout
                        key={district}
                        className={`${dConfig.gridClass} rounded-2xl border border-slate-800 p-4 transition-all hover:border-slate-700 flex flex-col justify-between ${dConfig.theme}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-black text-slate-100 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                อ. {district}
                              </h4>
                              <p className="text-[9px] text-slate-400 mt-1 leading-tight line-clamp-1">
                                {dConfig.desc}
                              </p>
                            </div>
                            {dPatientsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/25 shrink-0">
                                รวม {dPatientsCount} ราย
                              </span>
                            )}
                          </div>

                          {/* ตำบลทั้งหมด */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                            {subDistricts.map(subDist => {
                              const areaHeat = heatmapData.find(h => h.subDistrict === subDist && h.district === district);
                              if (!areaHeat) return null;

                              const isSelected = selectedArea?.subDistrict === subDist && selectedArea?.district === district;
                              const theme = getHeatmapColorClasses(areaHeat.status);

                              return (
                                <button
                                  key={subDist}
                                  onClick={() => setSelectedArea(areaHeat)}
                                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all ${theme.bg} ${
                                    isSelected 
                                      ? 'ring-2 ring-rose-500 border-rose-400 shadow-lg scale-[1.03]' 
                                      : 'shadow-xs hover:scale-[1.01]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 w-full">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 tracking-tight leading-none group-hover:text-rose-500">
                                      ต.{subDist}
                                    </span>
                                    <span className="flex h-2 w-2 relative shrink-0">
                                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.dot}`} />
                                      <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.indicator}`} />
                                    </span>
                                  </div>

                                  <div className="flex items-baseline justify-between mt-3 font-mono">
                                    <span className="text-[8.5px] text-slate-500">ผู้ป่วย:</span>
                                    <span className="text-xs font-black text-slate-950">
                                      {areaHeat.count} ราย
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ฝั่งขวา: แถบลอยแสดงข้อมูลรายละเอียดเมื่อคลิก ( col-span-12 lg:col-span-4 ) */}
            <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-24">
              <AnimatePresence mode="wait">
                {selectedArea ? (
                  <motion.div
                    key="detail-panel"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-5"
                  >
                    {/* ส่วนหัวรายละเอียด */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[9.5px] font-black text-slate-500 tracking-widest uppercase block font-mono">
                          📍 ข้อมูลจุดประมวลแผนที่
                        </span>
                        <h3 className="text-base font-extrabold text-white mt-1">
                          ต. {selectedArea.subDistrict} <span className="text-slate-400 text-xs font-normal">อ. {selectedArea.district}</span>
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedArea(null)}
                        className="text-slate-500 hover:text-white text-xs border border-slate-800 hover:border-slate-700 p-1 px-2 rounded-lg transition-all cursor-pointer"
                      >
                        ปิดแถบนี้
                      </button>
                    </div>

                    {/* แสดงป้ายสถานะความเสี่ยงล่าสุด */}
                    <div className="p-3 bg-slate-950 rounded-2xl border border-slate-850 flex items-center justify-between">
                      <span className="text-xs text-slate-400">สถานะความเสี่ยงทางระบาด:</span>
                      <span className={`text-[10px] font-black p-1 px-2.5 rounded-lg border ${
                        selectedArea.status === 'red' ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 animate-pulse' :
                        selectedArea.status === 'orange' ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' :
                        selectedArea.status === 'yellow' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      }`}>
                        {selectedArea.status === 'red' ? '🔴 เสี่ยงสูงมาก (ระบาดหนัก)' :
                         selectedArea.status === 'orange' ? '🟠 เสี่ยงปานกลาง' :
                         selectedArea.status === 'yellow' ? '🟡 เฝ้าระวัง' :
                         '🟢 เสี่ยงต่ำ (สถานะสีเขียว)'}
                      </span>
                    </div>

                    {/* ยอดผู้ป่วยรวม */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950 p-3 rounded-2xl text-center border border-slate-850">
                        <span className="text-[10px] text-slate-500 block">ผู้ป่วยรวมสะสม</span>
                        <span className="text-2xl font-black font-mono text-white mt-1 block">
                          {selectedArea.count}
                        </span>
                        <span className="text-[9.5px] text-slate-400">รายในชีตที่ 5</span>
                      </div>
                      
                      <div className="bg-slate-950 p-3 rounded-2xl text-center border border-slate-850 flex flex-col justify-center items-center">
                        <span className="text-[10px] text-slate-500 block">จำนวนกลุ่มโรคที่มีกรณี</span>
                        <span className="text-lg font-black font-mono text-rose-400 mt-1 block">
                          {Object.keys(selectedArea.diseaseSummary).length}
                        </span>
                        <span className="text-[10px] text-slate-400">โรคที่เฝ้าระวัง</span>
                      </div>
                    </div>

                    {/* สรุปตามรายโรค (Disease breakdown) */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-black text-slate-350 tracking-wider uppercase flex items-center gap-1.5 font-mono">
                        📊สัดส่วนจำแนกตามประเภทกลุ่มโรค
                      </h4>
                      {Object.keys(selectedArea.diseaseSummary).length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                          - ไม่มีประวัติโรคติดต่อในสองสัปดาห์ล่าสุด -
                        </p>
                      ) : (
                        <div className="space-y-2.5 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-850">
                          {Object.keys(selectedArea.diseaseSummary).map(code => {
                            const count = selectedArea.diseaseSummary[code];
                            const percentage = Math.round((count / selectedArea.count) * 100);
                            const matchedCat = categories.find(c => c.code.toUpperCase() === code.toUpperCase());
                            const name = matchedCat ? matchedCat.name : code;

                            return (
                              <div key={code} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-200">{name} <code className="bg-slate-800 p-0.5 px-1 rounded text-[9.5px] font-mono text-slate-400">{code}</code></span>
                                  <span className="font-mono font-black text-white">{count} ราย ({percentage}%)</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      selectedArea.status === 'red' ? 'bg-rose-500' :
                                      selectedArea.status === 'orange' ? 'bg-orange-500' :
                                      'bg-amber-400'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* รายการประวัติคนไข้ในตำบลชุดนี้ */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black text-slate-350 tracking-wider uppercase flex items-center gap-1.5 font-mono">
                          👤 ข้อมูลผู้ประเมินรายคน (Sheet5)
                        </h4>
                        <span className="text-[9.5px] text-slate-500">จำกัด 10 แถวล่าสุด</span>
                      </div>
                      {selectedArea.patients.length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center p-4 border border-dashed border-slate-850 rounded-2xl">
                          ไม่มีรายชื่อผู้ใช้บริการคัดกรองปฐมภูมิในพื้นที่นี้
                        </p>
                      ) : (
                        <div className="max-h-[170px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {selectedArea.patients.slice(0, 10).map((p, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 flex items-start justify-between gap-3 text-[11px] hover:border-slate-800">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-300">{p.cidEncrypted}</span>
                                  <span className={`p-0.5 px-1.5 rounded text-[8.5px] font-bold ${
                                    p.gender === 'หญิง' ? 'bg-pink-955 bg-pink-950/40 text-pink-400 border border-pink-500/10' :
                                    'bg-blue-955 bg-blue-950/40 text-blue-400 border border-blue-500/10'
                                  }`}>
                                    {p.gender} {p.age} ปี
                                  </span>
                                </div>
                                <p className="text-slate-400 text-[10px]">{p.diseaseName}</p>
                                <p className="text-[9px] text-slate-500 font-mono">📍 {p.village}</p>
                              </div>

                              <span className="text-[9.5px] text-indigo-400 font-mono bg-indigo-950/40 p-1 rounded border border-indigo-950 shrink-0">
                                {p.onsetEmanationDate}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </motion.div>
                ) : (
                  <div className="bg-slate-900 border border-dashed border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs shadow-xl space-y-3.5">
                    <MapPin className="w-8 h-8 text-slate-700 mx-auto animate-bounce" />
                    <div>
                      <p className="font-bold text-slate-350">ยังไม่ได้เจาะลึกตำบลใดปุ่มสี</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        คลิกสัญลักษณ์วงกลมสีบนแผนที่ทางด้านซ้าย เพื่อแผ่ออกความเสี่ยงแบบจำกัดพิกัด ดูบัญชีโรคระเบียน และรายชื่อลูกบ้านผู้ป่วยแบบคัดแยกสดทันที
                      </p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}

      </main>

      {/* ส่วนท้ายแสดงการดูแลระบบ */}
      <footer className="bg-slate-900 text-slate-500 text-[10.5px] py-5 border-t border-slate-850 text-center font-sans space-y-1 mt-auto">
        <p className="font-black text-slate-400">ศูนย์ประสานงานสารสนเทศและแผนที่ภูมิศาสตร์ สสจ.สตูล (PHEOC Satun Map Hub)</p>
        <p>สร้างแผนภาพโดย Apps Script ดึงเชื่อมขีดคดี Sheet5 บน Google Sheets เพื่อความโปร่งใสและตรวจสอบได้</p>
      </footer>
    </div>
  );
}
