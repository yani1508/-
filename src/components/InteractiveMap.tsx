/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AreaStatus, AlertLevel } from '../types';
import { SATUN_GEOGRAPHY } from '../data/satunData';
import { MapPin, TrendingUp, TrendingDown, Eye, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InteractiveMapProps {
  areaStatuses: AreaStatus[];
  onSelectArea: (subDistrict: string, district: string) => void;
  selectedArea: { subDistrict: string; district: string } | null;
}

export default function InteractiveMap({ areaStatuses, onSelectArea, selectedArea }: InteractiveMapProps) {
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('ทั้งหมด');

  // ข้อมูลระบุพิกัดจำลองและโครงสร้าง Grid เพื่อให้จัดวางอำเภอได้ถูกต้องทางภูมิศาสตร์ของสตูล
  // นอร์ธไปเซาธ์: ทุ่งหว้า (บนสุด), มะนัง (บนขวา), ละงู (ซ้ายกลาง), ควนกาหลง (ขวากลาง), ท่าแพ (ซ้ายล่าง), ควนโดน (ขวาล่าง), เมืองสตูล (ใต้สุด)
  const DISTRICT_POSITIONS: { [district: string]: { gridClass: string; desc: string; color: string } } = {
    'ทุ่งหว้า': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-1 lg:col-start-1', desc: 'ตอนเหนือสุดชายฝั่งอันดามัน', color: 'border-blue-500/20 bg-blue-50/50' },
    'มะนัง': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-1 lg:col-start-6', desc: 'ตอนเหนือฝั่งแผ่นดินในหุบเขา', color: 'border-emerald-500/20 bg-emerald-50/50' },
    'ละงู': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-7 xl:col-span-6 lg:row-start-2 lg:col-start-1', desc: 'แหล่งท่องเที่ยวทางทะเลที่สำคัญของจังหวัด', color: 'border-teal-500/20 bg-teal-50/50' },
    'ควนกาหลง': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-2 lg:col-start-7 animate-pulse-slow', color: 'border-amber-500/20 bg-amber-50/50', desc: 'ตอนกลางแผ่นดิน สวนยางพาราหนาแน่น' },
    'ท่าแพ': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-3 lg:col-start-2', desc: 'ศูนย์กลางคมนาคมฝั่งตะวันตก', color: 'border-indigo-500/20 bg-indigo-50/50' },
    'ควนโดน': { gridClass: 'col-span-12 md:col-span-6 lg:col-span-5 xl:col-span-4 lg:row-start-3 lg:col-start-7', desc: 'ฝั่งตะวันออกติดเทือกเขาบรรทัดด่านชายแดน', color: 'border-sky-500/20 bg-sky-50/50' },
    'เมืองสตูล': { gridClass: 'col-span-12 md:col-span-12 lg:col-span-10 xl:col-span-8 lg:row-start-4 lg:col-start-2', desc: 'ศูนย์กลางการบริหารราชการและเกาะสาหร่าย', color: 'border-slate-500/20 bg-slate-50/50' }
  };

  const getStatusColor = (status: AlertLevel) => {
    switch (status) {
      case 'red':
        return {
          bg: 'bg-rose-50 hover:bg-rose-100 border-rose-300',
          dot: 'bg-rose-500 animate-ping',
          text: 'text-rose-800',
          badge: 'bg-rose-500 text-white',
          label: 'ระบาดระดับสูง (แดง)',
          shadow: 'shadow-rose-100'
        };
      case 'orange':
        return {
          bg: 'bg-orange-50 hover:bg-orange-100 border-orange-300',
          dot: 'bg-orange-500 animate-pulse',
          text: 'text-orange-950',
          badge: 'bg-orange-550 text-white',
          label: 'เสี่ยงปานกลาง (ส้ม)',
          shadow: 'shadow-orange-100'
        };
      case 'yellow':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100 border-amber-300',
          dot: 'bg-amber-500 animate-pulse',
          text: 'text-amber-800',
          badge: 'bg-amber-500 text-amber-955',
          label: 'เฝ้าระวังภัย (เหลือง)',
          shadow: 'shadow-amber-100'
        };
      case 'green':
      default:
        return {
          bg: 'bg-emerald-50/30 hover:bg-emerald-50 border-emerald-200',
          dot: 'bg-emerald-500',
          text: 'text-emerald-800',
          badge: 'bg-emerald-600/10 text-emerald-800 border border-emerald-200',
          label: 'ปกติ / ปลอดภัย',
          shadow: 'shadow-emerald-50'
        };
    }
  };

  // กรองอำเภอที่แสดงผลตามตัวเลือก
  const districts = Object.keys(SATUN_GEOGRAPHY);
  const activeDistricts = selectedDistrictFilter === 'ทั้งหมด' 
    ? districts 
    : [selectedDistrictFilter];

  return (
    <div className="space-y-6">
      {/* ส่วนควบคุมและอธิบายแผนที่ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-lg bg-indigo-50 text-indigo-600 font-mono text-xs">GIS Map</span>
            แผนผังภูมิศาสตร์ความเสี่ยงระดับตำบล จังหวัดสตูล
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            คลิกเลือกพื้นที่ระบายสีเพื่อแสดงวิเคราะห์จำแนกผู้ป่วยสะสม รายงานข้อมูล และกดออกคำสั่งพยุงพื้นที่
          </p>
        </div>

        {/* ฟิลเตอร์อำเภอ */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline">คัดกรองอำเภอ:</span>
          <button
            onClick={() => setSelectedDistrictFilter('ทั้งหมด')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedDistrictFilter === 'ทั้งหมด' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            ทั้งหมด ({districts.length})
          </button>
          {districts.map(district => {
            const districtCount = areaStatuses.filter(s => s.district === district).length;
            const hasOverbreak = areaStatuses.some(s => s.district === district && s.status === 'red');
            const hasOrange = areaStatuses.some(s => s.district === district && s.status === 'orange');
            const hasAlert = areaStatuses.some(s => s.district === district && s.status === 'yellow');
            
            let statusDot = 'bg-emerald-400';
            if (hasOverbreak) statusDot = 'bg-rose-500 animate-pulse';
            else if (hasOrange) statusDot = 'bg-orange-500 animate-pulse';
            else if (hasAlert) statusDot = 'bg-amber-400';

            return (
              <button
                key={district}
                onClick={() => setSelectedDistrictFilter(district)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedDistrictFilter === district 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                {district}
              </button>
            );
          })}
        </div>
      </div>

      {/* แผนผังจำลองเชิงสัญลักษณ์และตำแหน่งทางภูมิศาสตร์ */}
      <div className="grid grid-cols-12 gap-5 relative">
        <div className="col-span-12 lg:col-span-9 grid grid-cols-12 gap-5">
          {activeDistricts.map(district => {
            const config = DISTRICT_POSITIONS[district] || { gridClass: 'col-span-12', desc: '', color: 'bg-slate-50/50' };
            const subDistricts = SATUN_GEOGRAPHY[district];

            // ตรวจสอบความเสี่ยงรวมของอำเภอนี้ เพื่อแสดงหัวข้อที่สวยงาม
            const districtStatuses = areaStatuses.filter(s => s.district === district);
            const redCount = districtStatuses.filter(s => s.status === 'red').length;
            const orangeCount = districtStatuses.filter(s => s.status === 'orange').length;
            const yellowCount = districtStatuses.filter(s => s.status === 'yellow').length;
            
            let borderClass = 'border-slate-200/60 bg-white';
            let headBadge = null;

            if (redCount > 0) {
              borderClass = 'border-rose-200/70 bg-stone-50/40 ring-1 ring-rose-100';
              headBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  พบคอนเฟิร์มระบาด {redCount} ตำบล
                </span>
              );
            } else if (orangeCount > 0) {
              borderClass = 'border-orange-200/70 bg-stone-50/40 ring-1 ring-orange-100';
              headBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  เสี่ยงปานกลาง {orangeCount} ตำบล
                </span>
              );
            } else if (yellowCount > 0) {
              borderClass = 'border-amber-200/70 bg-stone-50/40';
              headBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  เฝ้าระวัง {yellowCount} ตำบล
                </span>
              );
            }

            return (
              <motion.div
                layout
                id={`district-${district}`}
                key={district}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`${config.gridClass} rounded-2xl border ${borderClass} p-5 flex flex-col justify-between transition-all hover:shadow-md shadow-xs`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                        อำเภอ {district}
                      </h3>
                      {config.desc && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {config.desc}
                        </p>
                      )}
                    </div>
                    {headBadge}
                  </div>

                  {/* ตำบลทั้งหมดภายในอำเภอนี้ */}
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 mt-4">
                    {subDistricts.map(subDist => {
                      const areaStat = areaStatuses.find(
                        s => s.subDistrict === subDist && s.district === district
                      );

                      if (!areaStat) return null;

                      const isSelected = selectedArea?.subDistrict === subDist && selectedArea?.district === district;
                      const c = getStatusColor(areaStat.status);

                      return (
                        <button
                          key={subDist}
                          id={`area-button-${district}-${subDist}`}
                          onClick={() => onSelectArea(subDist, district)}
                          className={`group cursor-pointer border text-left rounded-xl p-2.5 transition-all outline-none flex flex-col justify-between select-none ${c.bg} ${
                            isSelected 
                              ? 'ring-2 ring-indigo-600 border-indigo-500 shadow-md scale-[1.02]' 
                              : 'shadow-xs hover:shadow-md hover:scale-[1.01]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-xs font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                                ต.{subDist}
                              </span>
                              <span className="flex h-2 w-2 relative">
                                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${c.dot}`} />
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot.replace('animate-ping', '').replace('animate-pulse', '')}`} />
                              </span>
                            </div>

                            {/* แสดงสถิติย่อ */}
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="text-[10px] text-slate-400">ผู้ป่วยสะสม:</span>
                              <span className="text-xs font-mono font-bold text-slate-900">
                                {areaStat.currentCount} ราย
                              </span>
                            </div>
                          </div>

                          {/* สต๊าฟแนวโน้ม */}
                          <div className="flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t border-slate-100/70">
                            {areaStat.trend === 'outbreak' ? (
                              <span className="text-rose-600 font-medium flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3 text-rose-500" /> ระบาดทะยาน
                              </span>
                            ) : areaStat.trend === 'increasing' ? (
                              <span className="text-amber-600 font-medium flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3 text-amber-500" /> ขยับเริ่มสูง
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                <TrendingDown className="w-3 h-3 text-emerald-500" /> ทรงตัว/ลดลง
                              </span>
                            )}
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                              {c.label}
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

        {/* ตู้นำทางคำอธิบายแผนที่ด้านขวา */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm border-b border-slate-50 pb-2 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-500" />คำอธิบายแผนภูมิ
            </h4>

            {/* การจำแนกสีและเกณฑ์การแจ้งเตือน */}
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-md bg-rose-100 border border-rose-300 shrink-0 mt-0.5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                </div>
                <div>
                  <p className="font-bold text-rose-800">สีแดง: ควบคุมการระบาดหนัก</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    จำนวนเคสสะสมในพื้นที่ตั้งแต่ 6 รายขึ้นไป ถือเป็นจุดควบคุมเร่งรัดพิเศษร่วมป้องกัน
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-md bg-orange-100 border border-orange-300 shrink-0 mt-0.5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                </div>
                <div>
                  <p className="font-bold text-orange-900">สีส้ม: เฝ้าระวังเสี่ยงปานกลาง</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    จำนวนเคสสะสมในพื้นที่ 3-5 ราย เริ่มขยายตัวแผ่ความร้อนสะสม
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-md bg-amber-100 border border-amber-300 shrink-0 mt-0.5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <div>
                  <p className="font-bold text-amber-800">สีเหลือง: เฝ้าระวังภัยทั่วไป</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    จำนวนเคสเริ่มแรก 1-2 ราย ตรวจตราเพื่อยับยั้งวงจรลุกลาม
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-md bg-emerald-50 border border-emerald-200 shrink-0 mt-0.5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-emerald-800">สีเขียว: สภาพระมัดระวังปกติ</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    ไม่มีจำนวนผู้ติดเชื้อคดีเดี่ยวใดๆ (0 ราย) ข้อมูลเป็นศูนย์มีความปลอดภัยสูง
                  </p>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 border-t border-slate-50 pt-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              การประมวลผลคำนวณแบบสัปดาห์ต่อสัปดาห์ อิงพิกัดทางภูมิศาสตร์ของโรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.) ดึงข้อมูลสะสมอย่างแม่นยำ
            </div>
          </div>

          {/* แผงด่วนเมื่อมีการเลือกตำบลเฉพาะ */}
          <AnimatePresence mode="wait">
            {selectedArea ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-indigo-950 text-white p-5 rounded-2xl shadow-md border border-indigo-800/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-300">
                    พื้นที่ที่เลือกปัจจุบัน
                  </span>
                  <button 
                    onClick={() => onSelectArea('', '')}
                    className="text-[10px] text-indigo-200 hover:text-white underline cursor-pointer"
                  >
                    ล้างตัวเลือก
                  </button>
                </div>

                <div>
                  <p className="text-xs text-indigo-200">อ. {selectedArea.district}</p>
                  <p className="text-lg font-extrabold tracking-tight">ต. {selectedArea.subDistrict}</p>
                </div>

                {(() => {
                  const areaStat = areaStatuses.find(
                    s => s.subDistrict === selectedArea.subDistrict && s.district === selectedArea.district
                  );
                  if (!areaStat) return null;

                  return (
                    <div className="space-y-2.5 text-xs border-t border-indigo-900 pt-3">
                      <div className="flex justify-between">
                        <span className="text-indigo-200">เคสปักษ์นี้:</span>
                        <span className="font-bold font-mono text-indigo-100">{areaStat.currentCount} คน</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">เคสปักษ์ก่อน:</span>
                        <span className="font-bold font-mono text-indigo-100">{areaStat.previousCount} คน</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">ประเมินสถานะ:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          areaStat.status === 'red' ? 'bg-rose-500 text-white' :
                          areaStat.status === 'orange' ? 'bg-orange-500 text-white' :
                          areaStat.status === 'yellow' ? 'bg-amber-400 text-slate-900' :
                          'bg-emerald-500 text-white'
                        }`}>
                          {areaStat.status === 'red' ? 'แดง เสี่ยงสูง/วิกฤต' :
                           areaStat.status === 'orange' ? 'ส้ม เสี่ยงปานกลาง' :
                           areaStat.status === 'yellow' ? 'เหลือง เฝ้าระวังภัย' : 'เขียว ปลอดภัยปกติ'}
                        </span>
                      </div>
                      <p className="text-[10px] text-indigo-300/85 pt-1.5 italic">
                        * เลื่อนลงไปด้านล่าง เพื่อดูรายงานผู้ใช้อายุ ยารก ปัจจัยยับยั้ง และพิมพ์คำสั่งกระจายทุนพ่นยากำราบโรคระบาดได้ทันที
                      </p>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <div className="bg-slate-50/50 border border-slate-200/50 border-dashed rounded-2xl p-6 text-center text-slate-400 text-xs">
                <HelpCircle className="w-6 h-6 mx-auto text-slate-300 stroke-1 mb-2" />
                กรุณาคลิกเลือกตำบลในแผงสตูลแผนที่ เพื่อสรุปผลวิเคราะห์ และลงดาบออกคำสั่งควบคุมโรคทันที
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
