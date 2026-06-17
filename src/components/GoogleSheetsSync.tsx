import React, { useState, useEffect } from 'react';
import { Database, Link2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, LogIn, LogOut, Key, Copy, Check } from 'lucide-react';

const safeParseJson = (text: string): any => {
  const trimmed = text.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.includes('<html') || trimmed.includes('ServiceLogin') || trimmed.includes('login') || trimmed.includes('DOCTYPE html')) {
    throw new Error('ตรวจพบหน้ากากลงชื่อเข้าใช้งาน (Login HTML) จาก Google Workspace ยืนยันว่า Google Web App นี้ไม่ได้ตั้งสิทธิ์เข้าถึงเป็น "Anyone" (ทุกคนที่มีลิงก์) หรือมีปัญหาด้านความปลอดภัย');
  }
  return JSON.parse(text);
};

interface GoogleSheetsSyncProps {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  appsScriptUrl: string | null;
  onAppsScriptUrlChange: (url: string | null) => void;
  syncLogs: { id: string; time: string; type: 'success' | 'error' | 'info'; msg: string }[];
  onClearLogs: () => void;
  spreadsheetId?: string;
  onOverwriteCloud?: () => Promise<boolean>;
  onSyncAccumulations?: () => Promise<boolean>;
  patientsCount?: number;
}

export function GoogleSheetsSync({
  token,
  onTokenChange,
  appsScriptUrl,
  onAppsScriptUrlChange,
  syncLogs,
  onClearLogs,
  spreadsheetId = '1x4sKAQUPVJUXC5-OYqXHPZiVS8qr_sQskQut6r2OOWE',
  onOverwriteCloud,
  onSyncAccumulations,
  patientsCount = 0
}: GoogleSheetsSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [clientId, setClientId] = useState(() => localStorage.getItem('custom_google_client_id') || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({ status: 'idle', message: '' });
  const [showConfigOptions, setShowConfigOptions] = useState(false);
  
  // Apps Script states
  const [scriptUrlInput, setScriptUrlInput] = useState(appsScriptUrl || '');
  const [copied, setCopied] = useState(false);

  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (appsScriptUrl !== null) {
      setScriptUrlInput(appsScriptUrl);
    }
  }, [appsScriptUrl]);

  // Handle Google Sheets Connection via Redirect
  const handleGoogleRedirectLogin = () => {
    const activeClientId = envClientId || clientId || localStorage.getItem('custom_google_client_id');
    if (!activeClientId) {
      alert('กรุณาระบุ Google Client ID ในส่วนการตั้งค่าขั้นสูงด้านล่าง หรือตั้งค่าตัวแปรระบบ VITE_GOOGLE_CLIENT_ID คีย์ก่อน!');
      setShowConfigOptions(true);
      return;
    }

    if (clientId) {
      localStorage.setItem('custom_google_client_id', clientId);
    }

    const redirectUri = window.location.origin + '/';
    const scopes = 'https://www.googleapis.com/auth/spreadsheets';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId.trim())}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `prompt=consent`;

    window.location.href = authUrl;
  };

  // Handle Google Connections via Popup
  const handleGooglePopupLogin = () => {
    const activeClientId = envClientId || clientId || localStorage.getItem('custom_google_client_id');
    if (!activeClientId) {
      alert('กรุณาระบุ Google Client ID ในส่วนการตั้งค่าขั้นสูงด้านล่าง หรือตั้งค่าตัวแปรระบบ VITE_GOOGLE_CLIENT_ID คีย์ก่อน!');
      setShowConfigOptions(true);
      return;
    }

    if (clientId) {
      localStorage.setItem('custom_google_client_id', clientId);
    }

    const redirectUri = window.location.origin + '/';
    const scopes = 'https://www.googleapis.com/auth/spreadsheets';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(activeClientId.trim())}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `prompt=consent`;

    const popup = window.open(authUrl, 'google_auth_popup', 'width=600,height=650');
    
    if (!popup) {
      alert('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาเปิดการใช้งานป๊อปอัปสำหรับไซต์นี้ หรือใช้การซิงก์ด่วนโดยกรอก Token ด้านล่าง');
      return;
    }

    const interval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(interval);
          return;
        }

        const currentUrl = popup.location.href;
        if (currentUrl && (currentUrl.includes('access_token=') || popup.location.hash.includes('access_token='))) {
          const hash = popup.location.hash || new URL(currentUrl).hash;
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          if (accessToken) {
            localStorage.setItem('google_sheets_access_token', accessToken);
            onTokenChange(accessToken);
            clearInterval(interval);
            popup.close();
          }
        }
      } catch (e) {
        // Cross-origin expected
      }
    }, 1000);
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    localStorage.setItem('google_sheets_access_token', manualToken.trim());
    onTokenChange(manualToken.trim());
    setManualToken('');
    setTestResult({ status: 'idle', message: '' });
  };

  const handleScriptUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = scriptUrlInput.trim();
    if (cleanUrl) {
      localStorage.setItem('google_apps_script_url', cleanUrl);
      onAppsScriptUrlChange(cleanUrl);
    } else {
      localStorage.removeItem('google_apps_script_url');
      onAppsScriptUrlChange(null);
    }
    alert('บันทึกและเชื่อมโยง Google Apps Script ยึดหลักสำเร็จเรียบร้อย!');
  };

  const handleTestScriptConnection = async () => {
    if (!scriptUrlInput.trim()) return;
    setTestingConnection(true);
    setTestResult({ status: 'idle', message: '' });

    try {
      // Test GET request for credentials via Server-side CORS bypass Proxy
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(`${scriptUrlInput.trim()}?action=getCredentials`)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = safeParseJson(await res.text());
        if (data.status === 'success') {
          setTestResult({
            status: 'success',
            message: `✓ เชื่อมต่อ Google Apps Script สำเร็จ! ตรวจพบโครงสร้างระเบียน บันทึก และบัญชีบุคลากรที่ซิงก์ตรงกันเรียบร้อย`
          });
        } else {
          setTestResult({
            status: 'error',
            message: `✗ Apps Script คืนค่าผิดพลาด: ${data.message || 'โครงสร้าง JSON ไม่ตรงจุดประสงค์'}`
          });
        }
      } else {
        setTestResult({
          status: 'error',
          message: `✗ เชื่อมต่อล้มเหลว (HTTP Status ${res.status}): ตรวจจับความไม่ปลอดภัยโปรดแชร์สิทธิ์เว็บแอปเป็น Everyone`
        });
      }
    } catch (error: any) {
      setTestResult({
        status: 'error',
        message: `✗ ขอตรวจการตอบรับล้มเหลว: ไม่สามารถสื่อสารอินเทอร์เฟซ Google Apps Script ได้ (${error.message})`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Test Sheets API connection
  const handleTestConnection = async () => {
    if (!token) return;
    setTestingConnection(true);
    setTestResult({ status: 'idle', message: '' });

    try {
      const targetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`;
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = safeParseJson(await res.text());
        setTestResult({ 
          status: 'success', 
          message: `เชื่อมต่อสำเร็จ! ชีตระดับความลับ: "${data.properties.title || 'เฝ้าระวังโรคสตูล'}" ได้สิทธิ์เขียนข้อมูลลง Sheet 5 และ 7` 
        });
      } else {
        const err = safeParseJson(await res.text());
        setTestResult({ 
          status: 'error', 
          message: `สิทธิ์ Token ไม่ถูกต้อง หรือ Spreadsheet ถูกล็อก: ${err.error?.message || res.statusText}` 
        });
      }
    } catch (error: any) {
      setTestResult({ status: 'error', message: `เครือข่ายเชื่อมต่อล้มเหลว: ${error.message}` });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('คุณต้องการยกเลิกการซิงก์ Google Sheets หรือไม่? ข้อมูลจะยังบันทึกในอุปกรณ์นี้ แต่ออฟไลน์จากคลาวด์')) {
      localStorage.removeItem('google_sheets_access_token');
      onTokenChange(null);
      setTestResult({ status: 'idle', message: '' });
    }
  };

  const handleDisconnectScript = () => {
    if (confirm('คุณต้องการยกเลิกการซิงก์ผ่าน Google Apps Script หรือไม่?')) {
      localStorage.removeItem('google_apps_script_url');
      onAppsScriptUrlChange(null);
      setScriptUrlInput('');
      setTestResult({ status: 'idle', message: '' });
    }
  };

  const scriptCodeTemplate = `// ==========================================
// 1. นำโค้ด Google Apps Script นี้ไปวางใน Extensions -> Apps Script บน Google Sheets ของคุณ
// 2. ให้เลือกการ "Deploy as Web App" (การให้บริการเป็นเว็บแอป)
// 3. ตั้งค่า 'Execute as:' เป็น "Me" (ตัวฉันเอง)
// 4. ตั้งค่า 'Who has access:' เป็น "Anyone" (ทุกคนที่มีลิงก์) เพื่ออนุญาตการเชื่อมต่อ
// ==========================================

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "getCredentials") {
    try {
      // ค้นหาพาธแผ่นชีต 2, 3 และ 4
      var itSheet = ss.getSheetByName("Sheet2") || ss.getSheets()[1];
      var execSheet = ss.getSheetByName("Sheet3") || ss.getSheets()[2];
      var hospSheet = ss.getSheetByName("Sheet4") || ss.getSheets()[3];
      
      var getSheetData = function(sheet) {
        if (!sheet) return [];
        var data = sheet.getDataRange().getValues();
        var list = [];
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          if (row.length >= 3 && row[0] && row[2]) {
            list.push({ 
              id: String(row[0]).trim(), 
              name: String(row[1]).trim(), 
              pass: String(row[2]).trim() 
            });
          }
        }
        return list;
      };
      
      var response = {
        status: "success",
        it_provincial: getSheetData(itSheet),
        executive: getSheetData(execSheet),
        hospital_staff: getSheetData(hospSheet)
      };
      
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*');
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*');
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบคำสั่งระบุ" }))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*');
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    params = e.parameter;
  }
  
  var action = params.action;
  var sheetName = params.sheetName || "Sheet5";
  var rowValues = params.values || params.row || [];
  
  if (action === "clearSheet") {
    try {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        if (sheetName === "Sheet5") {
          sheet = ss.getSheets()[4] || ss.getSheets()[0];
        } else if (sheetName === "Sheet6") {
          var sheets = ss.getSheets();
          for (var i = 0; i < sheets.length; i++) {
            if (sheets[i].getSheetId() === 847706215) {
              sheet = sheets[i];
              break;
            }
          }
          if (!sheet) sheet = ss.getSheets()[5] || ss.getSheets()[0];
        } else if (sheetName === "Sheet7") {
          sheet = ss.getSheets()[6] || ss.getSheets()[0];
        } else {
          sheet = ss.getSheets()[0];
        }
      }
      if (sheet) {
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "ล้างแผ่นงานเดิมสำเร็จ!" }))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*');
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*');
    }
  }
  
  if (action === "appendRow" || action === "append" || !action) {
    try {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        if (sheetName === "Sheet5") {
          sheet = ss.getSheets()[4] || ss.getSheets()[0];
        } else if (sheetName === "Sheet6") {
          var sheets = ss.getSheets();
          for (var i = 0; i < sheets.length; i++) {
            if (sheets[i].getSheetId() === 847706215) {
              sheet = sheets[i];
              break;
            }
          }
          if (!sheet) sheet = ss.getSheets()[5] || ss.getSheets()[0];
        } else if (sheetName === "Sheet7") {
          sheet = ss.getSheets()[6] || ss.getSheets()[0];
        } else {
          sheet = ss.getSheets()[0];
        }
      }
      
      if (rowValues && rowValues.length > 0) {
        if (Array.isArray(rowValues[0])) {
          // เพิ่มข้อเสนอแนะกลุ่มข้อมูล
          for (var i = 0; i < rowValues.length; i++) {
            sheet.appendRow(rowValues[i]);
          }
        } else {
          // เพิ่มหน้าบันทึกเดี่ยว
          sheet.appendRow(rowValues);
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "บันทึกเรียบร้อย!" }))
          .setMimeType(ContentService.MimeType.JSON)
          .addHeader('Access-Control-Allow-Origin', '*');
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่มีข้อมูลส่งมา" }))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*');
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*');
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบข้อมูลที่ต้องการบันทึก" }))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*');
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCodeTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConnected = !!token || !!appsScriptUrl;

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-xs overflow-hidden" id="google-sheets-sync-panel">
      {/* ส่วนหัวย่อขยาย */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 bg-gradient-to-r from-indigo-50/100 to-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
              ส่วนประสานคลาวด์ Google Sheets & Apps Script Web App
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  เซิร์ฟเวอร์เปิดใช้งานซิงก์
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  ทำงานในเครื่องออฟไลน์
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {appsScriptUrl 
                ? `เชื่อมระบบความมั่นคงจังหวัดสตูลผ่าน Google Apps Script Web App ตนเองเรียลไทม์!` 
                : token
                ? `เชื่อมต่อผ่าน OAuth Token แล้ว ดำเนินการยัดลงตารางชีตอัตโนมัติ`
                : `ข้อมูลผู้ป่วยจะบันทึกใน Local Storage จนกว่าจะเลือกช่องทางซิงก์เพื่อความปลอดภัย`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {appsScriptUrl && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTestScriptConnection();
              }}
              disabled={testingConnection}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg p-1.5 px-2.5 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
              ทดสอบ Apps Script
            </button>
          )}
          {token && !appsScriptUrl && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTestConnection();
              }}
              disabled={testingConnection}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg p-1.5 px-2.5 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
              ทดสอบ API v4
            </button>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* ส่วนขยายตั้งค่าซิงก์ */}
      {isOpen && (
        <div className="p-5 border-t border-slate-100 text-xs font-sans space-y-4">
          
          {/* ส่วนส่งออก/บันทึกทับข้อมูลขึ้นคลาวด์ หากมีการเพิ่มหรือลบกรณี */}
          {isConnected && onOverwriteCloud && (
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-150/70 rounded-xl space-y-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-3xs">
              <div className="space-y-1">
                <h4 className="font-extrabold text-[11px] text-indigo-950 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  ซิงก์ข้อมูลไปคลาวด์ (ส่งออก&เขียนทับกรณีทั้งหมด)
                </h4>
                <p className="text-[10px] text-indigo-700/80 leading-relaxed font-sans max-w-xl">
                  นำข้อมูลระเบียนผู้ป่วยปัจจุบันในเว็บนี้ <span className="font-bold text-slate-800">({patientsCount} ราย)</span> ไปเขียนและบันทึกทับใน Google Sheets ของท่าน (ใช้สำหรับซิงก์ข้อมูลให้มีความตรงกันเมื่อมีการเพิ่ม/ลบ ในระบบสตูลพอร์ทัล)
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOverwriteCloud}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] p-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  ส่งออกข้อมูลทับชีต (Sheet 5)
                </button>
              </div>
            </div>
          )}
          
          {/* ช่องทางการเชื่อมด้วย Google Apps Script Web App URL (เด่นที่สุดสําหรับผู้ใช้) */}
          <div className="bg-gradient-to-br from-teal-50/50 to-white p-4 rounded-xl border border-teal-150/85 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-md bg-teal-100 text-teal-850 font-black text-[9.5px]">วิธีที่ 1</span>
              <h4 className="font-extrabold text-[11.5px] text-teal-900 flex items-center gap-1">
                การซิงก์อัตโนมัติผ่าน Google Apps Script Web App (แนะนำสูงสุด ⚡️)
              </h4>
            </div>
            <p className="text-[10.5px] text-teal-800/80 leading-relaxed">
              ไม่ต้องทำความสะอาด OAuth คีย์ หรือสร้าง Client ID ให้ซับซ้อน! เพียงคุณวางโค้ด Apps Script ลงในชีต 
              จากนั้นนำลิงก์ <strong>Web App URL (https://script.google.com/...)</strong> ล่าสุดด้านล่างมัดรวมเชื่อมระบบได้ทันที
            </p>

            <form onSubmit={handleScriptUrlSubmit} className="space-y-2 pt-1">
              <label className="block text-[10.5px] font-bold text-slate-705">
                ป้อนลิงก์ Google Apps Script Web App URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  placeholder="สสจ.สตูล วางลิงก์เว็บแอปที่ได้จากการ Deploy เช่น https://script.google.com/macros/s/..."
                  value={scriptUrlInput}
                  onChange={(e) => setScriptUrlInput(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-mono outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-3xs"
                />
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold p-2.5 px-4 rounded-xl transition-all cursor-pointer text-xs shrink-0 shadow-xs"
                >
                  บันทึกเชื่อมระบบ
                </button>
              </div>
            </form>

            {appsScriptUrl ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-emerald-150 bg-emerald-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ระบบสตูล พอร์ทัล เชื่อมโยงเข้ากับ Google Apps Script Web App ของท่านแล้ว</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectScript}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-1 px-2.5 rounded-lg transition-all"
                  >
                    ถอนการเชื่อมต่อ
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 gap-3 md:flex items-center shadow-3xs text-left" id="mobile-share-link-helper">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                        ⚡️ สแกน / แชร์ลิงก์ เชื่อมระบบกับโทรศัพท์มือถือด่วน!
                      </span>
                    </div>
                    <p className="text-[10px] text-blue-800/80 leading-relaxed">
                      เนื่องจากความจำข้อมูลเครื่อง (localStorage) จะแยกกันตามเครื่องและเว็บเบราว์เซอร์ เพื่อให้โทรศัพท์มือถือเข้าถึง Google Sheets ของคุณได้ทันทีโดยไม่ต้องไปกรอกลิงก์ใหม่ยาว ๆ ให้ใช้กล้องโทรศัพท์สแกน QR Code นี้ หรือคลิ๊กปุ่มด้านล่างเพื่อแชร์ลิ้งก์ด่วนได้เลย!
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const shareUrl = `${window.location.origin}${window.location.pathname}?scriptUrl=${encodeURIComponent(appsScriptUrl)}`;
                          navigator.clipboard.writeText(shareUrl);
                          alert("✓ คัดลอกลิงก์เรียบร้อย! ส่งสิทธิ์ต่อข้ามเครื่องผ่าน ไลน์ (LINE) หรืออีเมล เมื่อเปิดในโทรศัพท์มือถือ ระบบจะติดตั้งจำลองสิทธิ์การเขียนเชื่อมแผ่นงาน Google Sheets ให้เหมาะสมทันทีโดยไม่ต้องพิมพ์เอง!");
                        }}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-800 hover:bg-blue-100/50 bg-white border border-blue-200 p-1.5 px-3 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        คัดลอกลิงก์แชร์สิทธิ์
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 md:mt-0 flex flex-col items-center justify-center bg-white p-1.5 rounded-xl border border-blue-200 shadow-3xs shrink-0 self-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?scriptUrl=${encodeURIComponent(appsScriptUrl)}`)}`} 
                      alt="QR Code สำหรับมือถือ" 
                      className="w-[85px] h-[85px]"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[8.5px] font-bold text-blue-700 mt-1">สแกนเปิดบนมือถือ</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 text-[10px] bg-slate-50 text-slate-500 italic rounded-lg">
                ⚠️ สถานะ: ดำเนินงานแบบบันทึกออฟไลน์ในเครื่องชั่วคราว นำลิงก์จาก Apps Script วางเพื่อเปิดการสำรองข้อมูลขึ้นคลาวด์ สสจ.สตูล
              </div>
            )}

            {/* โค้ด Apps Script สำหรับคัดลอก */}
            <div className="mt-3 bg-stone-900 text-stone-100 rounded-xl overflow-hidden text-[10.5px] border border-stone-850">
              <div className="bg-stone-850 p-2.5 px-4 flex justify-between items-center select-none font-bold">
                <span className="text-teal-400 font-mono">CODE TO PASTE IN APPS SCRIPT EDITOR</span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="flex items-center gap-1 text-[10px] text-stone-300 hover:text-white bg-stone-800 p-1 px-2.5 rounded-md transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}
                </button>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto font-mono text-stone-300 leading-normal scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-stone-900 whitespace-pre">
                {scriptCodeTemplate}
              </div>
            </div>
          </div>

          {/* วิธีที่ 2: ระบบ Google Sheets API v4 OAuth (สำหรับผู้ใช้ชั้นสูง) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-slate-600/90 leading-relaxed">
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1 px-2 rounded bg-slate-200 text-slate-800 font-black text-[9.5px]">วิธีที่ 2</span>
                  <h4 className="font-extrabold text-[11px] text-slate-800">
                    การซิงก์ดั้งเดิมโดยสิทธิ Google OAuth API v4 Direct
                  </h4>
                </div>
                <ul className="list-disc pl-4 text-slate-500 text-[10px] space-y-0.5">
                  <li>เมื่อป้อนข้อมูลคนไข้ ระบบจะบันทึกเข้า <span className="font-bold text-slate-700">Sheet5</span></li>
                  <li>คำสั่งผู้พิทักษ์จังหวัดจะบันทึกลง <span className="font-bold text-slate-700">Sheet7</span></li>
                  <li>เป้าหมายที่อยู่ ID: <code className="bg-stone-200/50 p-0.5 px-1 rounded text-[9.5px] font-mono break-all">{spreadsheetId}</code></li>
                </ul>
              </div>

              <div className="flex flex-col justify-center items-stretch sm:items-end gap-2 text-right">
                {token ? (
                  <div className="space-y-2 w-full max-w-xs self-end">
                    <div className="p-2.5 rounded-xl border border-emerald-150 bg-emerald-50/40 text-[10.5px] text-emerald-800 font-medium flex items-start gap-2 text-left">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span>เชื่อมต่อ Google OAuth (API v4) พร้อมทำงานเขียนตารางแล้ว</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200/50 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1 text-[11px]"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      ถอนการยืนยันตัวตน Google OAuth
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full max-w-xs self-end">
                    <button
                      type="button"
                      onClick={handleGooglePopupLogin}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm text-[11px]"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      ลงชื่อเข้าใช้ Google (ป๊อปอัปด่วน)
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleRedirectLogin}
                      className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-center text-[10px]"
                    >
                      ลงชื่อเข้าใช้ Google (ย้ายหน้าต่างหลัก)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* รายงานทดสอบคีย์ล่าสุด */}
          {testResult.status !== 'idle' && (
            <div className={`p-3 rounded-xl border leading-relaxed text-[11px] ${
              testResult.status === 'success' 
                ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
                : 'bg-rose-50 border-rose-150 text-rose-800'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span className="font-semibold">{testResult.message}</span>
              </div>
            </div>
          )}

          {/* ฟอร์มป้อนคีย์แบบด่วน หรือใส่ client_id กำหนดเอง */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowConfigOptions(!showConfigOptions)}
              className="text-[10px] text-slate-400 font-bold hover:text-slate-600 flex items-center gap-1 select-none font-semibold cursor-pointer"
            >
              {showConfigOptions ? '▲ ซ่อนการตั้งค่าเพิ่มเติม' : '▼ แสดงช่องทางการเชื่อม Token ลัดแบบควบคุมดิติทัลคอร์บอร์แบรนด์ / แก้ไข Google Client ID เอง'}
            </button>

            {showConfigOptions && (
              <div className="mt-3 bg-slate-50 border border-slate-150/60 p-4 rounded-xl space-y-3">
                {/* 1. กล่องใส่ Token ลัด */}
                <form onSubmit={handleManualTokenSubmit} className="space-y-2">
                  <label className="block text-[10.5px] font-bold text-slate-700 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-indigo-505" />
                    ป้อน OAuth Access Token โดยตรง (ผู้ดูแลเทคนิค)
                  </label>
                  <p className="text-[9.5px] text-slate-400 leading-normal">
                    หากไม่ต้องการล็อกอินป๊อปอัป คุณสามารถนำคีย์ Token จากเว็บไซต์{' '}
                    <a 
                      href="https://developers.google.com/oauthplayground/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-indigo-600 font-bold underline hover:text-indigo-800"
                    >
                      Google OAuth Playground
                    </a>{' '}
                    โดยเลือกสิทธิ์ขอบเขต <code className="bg-slate-200 p-0.5 rounded text-[9px]">https://www.googleapis.com/auth/spreadsheets</code> แล้วนำมาใส่ด้านล่างนี้ได้
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="เช่น ya29.a0AfB_..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 p-2 rounded-lg text-xs font-mono outline-hidden focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!manualToken.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 px-4 rounded-lg disabled:bg-slate-300 transition-all cursor-pointer text-[11px]"
                    >
                      เชื่อมโยง Token ลัด
                    </button>
                  </div>
                </form>

                {/* 2. ฟิลด์ Google Client ID */}
                <div className="space-y-1.5 pt-2 border-t border-slate-205">
                  <label className="block text-[10.5px] font-bold text-slate-700">
                    Custom Google Client ID (ของหน่วยงานสตูลสาธารณสุขอำเภอ/จังหวัด)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="เช่น 123456789-abc.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        localStorage.setItem('custom_google_client_id', e.target.value);
                      }}
                      className="flex-1 bg-white border border-slate-200 p-2 rounded-lg text-xs font-mono outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400">
                    {envClientId 
                      ? '✓ ตรวจพบ Client ID เริ่มต้นในระบบตัวแปร (VITE_GOOGLE_CLIENT_ID) พร้อมใช้งานทันที' 
                      : 'ℹ หากปล่อยว่างเปล่า ระบบจะดึงตาม ตัวแปรระบบ VITE_GOOGLE_CLIENT_ID ที่ระบบจัดตั้งให้'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* รายการประวัติการอัปโหลดข้อมูล (Sync Log List) */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-[10.5px] text-slate-700 block uppercase tracking-wider">
                📊 รายงานบันทึกประวัติการส่งข้อมูลคลาวด์ล่าสุด (Real-time Cloud Logs)
              </span>
              {syncLogs.length > 0 && (
                <button 
                  type="button"
                  onClick={onClearLogs}
                  className="text-[9.5px] font-bold text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded p-1 px-2 cursor-pointer transition-all"
                >
                  ล้างรายงาน
                </button>
              )}
            </div>

            {syncLogs.length === 0 ? (
              <div className="text-center p-3 text-[10px] text-slate-400 italic bg-slate-50/50 rounded-xl border border-slate-100">
                ยังไม่มีการอัปเดตหรือส่งรายงานใดๆ เกิดขึ้นในรอบการออนไลน์นี้
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-150/50 rounded-xl p-2 bg-stone-50/50 font-mono text-[9.5px]">
                {syncLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-1.5 rounded flex items-center justify-between border ${
                      log.type === 'success' 
                        ? 'bg-emerald-50/40 border-emerald-100/60 text-emerald-800' 
                        : log.type === 'error' 
                        ? 'bg-rose-50/40 border-rose-100/60 text-rose-800' 
                        : 'bg-indigo-50/40 border-indigo-100/40 text-indigo-700'
                    }`}
                  >
                    <span className="leading-normal">{log.msg}</span>
                    <span className="text-[8.5px] text-slate-400 select-none">{log.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
