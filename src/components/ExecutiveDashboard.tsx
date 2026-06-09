/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AreaStatus, Patient, AreaResource, DispatchCommand, DiseaseCategory, PredictiveAlert } from '../types';
import { SATUN_GEOGRAPHY, DISEASE_CATEGORIES } from '../data/satunData';
import { 
  Award, ShieldAlert, Calendar, LayoutDashboard, Truck, 
  CheckCircle, Hammer, Info, RotateCcw, Send, Plus, 
  PlusCircle, AlertCircle, ShoppingBag, Eye, User, FileText,
  MapPin, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import InteractiveMap from './InteractiveMap';

interface ExecutiveDashboardProps {
  patients: Patient[];
  areaStatuses: AreaStatus[];
  resources: AreaResource[];
  commands: DispatchCommand[];
  alerts: PredictiveAlert[];
  onAddCommand: (cmd: DispatchCommand) => void;
  onUpdateResource: (subDistrict: string, district: string, updatedFields: Partial<AreaResource>) => void;
  onResolveAlert: (id: string) => void;
}

export default function ExecutiveDashboard({
  patients,
  areaStatuses,
  resources,
  commands,
  alerts,
  onAddCommand,
  onUpdateResource,
  onResolveAlert
}: ExecutiveDashboardProps) {
  // ควบคุมการฟิลเตอร์และเลือกพื้นที่แสดงข้อมูลหลักบน Dashboard
  const [selectedArea, setSelectedArea] = useState<{ subDistrict: string; district: string } | null>(null);

  // การสั่งการ dispatch
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<{ subDistrict: string; district: string } | null>(null);
  
  // สถานะฟอร์มจัดส่งทรัพยากร
  const [commandTitle, setCommandTitle] = useState('');
  const [urgency, setUrgency] = useState<'medium' | 'high' | 'critical'>('medium');
  const [abateQty, setAbateQty] = useState(100);
  const [chemicalQty, setChemicalQty] = useState(10);
  const [maskQty, setMaskQty] = useState(200);
  const [staffQty, setStaffQty] = useState(2);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [senderName, setSenderName] = useState('นพ. ชินสิทธิ์ บริบาล');
  const [senderRole, setSenderRole] = useState('หัวหน้าฝ่ายสอบสวนโรคติดต่อ สสจ.สตูล');

  // แท็บบอร์ดคำสั่งที่จัดส่งแล้ว
  const [commandFilter, setCommandFilter] = useState<'ทั้งหมด' | 'pending' | 'received' | 'completed'>('ทั้งหมด');

  // สำหรับการอัปเดตสถานะการกำกับดูแลโรคโดยผู้ใช้งานโดยตรงในแผงควบคุม
  const currentResource = selectedArea 
    ? resources.find(r => r.subDistrict === selectedArea.subDistrict && r.district === selectedArea.district)
    : null;

  const handleSelectArea = (subDistrict: string, district: string) => {
    if (!subDistrict || !district) {
      setSelectedArea(null);
    } else {
      setSelectedArea({ subDistrict, district });
    }
  };

  // กรองผู้ป่วยที่สอดคล้องกับพื้นที่ที่กำลังเลือกอยู่
  const selectedAreaPatients = selectedArea 
    ? patients.filter(p => p.subDistrict === selectedArea.subDistrict && p.district === selectedArea.district)
    : patients;

  // แบ่งกลุ่มช่วงอายุของผู้ป่วย (เด็ก, ผู้ใหญ่, ผู้สูงวัย)
  const getAgeStatistics = (pList: Patient[]) => {
    let children = 0; // 0-14
    let adults = 0;   // 15-59
    let elderly = 0;  // 60+
    pList.forEach(p => {
      if (p.age <= 14) children++;
      else if (p.age <= 59) adults++;
      else elderly++;
    });
    return { children, adults, elderly };
  };

  const ageData = getAgeStatistics(selectedAreaPatients);

  // คำนวณจำแนกรายโรคสำหรับพื้นที่ที่เลือก
  const getDiseaseCounts = (pList: Patient[]) => {
    const summary: { [name: string]: number } = {};
    pList.forEach(p => {
      summary[p.diseaseName] = (summary[p.diseaseName] || 0) + 1;
    });
    return Object.keys(summary).map(name => ({ name, count: summary[name] }));
  };

  const diseaseCounts = getDiseaseCounts(selectedAreaPatients);

  // เปิดแบบฟอร์มออกใบส่งมอบงานกระจายทรัพยากร
  const openDispatchDialog = (subDist: string, dist: string) => {
    setDispatchTarget({ subDistrict: subDist, district: dist });
    
    // ตั้งชื่อคำสั่งโดยอัตโนมัติตามโจทย์โรคที่มีผู้ป่วยสูงในขณะนั้น
    const areaStat = areaStatuses.find(s => s.subDistrict === subDist && s.district === dist);
    let defaultTitle = `ชุดภารกิจสนับสนุนสาธารณสุข ต.${subDist}`;
    if (areaStat) {
      // หาคีย์โรคที่มีจำนวนผู้ป่วยมากที่สุด
      let maxQty = 0;
      let maxCode = '';
      Object.keys(areaStat.diseaseSummary).forEach(code => {
        if (areaStat.diseaseSummary[code] > maxQty) {
          maxQty = areaStat.diseaseSummary[code];
          maxCode = code;
        }
      });
      const matchCat = DISEASE_CATEGORIES.find(c => c.code === maxCode);
      if (matchCat && maxQty > 0) {
        defaultTitle = `ควบคุมการแพร่ระบาดแฝง ${matchCat.name.split(' ')[0]} ต.${subDist}`;
      }
    }
    setCommandTitle(defaultTitle);
    setIsDispatchModalOpen(true);
  };

  // ยืนยันการส่งดิสแพตช์ทรัพยากร
  const handleSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchTarget) return;

    const itemsList = [
      { name: 'ทรายกำจัดลูกน้ำอะเบท', quantity: abateQty, unit: 'ซอง' },
      { name: 'สารเคมีกำจัดยุงผสมพ่น', quantity: chemicalQty, unit: 'ลิตร' },
      { name: 'หน้ากากอนามัยอนามัยทางการแพทย์', quantity: maskQty, unit: 'ชิ้น' },
      { name: 'ทีมเจ้าหน้าที่สนับสนุนพิเศษสำรอง', quantity: staffQty, unit: 'คน' }
    ].filter(item => item.quantity > 0);

    const nowStr = new Date().toISOString();
    const newCommand: DispatchCommand = {
      id: `CMD-${Date.now().toString().slice(-4)}`,
      targetSubDistrict: dispatchTarget.subDistrict,
      targetDistrict: dispatchTarget.district,
      commandTitle: commandTitle || `ชุดภารกิจ ต.${dispatchTarget.subDistrict}`,
      urgency,
      items: itemsList,
      instructions: additionalInstructions || 'ขอให้ร่วมมือกับเจ้าหน้าที่ รพ.สต. และ อสม. เพื่อเร่งสแกนพื้นที่ควบคุมแหล่งระบาดอย่างเร็วที่สุด',
      status: 'pending',
      senderName,
      senderRole,
      createdAt: nowStr,
      updatedAt: nowStr
    };

    onAddCommand(newCommand);

    // ดำเนินการอัปเดตรองสถานะความพร้อมทรัพยากรของตำบลเป้าหมายโดยอัตโนมัติ (เช่น เปลี่ยนทรายจาก 'no' เป็น 'yes' และกำลังพ่นยาเป็น 'yes'/'partial' ไปเลย!)
    onUpdateResource(dispatchTarget.subDistrict, dispatchTarget.district, {
      abateSandApplied: abateQty > 0 ? 'yes' : 'partial',
      foggingDone: chemicalQty > 0 ? 'yes' : 'partial',
      medicalStaffAssigned: 'yes',
      lastUpdated: nowStr.split('T')[0]
    });

    // รีเซ็ตตัวแปรฟอร์ม
    setIsDispatchModalOpen(false);
    setAdditionalInstructions('');
    setAbateQty(100);
    setChemicalQty(10);
    setMaskQty(200);
    setStaffQty(2);
  };

  // คำนวณตัวชี้วัดด่วน
  const totalPatientsRecent = areaStatuses.reduce((acc, curr) => acc + curr.currentCount, 0);
  const totalAlertsWarning = alerts.filter(a => !a.resolved).length;
  const redAlertAreas = areaStatuses.filter(a => a.status === 'red').length;
  const yellowAlertAreas = areaStatuses.filter(a => a.status === 'yellow').length;

  return (
    <div className="space-y-6">
      
      {/* สรุปตัวเลขสถิติภาพรวมด่วนระดับผู้บริหาร (Executive Overview Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div id="stat-card-total-cases" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">ผู้ป่วยสะสมปักษ์ล่าสุด</p>
            <p className="text-2xl font-black text-slate-950 mt-0.5 font-mono">{totalPatientsRecent} <span className="text-xs text-slate-500 font-normal">ราย</span></p>
          </div>
        </div>

        <div id="stat-card-red-zones" className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex items-center gap-4">
          <div className="p-3 bg-rose-500 text-white rounded-xl shrink-0 animate-pulse-slow">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-rose-500 tracking-wider uppercase">พื้นที่วิกฤต (สีแดง)</p>
            <p className="text-2xl font-black text-rose-950 mt-0.5 font-mono">{redAlertAreas} <span className="text-xs text-rose-700 font-normal">ตำบล</span></p>
          </div>
        </div>

        <div id="stat-card-yellow-zones" className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex items-center gap-4">
          <div className="p-3 bg-amber-400 text-slate-900 rounded-xl shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-600 tracking-wider uppercase">พื้นที่สังเกตการณ์ (เหลือง)</p>
            <p className="text-2xl font-black text-amber-950 mt-0.5 font-mono">{yellowAlertAreas} <span className="text-xs text-amber-700 font-normal">ตำบล</span></p>
          </div>
        </div>

        <div id="stat-card-alerts" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">แผนส่งทุนปราบโรค</p>
            <p className="text-2xl font-black text-slate-950 mt-0.5 font-mono">{commands.length} <span className="text-xs text-slate-500 font-normal">คำสั่ง</span></p>
          </div>
        </div>

      </div>

      {/* แผนที่จำลอง GIS และตัวชี้วัดความเสี่ยงในแผนที่ */}
      <InteractiveMap 
        areaStatuses={areaStatuses} 
        onSelectArea={handleSelectArea} 
        selectedArea={selectedArea} 
      />

      {/* แผงทำคลายปัญหากล่องข้อความแจ้งเตือนพื้นที่เสี่ยงภัยตามข้อกำหนด flowchart (Predictive Alert Area Boxes) */}
      <div id="predictive-alert-system-container" className="bg-gradient-to-r from-red-50 to-amber-50 rounded-2xl border border-red-100/70 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-500 text-white rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                ระบบคำนวณและคาดการณ์แจ้งเตือนภัยพื้นที่เสี่ยง (Predictive Alert System)
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                ปัญญาประดิษฐ์ประมวลผลสัปดาห์ต่อสัปดาห์ดึงค่าเบี่ยงเบนสะสมผิดปกติเพื่อแจ้งกล่องสัญญาณเตือนเจ้าหน้าที่ด่วน
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold tracking-wider bg-rose-100 px-2 py-1 text-rose-700 rounded-md">
            มีภัยรอการรับมือ {totalAlertsWarning} รายการ
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.filter(a => !a.resolved).length === 0 ? (
            <div className="col-span-1 md:col-span-2 bg-white/75 border border-dashed border-emerald-200 rounded-xl p-6 text-center text-emerald-800 text-xs flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              ขณะนี้ไม่มีกล่องแจ้งเตือนพื้นที่เสี่ยงในระบบ จังหวัดสตูลสถานการณ์ระบาดสงบนิ่งเป็นลบ
            </div>
          ) : (
            alerts.filter(a => !a.resolved).map(alert => (
              <motion.div
                layout
                id={`alert-card-${alert.id}`}
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-xl border bg-white flex flex-col justify-between gap-3 shadow-xs hover:shadow-md transition-shadow ${
                  alert.severity === 'red' ? 'border-l-4 border-l-rose-500 border-rose-100' : 'border-l-4 border-l-amber-500 border-amber-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      ต.{alert.subDistrict} (อ.{alert.district})
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full uppercase ${
                      alert.severity === 'red' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {alert.severity === 'red' ? 'วิกฤตระบาดแดง' : 'เฝ้าระวังเหลือง'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans mt-2 font-medium">
                    {alert.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-50 justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    คลาวด์วิเคราะห์: {new Date(alert.createdAt).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDispatchDialog(alert.subDistrict, alert.district)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                    >
                      <Send className="w-3 h-3" /> สั่งการกระจายทรัพยากร
                    </button>
                    <button
                      onClick={() => onResolveAlert(alert.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200/50 text-[11px] text-slate-600 font-bold transition-all cursor-pointer"
                      title="รับทราบความเสี่ยงนี้แล้วและดำเนินสลัดจากกล่องคุม"
                    >
                      ปิดรับทราบ
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* รายละเอียดเจาะลึกเฉพาะตำบลที่ระบุกดเลือก (Detailed Sub-district Inspection Panel) */}
      <div id="area-detailed-inspector-card" className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3.5 gap-2">
          <div>
            <span className="text-[10px] font-black tracking-wider bg-slate-100 px-2 py-1 text-slate-600 rounded text-slate-500 uppercase">
              ข้อมูลวิเคราะห์สถานการณ์พื้นที่เจาะลึก รายย่อย
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
              {selectedArea 
                ? `ต.${selectedArea.subDistrict} (อำเภอ${selectedArea.district})` 
                : 'ข้อมูลทั้งจังหวัดสตูล (รวมทุกอำเภอ)'}
            </h3>
          </div>
          {selectedArea && (
            <button
              onClick={() => openDispatchDialog(selectedArea.subDistrict, selectedArea.district)}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" /> กดปุ่มสั่งการ / กระจายทรัพยากรสู้ภัย
            </button>
          )}
        </div>

        {/* ผู้ป่วยจำแนกแยกประเภทอายุ และการประสานจัดการทรัพยากรชุมชน */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ฝั่งสถิติอายุ และโรค สะสม */}
          <div className="md:col-span-7 space-y-5">
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-500" />
              จำแนกปริมาณผู้ป่วยแยกตามกลุ่มอายุและสถิติสะสมโรค
            </h4>

            {selectedAreaPatients.length === 0 ? (
              <div className="bg-slate-50/50 rounded-xl p-8 text-center text-slate-400 text-xs">
                ไม่มีผู้ป่วยระบุในพื้นที่ที่เลือกในช่วง 2 สัปดาห์ล่าสุด
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {/* วงกลม/หลอดสกีสำหรับเด็ก (ปกติเด็กโดนมือจับปาก) */}
                <div className="bg-slate-50/50 p-3.5 border border-slate-100/70 rounded-xl text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 leading-tight">กลุ่มเยาวชนเด็ก<br />(0-14 ปี)</p>
                  <p className="text-xl font-black font-mono text-indigo-755 leading-none pt-1">
                    {ageData.children} <span className="text-[10px] font-normal text-slate-500">คน</span>
                  </p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div 
                      className="bg-sky-500 h-full rounded-full" 
                      style={{ width: `${Math.max(5, (ageData.children / selectedAreaPatients.length) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* หลอดสกีสำหรับผู้ใหญ่ */}
                <div className="bg-slate-50/50 p-3.5 border border-slate-100/70 rounded-xl text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 leading-tight">กลุ่มวัยแรงงาน<br />(15-59 ปี)</p>
                  <p className="text-xl font-black font-mono text-indigo-755 leading-none pt-1">
                    {ageData.adults} <span className="text-[10px] font-normal text-slate-500">คน</span>
                  </p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div 
                      className="bg-indigo-500 h-full rounded-full" 
                      style={{ width: `${Math.max(5, (ageData.adults / selectedAreaPatients.length) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* หลอดสกีสำหรับผู้สูงอายุ */}
                <div className="bg-slate-50/50 p-3.5 border border-slate-100/70 rounded-xl text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 leading-tight">กลุ่มผู้สูงอายุ<br />(60 ปีขึ้นไป)</p>
                  <p className="text-xl font-black font-mono text-indigo-755 leading-none pt-1">
                    {ageData.elderly} <span className="text-[10px] font-normal text-slate-500">คน</span>
                  </p>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                    <div 
                      className="bg-rose-400 h-full rounded-full" 
                      style={{ width: `${Math.max(5, (ageData.elderly / selectedAreaPatients.length) * 100)}%` }} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* แสดงตาราง/สรุปการจำแนกตามประเภทของโรค */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                สรุปสแกนปริมาณผู้ป่วยสะสมแยกรายประเภทโรค
              </p>
              {diseaseCounts.length === 0 ? (
                <p className="text-xs text-slate-400 italic">ไม่มีบันทึกข้อมูลโรคในช่วงนี้</p>
              ) : (
                <div className="space-y-2">
                  {diseaseCounts.map(item => (
                    <div key={item.name} className="flex items-center justify-between text-xs bg-slate-50 hover:bg-slate-100/70 p-2.5 rounded-xl border border-slate-100/40">
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <span className="font-black font-mono bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
                        {item.count} ราย
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ฝั่งอสังหา/การป้องกันการระบาด ทรัพยากรที่มี (เช่น มีทรายอะเบท หรือ พ่นหมอกควันไปแล้วหรือยัง) */}
          <div className="md:col-span-5 bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Hammer className="w-4 h-4 text-emerald-600" />
                สถานะสาธารณูปโภคและอุปสรรคการป้องกันในพื้นที่
              </h4>
              <p className="text-[10.5px] text-slate-400">
                ประเมินเช็คเครื่องมือพ่นสยบและสารกำจัดและคติการสอนในสุขภาวะตำบล
              </p>
            </div>

            {selectedArea && currentResource ? (
              <div className="space-y-3 pt-1">
                {/* 1. ทรายอะเบท */}
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-600 font-medium">มีทรายอะเบทควบคุมลูกน้ำ:</span>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentResource.abateSandApplied === 'yes' ? 'bg-emerald-100 text-emerald-800' :
                      currentResource.abateSandApplied === 'partial' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {currentResource.abateSandApplied === 'yes' ? 'เรียบร้อยครบ' :
                       currentResource.abateSandApplied === 'partial' ? 'มีบางส่วน' : 'ยังไม่มีอุปกรณ์'}
                    </span>
                    <button
                      onClick={() => onUpdateResource(selectedArea.subDistrict, selectedArea.district, {
                        abateSandApplied: currentResource.abateSandApplied === 'yes' ? 'no' : currentResource.abateSandApplied === 'partial' ? 'yes' : 'partial'
                      })}
                      className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] hover:bg-white text-slate-500 cursor-pointer"
                    >
                      สลับ
                    </button>
                  </div>
                </div>

                {/* 2. พ่นหมอกควัน */}
                <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100/50">
                  <span className="text-slate-600 font-medium">ฉีดพ่นหมอกควันฆ่ายุงลาย:</span>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentResource.foggingDone === 'yes' ? 'bg-emerald-100 text-emerald-800' :
                      currentResource.foggingDone === 'partial' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {currentResource.foggingDone === 'yes' ? 'ดำเนินการแล้ว' :
                       currentResource.foggingDone === 'partial' ? 'กำลังพ่นยา' : 'ยังไม่พ่นเคมี'}
                    </span>
                    <button
                      onClick={() => onUpdateResource(selectedArea.subDistrict, selectedArea.district, {
                        foggingDone: currentResource.foggingDone === 'yes' ? 'no' : currentResource.foggingDone === 'partial' ? 'yes' : 'partial'
                      })}
                      className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] hover:bg-white text-slate-500 cursor-pointer"
                    >
                      สลับ
                    </button>
                  </div>
                </div>

                {/* 3. จัดสรรทีมแพทย์ปิตุภูมิ */}
                <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100/50">
                  <span className="text-slate-600 font-medium">จัดตั้งเจ้าหน้าที่แพทย์เฝ้าระวัง:</span>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentResource.medicalStaffAssigned === 'yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {currentResource.medicalStaffAssigned === 'yes' ? 'ประจำการอยู่' : 'ขาดทีมซัปพอร์ต'}
                    </span>
                    <button
                      onClick={() => onUpdateResource(selectedArea.subDistrict, selectedArea.district, {
                        medicalStaffAssigned: currentResource.medicalStaffAssigned === 'yes' ? 'no' : 'yes'
                      })}
                      className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] hover:bg-white text-slate-500 cursor-pointer"
                    >
                      สลับ
                    </button>
                  </div>
                </div>

                {/* 4. ให้ความรู้ชุมชน */}
                <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100/50">
                  <span className="text-slate-600 font-medium">อบรมสุขอนามัยในโรงเรียน:</span>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentResource.educationGiven === 'yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {currentResource.educationGiven === 'yes' ? 'เผยแพร่สมบูรณ์' : 'ไม่มีเวทีชี้แจง'}
                    </span>
                    <button
                      onClick={() => onUpdateResource(selectedArea.subDistrict, selectedArea.district, {
                        educationGiven: currentResource.educationGiven === 'yes' ? 'no' : 'yes'
                      })}
                      className="px-1.5 py-0.5 rounded border border-slate-200 text-[10px] hover:bg-white text-slate-500 cursor-pointer"
                    >
                      สลับ
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-2 text-right">
                  อัปเดตล่าสุด: {currentResource.lastUpdated}
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-white/60 border border-dashed border-slate-200 rounded-xl flex items-center justify-center p-6 text-center text-xs text-slate-400">
                กรุณาคลิกเลือกตำบลในแผนที่ด้านบน เพื่อเรียกดูรายงานจัดการทรัพยากรชุมชนของตำบลนั้น
              </div>
            )}
          </div>

        </div>
      </div>

      {/* บอร์ดสรุปผลคำสั่งงานและกระจายสิ่งของส่งไปยัง รพ.สต. พื้นที่ตามที่ไหลของ flowchart */}
      <div id="issued-commands-board" className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Truck className="w-5 h-5 text-indigo-600" />
              กระดานบันทึกคำสั่งและกระจายสิ่งของส่ง รพ.สต./สอ. พื้นที่สตูล
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              คอยตรวจสอบประเมินสถานภาพและปลายทางรับงานตอบรับส่งมอบสาธารณประโยชน์
            </p>
          </div>

          {/* ฟิลเตอร์สถานะสิทธิ์งานดร็อปดาวน์ */}
          <div className="flex items-center gap-1.5 self-start">
            {(['ทั้งหมด', 'pending', 'received', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setCommandFilter(f)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  commandFilter === f 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
                }`}
              >
                {f === 'ทั้งหมด' ? 'ทั้งหมด' : 
                 f === 'pending' ? 'รอสภารังวัด' : 
                 f === 'received' ? 'ถึง รพ.สต.' : 'สบช. ชุมชนสำเร็จ'}
              </button>
            ))}
          </div>
        </div>

        {/* รายการแสดงการจัดส่ง */}
        {(() => {
          const filteredCommands = commands.filter(c => {
            if (commandFilter === 'ทั้งหมด') return true;
            return c.status === commandFilter;
          });

          if (filteredCommands.length === 0) {
            return (
              <p className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-100 rounded-xl">
                ไม่พบบัญชีคำสั่งการจัดสรรหมวดสิ่งพยุงในประเภทนี้
              </p>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCommands.map(cmd => (
                <div key={cmd.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase leading-none ${
                          cmd.urgency === 'critical' ? 'bg-rose-500 text-white animate-pulse' :
                          cmd.urgency === 'high' ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {cmd.urgency === 'critical' ? 'ฉุกเฉินสูงสุด' :
                           cmd.urgency === 'high' ? 'เร่งด่วนรัง' : 'ปกติเฝ้าระวัง'}
                        </span>
                        <h5 className="font-extrabold text-slate-900 text-xs mt-1 leading-snug">
                          {cmd.commandTitle}
                        </h5>
                      </div>
                      
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cmd.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                        cmd.status === 'received' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {cmd.status === 'completed' ? 'เสร็จสิ้นเรียบร้อย' :
                         cmd.status === 'received' ? 'รพ.สต.รับแล้ว' : 'พิจารณาจวนตัว'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-600 flex items-center gap-1 font-mono">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      หน่วยงานรพ.สต. {cmd.targetSubDistrict} (อ.{cmd.targetDistrict})
                    </div>

                    {/* สิ่งของที่สอยจัดไป */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cmd.items.map(item => (
                        <span key={item.name} className="bg-white px-2 py-0.5 border border-slate-200/50 rounded text-[9.5px] font-medium text-slate-700">
                          {item.name}: {item.quantity} {item.unit}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10.5px] text-slate-500 italic pt-1 font-sans">
                      &ldquo; {cmd.instructions} &rdquo;
                    </p>
                  </div>

                  <div className="border-t border-slate-200/50 pt-2 mt-3 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>ผู้สั่ง: {cmd.senderName} ({cmd.senderRole})</span>
                    <span>{new Date(cmd.createdAt).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* มินิโมดอล dialog สั่งการ dispatch ดนตรีต้านโรคอู่กระโดด */}
      <AnimatePresence>
        {isDispatchModalOpen && dispatchTarget && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 overflow-y-auto max-h-[90vh] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div>
                  <h3 className="font-black text-slate-950 text-base">
                    บันทึกคำสั่งและจัดสรรปันส่งทุนสนับสนุนโรคระบาด
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    จัดสัดส่วนสิ่งของและกวาดต้อนอุปกรณ์พิทักษ์ส่งปีกสาธารณสุข ต.{dispatchTarget.subDistrict}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="p-1 px-2 text-xs font-bold text-slate-400 hover:text-slate-900 hover:bg-slate-105 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmission} className="space-y-4 text-xs font-sans">
                
                {/* ข้อมูลเป้าหมายและตำแหน่งควบคุม */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase leading-tightblock block">ตำบลปลายทาง</span>
                    <span className="font-extrabold text-slate-900 text-sm">ต.{dispatchTarget.subDistrict} (อ.{dispatchTarget.district})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase leading-tight block">สิทธิ์ประสาน</span>
                    <span className="font-bold text-slate-900 text-xs text-indigo-700">รพ.สต./อสม.สอ.พื้นที่</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-black text-slate-800">หัวข้อบัตรคำสั่งส่งสิ่งของป้องกันโรค</label>
                  <input 
                    type="text" 
                    value={commandTitle}
                    onChange={(e) => setCommandTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-205 rounded-xl bg-slate-50 font-medium focus:ring-2 focus:ring-indigo-600 outline-none"
                    placeholder="เช่น แผนกระจายทรายกำจัดยุงฉุกเฉิน..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-black text-slate-800">ผู้สั่งการ</label>
                    <input 
                      type="text" 
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-black text-slate-800">ระดับความเร่งด่วน</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none font-bold"
                    >
                      <option value="medium">ปกติเฝ้าระวัง (Medium)</option>
                      <option value="high">เร่งด่วน (High)</option>
                      <option value="critical">ฉุกเฉินสูงสุด (Critical)</option>
                    </select>
                  </div>
                </div>

                {/* ด่านจำนวนทรัพยากรที่ส่ง */}
                <div className="space-y-3 bg-stone-50/50 p-4 border border-stone-200/50 rounded-2xl">
                  <h4 className="font-black text-slate-900 flex items-center gap-1 text-[11px] border-b border-stone-100 pb-1.5">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" /> ระบุมวลสิ่งปักษ์กระจายลงพื้นที่
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium block">ทรายอะเบท (ซอง)</span>
                      <input 
                        type="number" 
                        value={abateQty}
                        onChange={(e) => setAbateQty(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg font-mono text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium block">สารเคมีพ่น (ขวด / ลิตร)</span>
                      <input 
                        type="number" 
                        value={chemicalQty}
                        onChange={(e) => setChemicalQty(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg font-mono text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium block">หน้ากากคัดกรอง (ชิ้น)</span>
                      <input 
                        type="number" 
                        value={maskQty}
                        onChange={(e) => setMaskQty(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg font-mono text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-medium block">ทีมแพทย์เสริม (คน)</span>
                      <input 
                        type="number" 
                        value={staffQty}
                        onChange={(e) => setStaffQty(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg font-mono text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-black text-slate-800">ข้อบังคับ / รายละเอียดคำร้องบันทึกถึง อสม.</label>
                  <textarea
                    rows={2}
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-600 text-xs font-sans font-medium"
                    placeholder="เช่น ขอให้แจกทรายอย่างใส่ใจ รพ.สต. ลงพื้นที่วัดไข้ทุกครัวเรือนละแวกนั้น..."
                  />
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => setIsDispatchModalOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all cursor-pointer"
                  >
                    ยกเลิกพักภัย
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md"
                  >
                    <Check className="w-4 h-4 text-white" /> บันทึกและส่ง รพ.สต.
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
