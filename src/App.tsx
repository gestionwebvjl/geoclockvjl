import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogIn, LogOut, Clock, History, User as UserIcon, MapPin, ChevronRight, 
  ArrowLeft, MoreVertical, Edit3, PauseCircle, PlayCircle, Trash2, TimerOff,
  TrendingUp, Coffee, Verified, Share2, Printer, Calendar, ChevronLeft,
  BarChart3, Home, FileText, Settings, Fingerprint, Bell, Mail, Lock, Eye,
  Check, X, Shield, Users, Map, Settings2, Download, AlertTriangle, 
  LayoutDashboard, UserPlus, Building2, Search, Filter, Plus, Trash, CheckCircle2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

// ==========================================
// 1. TIPOS Y UTILIDADES (Para evitar fallos en Vercel)
// ==========================================
export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  employee_id: string;
  department: string;
  role: 'USER' | 'ADMIN';
  horario_manana_inicio?: string;
  horario_manana_fin?: string;
  horario_tarde_inicio?: string;
  horario_tarde_fin?: string;
}

export interface Worksite {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface TimeRecord {
  id: number;
  user_id: number;
  worksite_id: number;
  type: 'IN' | 'OUT';
  latitude: number;
  longitude: number;
  distance: number;
  notes: string;
  timestamp: string;
  user_name?: string;
  worksite_name?: string;
  is_manual?: boolean;
  minutos_extra?: number;
  estado_extra?: string;
}

export function useGeolocation() {
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => { setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setError(null); },
      (err) => { setError(err.message); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { location, error };
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-24 left-4 right-4 p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border ${type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      <p className="text-sm font-bold">{message}</p>
    </motion.div>
  );
};

// ==========================================
// 2. GENERADORES DE PDF
// ==========================================
const generateRecordPDF = (record: TimeRecord, user: User) => {
  const doc = new jsPDF();
  doc.setFontSize(22); doc.setTextColor(255, 140, 0); doc.text('GeoClock - Comprobante de Registro', 20, 20);
  doc.setFontSize(12); doc.setTextColor(100); doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 20, 30);
  doc.setFontSize(16); doc.setTextColor(0); doc.text('Información del Empleado', 20, 45);
  doc.setFontSize(12);
  doc.text(`Nombre: ${record.user_name || user.name}`, 20, 55);
  doc.text(`Email: ${user.email}`, 20, 62);
  doc.text(`ID Empleado: ${user.employee_id}`, 20, 69);
  doc.text(`Departamento: ${user.department}`, 20, 76);
  doc.setFontSize(16); doc.text('Detalles del Registro', 20, 90);
  doc.setFontSize(12);
  doc.text(`Tipo: ${record.type === 'IN' ? 'ENTRADA' : 'SALIDA'}`, 20, 100);
  doc.text(`Fecha: ${new Date(record.timestamp).toLocaleDateString('es-ES')}`, 20, 107);
  doc.text(`Hora: ${new Date(record.timestamp).toLocaleTimeString('es-ES')}`, 20, 114);
  doc.text(`Sede: ${record.worksite_name}`, 20, 121);
  doc.text(`Distancia: ${(record.distance || 0).toFixed(1)}m`, 20, 128);
  doc.text(`Método: ${record.is_manual ? 'Manual' : 'Automático (GPS)'}`, 20, 135);
  if (record.notes) {
    doc.text('Notas:', 20, 148); doc.setFontSize(10); doc.setTextColor(100);
    doc.text(doc.splitTextToSize(record.notes, 170), 20, 155);
  }
  doc.setFontSize(10); doc.setTextColor(150); doc.text('Este documento es un comprobante oficial generado por el sistema GeoClock.', 20, 280);
  doc.save(`Registro_${record.type}_${new Date(record.timestamp).getTime()}.pdf`);
};

const generateFullReportPDF = (records: TimeRecord[], user: User, periodLabel?: string) => {
  if (!records || records.length === 0) return;
  const doc = new jsPDF();
  doc.setFontSize(22); doc.setTextColor(255, 140, 0); doc.text('GeoClock - Informe de Asistencia', 20, 20);
  doc.setFontSize(12); doc.setTextColor(100);
  const isConsolidated = user.employee_id === 'ADMIN';
  doc.text(isConsolidated ? `Informe Consolidado de Administración` : `Empleado: ${user.name} (${user.employee_id})`, 20, 30);
  doc.text(`Periodo: ${periodLabel || new Date(records[0].timestamp).toLocaleDateString('es-ES')}`, 20, 37);

  const recordsByUser: { [key: string]: { name: string, records: TimeRecord[] } } = {};
  if (isConsolidated) {
    records.forEach(r => {
      const userName = r.user_name || `ID: ${r.user_id}`;
      if (!recordsByUser[userName]) recordsByUser[userName] = { name: userName, records: [] };
      recordsByUser[userName].records.push(r);
    });
  } else {
    recordsByUser[user.name] = { name: user.name, records: records };
  }

  let currentY = 45;
  Object.values(recordsByUser).forEach((userData, userIdx) => {
    const sortedRecords = [...userData.records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const dailyTotals: { [key: string]: number } = {};
    let totalUserMs = 0;

    for (let i = 0; i < sortedRecords.length; i++) {
      if (sortedRecords[i].type === 'IN') {
        let nextOutIdx = -1;
        for (let j = i + 1; j < sortedRecords.length; j++) {
          if (sortedRecords[j].type === 'OUT') { nextOutIdx = j; break; }
          else if (sortedRecords[j].type === 'IN') break; 
        }
        if (nextOutIdx !== -1) {
          const diff = new Date(sortedRecords[nextOutIdx].timestamp).getTime() - new Date(sortedRecords[i].timestamp).getTime();
          totalUserMs += diff;
          const outDateStr = new Date(sortedRecords[nextOutIdx].timestamp).toLocaleDateString('es-ES');
          dailyTotals[outDateStr] = (dailyTotals[outDateStr] || 0) + diff;
          i = nextOutIdx;
        }
      }
    }

    if (isConsolidated && userIdx > 0) { doc.addPage(); currentY = 20; }
    if (isConsolidated) { doc.setFontSize(14); doc.setTextColor(0); doc.text(`Empleado: ${userData.name}`, 20, currentY); currentY += 10; }

    const dayLastRecordIndex: { [key: string]: number } = {};
    sortedRecords.forEach((r, idx) => { dayLastRecordIndex[new Date(r.timestamp).toLocaleDateString('es-ES')] = idx; });

    const tableData = sortedRecords.map((r, idx) => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      const isLastOfDay = dayLastRecordIndex[dateStr] === idx;
      const dayTotalMs = dailyTotals[dateStr] || 0;
      let dayTotalStr = '';
      if (isLastOfDay && dayTotalMs > 0) {
        dayTotalStr = `${Math.floor(dayTotalMs / 3600000)}h ${Math.floor((dayTotalMs % 3600000) / 60000)}m`;
      } else if (isLastOfDay && dayTotalMs === 0) {
        dayTotalStr = '0h 0m';
      }
      return [
        dateStr, new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        r.type === 'IN' ? 'Entrada' : 'Salida', r.worksite_name, `${(r.distance || 0).toFixed(1)}m`,
        r.is_manual ? 'Manual' : 'GPS', dayTotalStr
      ];
    });

    const totalUserH = Math.floor(totalUserMs / 3600000);
    const totalUserM = Math.floor((totalUserMs % 3600000) / 60000);

    autoTable(doc, {
      startY: currentY,
      head: [['Fecha', 'Hora', 'Tipo', 'Sede', 'Distancia', 'Método', 'Total Día']],
      body: tableData,
      foot: [['', '', '', '', '', 'TOTAL EMPLEADO:', `${totalUserH}h ${totalUserM}m`]],
      headStyles: { fillColor: [255, 140, 0] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { top: 20 },
      didDrawPage: (data) => { currentY = data.cursor?.y || currentY; }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });
  doc.save(`Informe_${new Date().getTime()}.pdf`);
};

// ==========================================
// 3. COMPONENTES DE LA INTERFAZ
// ==========================================
const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('john@empresa.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'USER' | 'ADMIN'>('USER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) {
      const user = await res.json();
      if (mode === 'ADMIN' && user.role !== 'ADMIN') return setError('Se requieren credenciales de administrador');
      onLogin(user);
    } else setError('Credenciales inválidas');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-['Quicksand']">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/10 mb-4 border border-orange-500/20">
            {mode === 'ADMIN' ? <Shield className="w-10 h-10 text-[#ff8c00]" /> : <Clock className="w-10 h-10 text-[#ff8c00]" />}
          </div>
          <h1 className="text-4xl font-black text-white">{mode === 'ADMIN' ? 'Portal de Administración' : 'GeoClock'}</h1>
        </div>
        <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm flex items-center gap-2"><X className="w-4 h-4" />{error}</div>}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[#ff8c00]" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[#ff8c00]" />
              </div>
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-[#ff8c00] to-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2">Entrar</button>
          </form>
        </div>
        <div className="text-center">
          <button onClick={() => { setMode(mode === 'USER' ? 'ADMIN' : 'USER'); setEmail(''); setPassword(''); }} className="text-sm font-bold text-slate-400 hover:text-white">
            {mode === 'USER' ? '¿Eres administrador?' : 'Volver a Usuario'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ESTE ES EL ÚNICO COMPONENTE DASHBOARD (LIMPIO Y CORREGIDO)
const Dashboard = ({ user, onClockIn, records }: { user: User, onClockIn: (worksiteId: number) => void, records: TimeRecord[] }) => {
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [selectedWorksite, setSelectedWorksite] = useState<number>(0);
  const { location, error: geoError } = useGeolocation();
  const [distance, setDistance] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayRecords = records.filter(r => new Date(r.timestamp).toDateString() === today);
    
    let todayMs = 0;
    const sortedToday = [...todayRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sortedToday.length; i++) {
      if (sortedToday[i].type === 'IN' && sortedToday[i+1]?.type === 'OUT') {
        todayMs += new Date(sortedToday[i+1].timestamp).getTime() - new Date(sortedToday[i].timestamp).getTime();
        i++;
      }
    }

    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const weekRecords = records.filter(r => new Date(r.timestamp) >= monday);
    let weekMs = 0;
    const sortedWeek = [...weekRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sortedWeek.length; i++) {
      if (sortedWeek[i].type === 'IN' && sortedWeek[i+1]?.type === 'OUT') {
        weekMs += new Date(sortedWeek[i+1].timestamp).getTime() - new Date(sortedWeek[i].timestamp).getTime();
        i++;
      }
    }

    return {
      todayStr: `${Math.floor(todayMs / 3600000)}h ${Math.floor((todayMs % 3600000) / 60000)}m`,
      weekStr: `${Math.floor(weekMs / 3600000)}h ${Math.floor((weekMs % 3600000) / 60000)}m`,
      weekPct: Math.min((weekMs / (40 * 3600000)) * 100, 100)
    };
  }, [records]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/worksites').then(res => res.json()).then(data => { setWorksites(data); if (data.length > 0) setSelectedWorksite(data[0].id); });
  }, []);

  useEffect(() => {
    if (location && selectedWorksite) {
      const site = worksites.find(w => w.id === selectedWorksite);
      if (site) setDistance(calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude));
    }
  }, [location, selectedWorksite, worksites]);

  const currentSite = worksites.find(w => w.id === selectedWorksite);
  const canClockIn = distance !== null && currentSite && distance <= currentSite.radius;

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 max-w-md mx-auto w-full font-['Quicksand']">
      <section className="text-center py-6">
        <p className="text-slate-400 font-medium mb-1 capitalize">{currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        <h1 className="text-5xl font-bold text-white mb-4">{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</h1>
      </section>

      <section className="space-y-4 px-2">
        <select value={selectedWorksite} onChange={(e) => setSelectedWorksite(Number(e.target.value))} className="w-full bg-slate-900 border border-orange-500/20 text-white rounded-xl px-4 py-3 outline-none">
          {worksites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
        <div className={`flex items-center gap-2 justify-center py-2 px-4 rounded-lg border ${canClockIn ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-orange-500/5 border-orange-500/10 text-orange-500'}`}>
          <MapPin className="w-4 h-4" />
          <p className="text-xs font-medium">{canClockIn ? `Estás a ${distance?.toFixed(1)}m. Puedes fichar.` : `Acércate a la sede (Estás a ${distance !== null ? distance.toFixed(1) : '?'}m)`}</p>
        </div>
        {geoError && <p className="text-red-500 text-[10px] font-bold mt-2 uppercase w-full text-center">⚠️ Error GPS: {geoError}</p>}
      </section>

      <section className="flex justify-center pb-4">
        <button disabled={!canClockIn} onClick={() => onClockIn(selectedWorksite)} className={`w-full max-w-xs aspect-square rounded-full flex flex-col items-center justify-center text-white transition-all ${canClockIn ? 'bg-[#ff8c00] hover:bg-orange-600' : 'bg-slate-800'}`}>
          <Fingerprint className="w-16 h-16 mb-2" />
          <span className="text-xl font-bold uppercase">Fichar</span>
        </button>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500">Horas Hoy</p>
          <p className="text-2xl font-black text-white">{stats.todayStr}</p>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500">Esta Semana</p>
          <p className="text-2xl font-black text-[#ff8c00]">{stats.weekStr}</p>
          <div className="w-full bg-slate-800 rounded-full h-1 mt-2"><div className="bg-[#ff8c00] h-1 rounded-full" style={{ width: `${stats.weekPct}%` }}></div></div>
        </div>
      </section>
    </div>
  );
};

const ActiveSession = ({ user, onFinish, onDiscard, startTime }: { user: User, onFinish: (notes: string) => void, onDiscard: () => void, startTime: Date }) => {
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date().getTime() - startTime.getTime();
      setElapsed({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 font-['Quicksand'] text-center space-y-8">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-orange-500/10 text-[#ff8c00] border-orange-500/20">
        <span className="animate-ping w-2 h-2 rounded-full bg-[#ff8c00]"></span>TRABAJANDO
      </div>
      <div className="text-6xl font-black tabular-nums">{elapsed.h.toString().padStart(2, '0')}:{elapsed.m.toString().padStart(2, '0')}:{elapsed.s.toString().padStart(2, '0')}</div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-32 p-4 bg-slate-900 border border-slate-800 rounded-xl outline-none" placeholder="Notas del turno..."></textarea>
      <button onClick={() => onFinish(notes)} className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold flex justify-center gap-2 text-white"><TimerOff /> Finalizar Turno</button>
    </div>
  );
};

const HistoryView = ({ records, user, onSelectRecord }: { records: TimeRecord[], user: User, onSelectRecord: (record: TimeRecord) => void }) => (
  <div className="flex-1 p-4 space-y-4 font-['Quicksand'] overflow-y-auto pb-24">
    <h2 className="text-xl font-bold">Historial</h2>
    {records.map(r => (
      <div key={r.id} onClick={() => onSelectRecord(r)} className={`bg-slate-900 p-4 rounded-xl border-l-4 cursor-pointer ${r.type === 'IN' ? 'border-green-500' : 'border-red-500'}`}>
        <p className="font-bold">{new Date(r.timestamp).toLocaleDateString()} - {new Date(r.timestamp).toLocaleTimeString()}</p>
        <p className="text-xs text-slate-500">{r.worksite_name} ({r.type})</p>
      </div>
    ))}
  </div>
);

const RecordDetailView = ({ record, user, onBack }: { record: TimeRecord, user: User, onBack: () => void }) => (
  <div className="flex-1 p-6 space-y-6 font-['Quicksand']">
    <button onClick={onBack}><ArrowLeft /></button>
    <div className="bg-slate-900 p-6 rounded-xl space-y-2">
      <h2 className="text-2xl font-bold text-[#ff8c00]">{record.type === 'IN' ? 'Entrada' : 'Salida'}</h2>
      <p>{new Date(record.timestamp).toLocaleString()}</p>
      <p>Distancia: {record.distance.toFixed(1)}m</p>
      <p>Notas: {record.notes || 'N/A'}</p>
    </div>
    <button onClick={() => generateRecordPDF(record, user)} className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold">Descargar Comprobante</button>
  </div>
);

const WeeklySummaryView = ({ records, user, showToast }: { records: TimeRecord[], user: User, showToast: (msg: string, type: 'success' | 'error') => void }) => (
  <div className="flex-1 p-6 text-center space-y-6 font-['Quicksand']">
    <h2 className="text-2xl font-bold">Resumen Semanal</h2>
    <button onClick={() => { generateFullReportPDF(records, user); showToast('PDF Generado', 'success'); }} className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold">Descargar Informe</button>
  </div>
);

const UserModal = ({ user, onSave, onClose }: { user?: User, onSave: (u: any) => Promise<void>, onClose: () => void }) => {
  const [f, setF] = useState({ 
    name: user?.name || '', email: user?.email || '', password: user?.password || '123456', 
    employee_id: user?.employee_id || '', department: user?.department || '', role: user?.role || 'USER',
    horario_manana_inicio: user?.horario_manana_inicio || '08:00', horario_manana_fin: user?.horario_manana_fin || '14:00',
    horario_tarde_inicio: user?.horario_tarde_inicio || '15:00', horario_tarde_fin: user?.horario_tarde_fin || '18:00'
  });
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 p-6 rounded-2xl w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold">Usuario</h3>
        <input placeholder="Nombre" value={f.name} onChange={e=>setF({...f,name:e.target.value})} className="w-full bg-slate-900 p-3 rounded" />
        <input placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} className="w-full bg-slate-900 p-3 rounded" />
        <input placeholder="ID" value={f.employee_id} onChange={e=>setF({...f,employee_id:e.target.value})} className="w-full bg-slate-900 p-3 rounded" />
        <select value={f.role} onChange={e=>setF({...f,role:e.target.value as 'USER'|'ADMIN'})} className="w-full bg-slate-900 p-3 rounded"><option value="USER">User</option><option value="ADMIN">Admin</option></select>
        
        <p className="text-orange-500 font-bold mt-4">Horario Mañana</p>
        <div className="flex gap-2"><input type="time" value={f.horario_manana_inicio} onChange={e=>setF({...f,horario_manana_inicio:e.target.value})} className="bg-slate-900 p-2 rounded flex-1" /><input type="time" value={f.horario_manana_fin} onChange={e=>setF({...f,horario_manana_fin:e.target.value})} className="bg-slate-900 p-2 rounded flex-1" /></div>
        
        <p className="text-orange-500 font-bold mt-2">Horario Tarde</p>
        <div className="flex gap-2"><input type="time" value={f.horario_tarde_inicio} onChange={e=>setF({...f,horario_tarde_inicio:e.target.value})} className="bg-slate-900 p-2 rounded flex-1" /><input type="time" value={f.horario_tarde_fin} onChange={e=>setF({...f,horario_tarde_fin:e.target.value})} className="bg-slate-900 p-2 rounded flex-1" /></div>
        
        <div className="flex gap-2 mt-4"><button onClick={()=>onSave(f)} className="flex-1 bg-orange-500 p-3 rounded font-bold">Guardar</button><button onClick={onClose} className="flex-1 bg-slate-800 p-3 rounded">Cancelar</button></div>
      </div>
    </div>
  );
};

const UserManagementView = ({ users, onAdd, onUpdate, onDelete, onBack }: any) => {
  const [show, setShow] = useState(false); const [edit, setEdit] = useState<any>();
  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto pb-24"><button onClick={onBack}><ArrowLeft/></button><h2 className="text-2xl font-bold flex justify-between">Usuarios <button onClick={()=>{setEdit(null);setShow(true);}}><Plus className="text-orange-500"/></button></h2>
    {users.map((u:any) => (<div key={u.id} className="bg-slate-900 p-4 rounded flex justify-between"><p>{u.name}</p><div><button onClick={()=>{setEdit(u);setShow(true);}}><Edit3 className="w-4 mr-3"/></button><button onClick={()=>onDelete(u.id)}><Trash className="w-4 text-red-500"/></button></div></div>))}
    {show && <UserModal user={edit} onClose={()=>setShow(false)} onSave={edit?(d)=>onUpdate(edit.id,d):onAdd} />}</div>
  );
};

const PendingRequestsView = ({ onBack, onActionComplete, requests }: any) => (
  <div className="flex-1 p-6 space-y-4 overflow-y-auto pb-24">
    <button onClick={onBack}><ArrowLeft/></button><h2 className="text-2xl font-bold">Alertas</h2>
    {requests.map((r:any) => (
      <div key={r.id} className="bg-slate-900 p-4 rounded space-y-2">
        <p className="font-bold">{r.user_name}</p>
        {r.distance > 100 && <span className="text-red-500 text-xs">FUERA DE RANGO</span>}
        {r.estado_extra === 'PENDIENTE' && <span className="text-orange-500 text-xs ml-2">+{r.minutos_extra} MIN EXTRAS</span>}
        <div className="flex gap-2 mt-2"><button onClick={()=>onActionComplete(r.id, 'APPROVED')} className="bg-green-500 p-2 rounded flex-1">Aprobar</button><button onClick={()=>onActionComplete(r.id, 'REJECTED')} className="bg-red-500 p-2 rounded flex-1">Rechazar</button></div>
      </div>
    ))}
  </div>
);

// EL COMPONENTE APP PRINCIPAL
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [userRecords, setUserRecords] = useState<TimeRecord[]>([]);
  const [allRecords, setAllRecords] = useState<TimeRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminWorksites, setAdminWorksites] = useState<Worksite[]>([]);
  const [pendingReqs, setPendingReqs] = useState([]);
  const { location } = useGeolocation();

  useEffect(() => {
    if (user) {
      fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
      fetch(`/api/status/${user.id}`).then(res => res.json()).then(s => { if (s.isClockedIn) { setIsClockedIn(true); setStartTime(new Date(s.startTime)); } });
      if (user.role === 'ADMIN') fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    const [u, w, r, p] = await Promise.all([
      fetch('/api/admin/users').then(res => res.json()), fetch('/api/admin/worksites').then(res => res.json()),
      fetch('/api/admin/records').then(res => res.json()), fetch('/api/admin/pending-records').then(res => res.json())
    ]);
    setAdminUsers(u); setAdminWorksites(w); setAllRecords(r); setPendingReqs(p);
  };

  const handleClockIn = async (worksiteId: number) => {
    if (!user || !location) return;
    const site = adminWorksites.find(w => w.id === worksiteId) || await fetch('/api/worksites').then(res=>res.json()).then(ws=>ws.find((w:any)=>w.id===worksiteId));
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    const res = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, worksite_id: worksiteId, type: 'IN', latitude: location.latitude, longitude: location.longitude, distance: dist, notes: '' }) });
    if (res.ok) { setIsClockedIn(true); setStartTime(new Date()); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); }
  };

  const handleClockOut = async (notes: string) => {
    if (!user || !location) return;
    const lastRecord = userRecords[0];
    const site = adminWorksites.find(w => w.id === lastRecord.worksite_id) || await fetch('/api/worksites').then(res=>res.json()).then(ws=>ws.find((w:any)=>w.id===lastRecord.worksite_id));
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    
    const now = new Date();
    const esManana = now.getHours() < 14 || (now.getHours() === 14 && now.getMinutes() < 30);
    const horaSalidaPrevista = esManana ? (user.horario_manana_fin || "14:00") : (user.horario_tarde_fin || "18:00");
    const [hP, mP] = horaSalidaPrevista.split(':').map(Number);
    const previstoMs = (hP * 60 + mP) * 60000;
    const actualMs = (now.getHours() * 60 + now.getMinutes()) * 60000;
    let minutosExtra = 0; let estadoExtra = 'N/A';
    
    if (actualMs > previstoMs + 300000) { minutosExtra = Math.floor((actualMs - previstoMs) / 60000); estadoExtra = 'PENDIENTE'; }

    const res = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, worksite_id: lastRecord.worksite_id, type: 'OUT', latitude: location.latitude, longitude: location.longitude, distance: dist, notes, minutos_extra: minutosExtra, estado_extra: estadoExtra }) });
    if (res.ok) { setIsClockedIn(false); setStartTime(null); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); if (user.role === 'ADMIN') fetchAdminData(); }
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-['Quicksand']">
      <header className="flex justify-between p-4 border-b border-orange-500/10"><div className="flex gap-2"><Clock className="text-orange-500"/> <h2 className="font-bold">GeoClock</h2></div><button onClick={() => setUser(null)}><LogOut className="text-red-500"/></button></header>
      <main className="flex-1 flex flex-col overflow-y-auto">
        {user.role === 'ADMIN' ? (
          <>
            {activeTab === 'home' && <div className="p-6 space-y-4"><h1 className="text-2xl font-bold">Panel Admin</h1><button onClick={()=>setActiveTab('admin-users')} className="w-full p-4 bg-slate-900 rounded font-bold">Usuarios</button><button onClick={()=>setActiveTab('admin-requests')} className="w-full p-4 bg-slate-900 rounded font-bold text-orange-500">Alertas Pendientes ({pendingReqs.length})</button></div>}
            {activeTab === 'admin-users' && <UserManagementView users={adminUsers} onBack={()=>setActiveTab('home')} onAdd={async(d:any)=>{await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});fetchAdminData();}} onUpdate={async(id:any,d:any)=>{await fetch(`/api/admin/users/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});fetchAdminData();}} onDelete={async(id:any)=>{if(confirm('¿Borrar?')){await fetch(`/api/admin/users/${id}`,{method:'DELETE'});fetchAdminData();}}} />}
            {activeTab === 'admin-requests' && <PendingRequestsView requests={pendingReqs} onBack={()=>setActiveTab('home')} onActionComplete={async(id:any, status:any)=>{await fetch('/api/admin/records/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});fetchAdminData();}} />}
          </>
        ) : (
          <>
            {activeTab === 'home' && (isClockedIn ? <ActiveSession user={user} startTime={startTime!} onFinish={handleClockOut} onDiscard={()=>setIsClockedIn(false)} /> : <Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />)}
            {activeTab === 'history' && <HistoryView records={userRecords} user={user} onSelectRecord={()=>{}} />}
            {activeTab === 'summary' && <WeeklySummaryView records={userRecords} user={user} showToast={(m,t)=>setToast({message:m,type:t})} />}
          </>
        )}
      </main>
      <nav className="fixed bottom-0 w-full bg-slate-950 border-t border-slate-800 flex justify-around p-4 z-50">
        <button onClick={()=>setActiveTab('home')} className={activeTab === 'home' ? 'text-orange-500' : 'text-slate-500'}><Home/></button>
        {user.role === 'USER' && <><button onClick={()=>setActiveTab('history')} className={activeTab === 'history' ? 'text-orange-500' : 'text-slate-500'}><History/></button><button onClick={()=>setActiveTab('summary')}
