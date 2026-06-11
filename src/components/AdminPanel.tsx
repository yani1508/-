/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Patient, DiseaseCategory, AreaStatus } from '../types';
import { 
  Settings, Users, ShieldAlert, BarChart3, Database, 
  Trash2, RefreshCw, Sliders, Check, HelpCircle, AlertOctagon, TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';

interface AdminPanelProps {
  categories: DiseaseCategory[];
  patients: Patient[];
  areaStatuses: AreaStatus[];
  onUpdateCategoryThresholds: (code: string, yellow: number, red: number) => void;
  onClearPatients: () => void;
  onRestoreDefaults: () => void;
  onDeletePatient?: (id: string) => void;
}

export default function AdminPanel({
  categories,
  patients,
  areaStatuses,
  onUpdateCategoryThresholds,
  onClearPatients,
  onRestoreDefaults,
  onDeletePatient
}: AdminPanelProps) {
  // ควบคุมเซ็ตย่อยของแผงอักษร
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'rules' | 'db' | 'stats'>('rules');

  // ข้อมูลฟิลเตอร์แถวตารางฐานข้อมูลผู้ป่วย
  const [searchQuery, setSearchQuery] = useState('');
  const [diseaseFilter, setDiseaseFilter] = useState('ทั้งหมด');
  const [districtFilter, setDistrictFilter] = useState('ทั้งหมด');

  // ตรวจสอบการลบ
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // ดึงอำเภอเฉพาะที่มีผู้ป่วยมาทำฟิลเตอร์
  const uniqueDistricts = Array.from(new Set(patients.map(p => p.district)));

  // แยกวิเคราะห์ผู้ป่วยตามคำค้น
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.cidEncrypted.includes(searchQuery) || p.village.includes(searchQuery) || p.subDistrict.includes(searchQuery);
    const matchesDisease = diseaseFilter === 'ทั้งหมด' || p.diseaseCode === diseaseFilter;
    const matchesDistrict = districtFilter === 'ทั้งหมด' || p.district === districtFilter;
    return matchesSearch && matchesDisease && matchesDistrict;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 md:p-6 space-y-6">
      
      {/* ส่วนหัวแสดงผลพนักงาน IT สสจ. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-indigo-750 bg-indigo-50 px-2 py-0.5 rounded uppercase">
            ฐานข้อมูลผู้ดูแลระบบ (IT Admin ของ สสจ. สตูล)
          </span>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1 flex items-center gap-1.5">
            <Sliders className="w-5 h-5 text-indigo-600" />
            ระบบคำนวณเกณฑ์ควบคุมความเสี่ยงโรคระบาด
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            สถาบันเทคโนโลยี สสจ.สแกนและจัดการฐานกลาง กำหนดโมเดลตรวจจับความต่างเพื่อกระพริบทิศทางแดงเหลืองในแผงสั่งคำขอ
          </p>
        </div>

        {/* ย้อนตัวเลือกย่อย */}
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-105/30 self-start">
          <button
            onClick={() => setActiveAdminSubTab('rules')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeAdminSubTab === 'rules' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            ข้อกำหนดเกณฑ์ทริกเกอร์
          </button>
          <button
            onClick={() => setActiveAdminSubTab('db')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeAdminSubTab === 'db' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            สารบัญฐานข้อมูลผู้ป่วยทั้งหมด
          </button>
          <button
            onClick={() => setActiveAdminSubTab('stats')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeAdminSubTab === 'stats' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            ตรวจสอบการคำนวณเฉลี่ยตำบล
          </button>
        </div>
      </div>

      {/* 1. ส่วนกำหนดสูตรและทริกเกอร์เงื่อนไข (Risk Rule Customizer) */}
      {activeAdminSubTab === 'rules' && (
        <div className="space-y-6">
          
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-150 text-xs text-indigo-900 leading-relaxed space-y-2">
            <p className="font-extrabold flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-indigo-600 shrink-0" />
              การทำงานของระบบตรวจสอบเงื่อนไขความเสี่ยงในโรงพยาบาล สสจ. (Risk Threshold Rule Engine)
            </p>
            <p className="text-slate-650">
              เมื่อมีข้อมูลใหม่ไหลเข้ามาจากโรงพยาบาล ระบบจะตรวจเช็คจำนวนเคสผู้ป่วยสะสมรายโรคของตำบลนั้นในรอบระเบียน 2 สัปดาห์ปัจจุบัน หากค่าสะสมแตะระดับที่กำหนดไว้ด้านล่าง จะเปลี่ยนสีตำบลในแผนที่ทันที พร้อมพิมพ์ใบเตือนภัย Predictive Alert โดยอัตโนมัติ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(cat => (
              <div key={cat.code} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between space-y-4 shadow-2xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-extrabold text-xs text-indigo-950">{cat.name}</span>
                    <span className="font-mono bg-indigo-50 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700">{cat.code}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">ระยะฟักตัวปกติ: {cat.incubationDays} วันในการสอบสวนโรคติดต่อ</p>
                </div>

                {/* ตัวปรับค่าสัดส่วน */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-amber-600 tracking-tight block">เหลือง (เฝ้าระวัง) ตั้งแต่</span>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number" 
                        min={1}
                        value={cat.thresholdYellow}
                        onChange={(e) => onUpdateCategoryThresholds(cat.code, Math.max(1, parseInt(e.target.value) || 1), cat.thresholdRed)}
                        className="w-16 px-2 py-1 border border-slate-200 bg-white rounded font-mono font-bold text-center"
                      />
                      <span className="text-slate-400 text-[10px]">ราย / 2 สัปดาห์</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-rose-600 tracking-tight block">แดง (แพร่ระบาด) ตั้งแต่</span>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number" 
                        min={cat.thresholdYellow + 1}
                        value={cat.thresholdRed}
                        onChange={(e) => onUpdateCategoryThresholds(cat.code, cat.thresholdYellow, Math.max(cat.thresholdYellow + 1, parseInt(e.target.value) || 2))}
                        className="w-16 px-2 py-1 border border-slate-200 bg-white rounded font-mono font-bold text-center"
                      />
                      <span className="text-slate-400 text-[10px]">ราย / 2 สัปดาห์</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* คลีนล้างข้อมูลระบบ / ตั้งค่าโรงงาน */}
          <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="text-[11px] text-slate-400">
              * การเปลี่ยนแปลงเกณฑ์ดักจับจะมีผลคำนวณย้อนกลับสสมาภาพทุกกลุ่มระบาดบนหน้าจอทันที
            </div>

            <div className="flex gap-2">
              <button
                onClick={onRestoreDefaults}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border rounded-lg text-xs cursor-pointer transition-colors"
                title="ย้อนเกณฑ์ความเสี่ยงและการจายผู้ป่วยต้นฉบับสตูล"
              >
                ย้อนค่าโรงงาน สสจ.
              </button>
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1 border border-rose-100"
              >
                <Trash2 className="w-4 h-4" /> ล้างแฟ้มผู้ป่วยทั้งหมด
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 2. สารบัญตารางจัดการฐานข้อมูลผู้ป่วยสะสม (Central DB Patient Records List) */}
      {activeAdminSubTab === 'db' && (
        <div className="space-y-4">
          
          {/* ช่องกรองแถวด้านบน */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input 
              type="text" 
              placeholder="ค้นตาม CID หรือหมู่บ้าน ตำบล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-slate-205 rounded-xl text-xs outline-none bg-slate-50 font-medium"
            />
            
            <select
              value={diseaseFilter}
              onChange={(e) => setDiseaseFilter(e.target.value)}
              className="px-3 py-2 border border-slate-205 rounded-xl text-xs outline-none bg-slate-50 font-bold text-slate-750"
            >
              <option value="ทั้งหมด">โรคทั้งหมด</option>
              {categories.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name.split(' ')[0]}</option>)}
            </select>

            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 border border-slate-205 rounded-xl text-xs outline-none bg-slate-50 font-bold text-slate-750"
            >
              <option value="ทั้งหมด">อำเภอทั้งหมด</option>
              {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-3">รหัสแฟ้ม</th>
                    <th className="p-3">เลขบัตร (คุ้มครองแล้ว)</th>
                    <th className="p-3">โรคที่บันทึก</th>
                    <th className="p-3">พื้นที่พิกัดที่อยู่ (ตำบล/อำเภอ)</th>
                    <th className="p-3">วันที่เริ่มป่วย</th>
                    <th className="p-3">อายุ/เพศ</th>
                    {onDeletePatient && <th className="p-3 text-center">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={onDeletePatient ? 7 : 6} className="p-6 text-center text-slate-400 italic">
                        ไม่มีประวัติบันทึกตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-indigo-650 font-bold">{p.id}</td>
                        <td className="p-3 font-mono font-medium">{p.cidEncrypted}</td>
                        <td className="p-3 font-semibold text-slate-800">{p.diseaseName.split(' ')[0]} ({p.diseaseCode})</td>
                        <td className="p-3 text-slate-600">ต.{p.subDistrict} อ.{p.district}</td>
                        <td className="p-3 text-slate-500 font-mono">{p.onsetEmanationDate}</td>
                        <td className="p-3 font-semibold text-slate-700">{p.age} ปี / {p.gender}</td>
                        {onDeletePatient && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                if (confirm(`คุณต้องการลบระเบียนผู้ป่วยรหัส ${p.id} (${p.cidEncrypted || ''}) ออกจากระบบสตูลพอร์ทัลหรือไม่?`)) {
                                  onDeletePatient(p.id);
                                }
                              }}
                              className="text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 p-1.5 px-2.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 font-bold"
                              title="ลบระเบียนคนไข้นี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              ลบ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white p-3 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span>แสดงทั้งหมด {filteredPatients.length} จาก {patients.length} ระเบียนทั้งหมด</span>
              <span>จังหวัดสตูล</span>
            </div>
          </div>

        </div>
      )}

      {/* 3. ตรวจเช็ควิเคราะห์สูตรคำนวณค่าเฉลี่ยและแนวโน้ม (Data Calculations Log) */}
      {activeAdminSubTab === 'stats' && (
        <div className="space-y-4 text-xs font-sans">
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 leading-relaxed text-slate-600">
            <p className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs mb-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              รายงานการคำนวณตัวชี้วัดและสถิติวิเคราะห์ระดับตำบล จังหวัดสตูล
            </p>
            <p className="text-[11px]">
              แผงควบคุมหลักใช้สูตรระดับสัปดาห์ดึงค่าผู้ป่วยช่วง 14 วันล่าสุด ประเมินความแปรปรวนจาก 14 วันก่อนหน้า และเทียบเคียงมาตรฐานแนวโน้มประวัติศาสตร์ หากดัชนีแตะระดับจะเพิ่มและพยุงพื้นที่เสี่ยงพร้อมรายงานสู่ส่วนบริหารด่วน
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {areaStatuses.map(area => {
              // ดึงเฉพาะตำบลที่มีผู้ป่วยสะสม เพื่อประหยัดเนื้อที่ในการรีวิวของแอดมิน
              if (area.currentCount === 0 && area.previousCount === 0) return null;

              return (
                <div key={`${area.district}-${area.subDistrict}`} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">ต.{area.subDistrict} (อ.{area.district})</h4>
                      <p className="text-[10px] text-slate-400">คำนวณเฉลี่ยย้อนหลังสะสม: {area.avgHistorical} ราย</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                      area.status === 'red' ? 'bg-rose-100 text-rose-700' :
                      area.status === 'yellow' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      สี{area.status === 'red' ? 'แดง' : area.status === 'yellow' ? 'เหลือง' : 'เขียว'} - {
                        area.status === 'red' ? 'ผู้ป่วยเพิ่มขึ้นผิดปกติ' :
                        area.status === 'yellow' ? 'ผู้ป่วยเพิ่มขึ้นปกติ' : 'ทรงตัวปลอดภัย'
                      }
                    </span>
                  </div>

                  {/* สรุปรายละเอียดสูตร */}
                  <div className="grid grid-cols-3 gap-2.5 text-center text-[10px] pt-1.5 border-t border-slate-180">
                    <div className="bg-white p-2 rounded-lg border border-slate-140/60">
                      <span className="text-slate-400 uppercase tracking-widest font-bold block mb-0.5">2 สัปดาห์นี้</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{area.currentCount} ราย</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-140/60">
                      <span className="text-slate-400 uppercase tracking-widest font-bold block mb-0.5">2 สัปดาห์ก่อน</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{area.previousCount} ราย</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-140/60">
                      <span className="text-slate-400 uppercase tracking-widest font-bold block mb-0.5">อัตราเติบโต</span>
                      <span className={`text-sm font-black font-mono ${
                        area.currentCount > area.previousCount ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {area.previousCount === 0 ? (area.currentCount > 0 ? '+100%' : '0%') : 
                         `${area.currentCount > area.previousCount ? '+' : ''}${Math.round(((area.currentCount - area.previousCount) / area.previousCount) * 100)}%`}
                      </span>
                    </div>
                  </div>

                  {/* แสดงทริกเกอร์โรคเดี่ยว */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9.5px] text-slate-400 font-bold block uppercase tracking-wider">จำแนกรายรหัสโรคเฝ้าสังเกต</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(area.diseaseSummary).map(code => {
                        const count = area.diseaseSummary[code];
                        if (count === 0) return null;
                        const dMatch = categories.find(c => c.code === code);
                        return (
                          <span key={code} className="bg-stone-100 border border-stone-200/55 text-slate-600 rounded p-1 py-0.5 text-[9.5px] font-semibold">
                            {code} ({dMatch?.name.split(' ')[0]}): {count} คน
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* โมดอลย่อยยืนยันการเคลียร์ลบผู้ป่วย */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertOctagon className="w-6 h-6 shrink-0 text-rose-500 animate-bounce" />
              <h4 className="font-extrabold text-sm text-slate-950">ยืนยันล้างข้อมูลระเบียนผู้ป่วยและคำสั่งทั้งหมด?</h4>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-sans font-medium">
              การทำงานนี้จะลบระเบียบกรณีบันทึกทั้งหมดออกจากหน่วยความจำ คาบภูมิศาสตร์สตูลจะคืนสภาพสุทธิเป็นสีธรรมดา (สีเขียวปกติ) เหมาะสมต่อการสาธิตใส่ข้อมูลตั้งแต่เริ่มต้นใหม่ทั้งหมด
            </p>

            <div className="flex gap-2 text-xs pt-1.5">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all cursor-pointer"
              >
                ยกเลิกคงฟ้มเดิม
              </button>
              <button
                onClick={() => {
                  onClearPatients();
                  setIsConfirmDeleteOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all cursor-pointer"
              >
                ยืนยันล้างสะสม
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
