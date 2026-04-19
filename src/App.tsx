import React, { useState, useEffect, useMemo } from 'react';
import { User, Worksite, Record, useGeolocation, calculateDistance } from './types';
import { LogIn, LogOut, Clock, History, User as UserIcon, MapPin, ChevronRight, ArrowLeft, MoreVertical, Edit3, PauseCircle, PlayCircle, Trash2, TimerOff, TrendingUp, Coffee, Verified, Share2, Printer, Calendar, ChevronLeft, BarChart3, Home, FileText, Settings, Fingerprint, Bell, Mail, Lock, Eye, Check, X, Shield, Users, Map, Settings2, Download, AlertTriangle, LayoutDashboard, UserPlus, Building2, Search, Filter, Plus, Trash, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-24 left-4 right-4 p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border ${type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      <p className="text-sm font-bold">{message}</p>
    </motion.div>
  );
};

const generateRecordPDF = (record: Record, user: User) => {
  const doc = new jsPDF();
  doc.setFontSize(22); doc.setTextColor(255, 140, 0); doc.text('GeoClock - Comprobante de Registro', 20, 20);
  doc.setFontSize(12); doc.setTextColor(100); doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 20, 30);
  doc.setFontSize(16); doc.setTextColor(0); doc.text('Información del Empleado', 20, 45);
  doc.setFontSize(12); doc.text(`Nombre: ${record.user_name || user.name}`, 20, 55); doc.text(`Email: ${user.email}`, 20, 62); doc.text(`ID Empleado: ${user.employee_id}`, 20, 69); doc.text(`Departamento: ${user.department}`, 20, 76);
  doc.setFontSize(16); doc.text('Detalles del Registro', 20, 90);
  doc.setFontSize(12); doc.text(`Tipo: ${record.type === 'IN' ? 'ENTRADA' : 'SALIDA'}`, 20, 100); doc.text(`Fecha: ${new Date(record.timestamp).toLocaleDateString('es-ES')}`, 20, 107); doc.text(`Hora: ${new Date(record.timestamp).toLocaleTimeString('es-ES')}`, 20, 114); doc.text(`Sede: ${record.worksite_name}`, 20, 121); doc.text(`Distancia: ${(record.distance || 0).toFixed(1)}m`, 20, 128); doc.text(`Método: ${record.is_manual ? 'Manual' : 'Automático (GPS)'}`, 20, 135);
  doc.save(`Registro_${record.type}_${new Date().getTime()}.pdf`);
};

const generateFullReportPDF = (records: Record[], user: User, periodLabel?: string) => {
  if (!records || records.length === 0) return;
  const doc = new jsPDF();
  doc.setFontSize(22); doc.setTextColor(255, 140, 0); doc.text('GeoClock - Informe de Asistencia', 20, 20);
  doc.setFontSize(12); doc.setTextColor(100);
  const isConsolidated = user.employee_id === 'ADMIN';
  doc.text(isConsolidated ? `Informe Consolidado de Administración` : `Empleado: ${user.name} (${user.employee_id})`, 20, 30);
  doc.text(`Periodo: ${periodLabel || new Date(records[0].timestamp).toLocaleDateString('es-ES')}`, 20, 37);

  const recordsByUser: { [key: string]: { name: string, records: Record[] } } = {};
  if (isConsolidated) { records.forEach(r => { const userName = r.user_name || `ID: ${r.user_id}`; if (!recordsByUser[userName]) recordsByUser[userName] = { name: userName, records: [] }; recordsByUser[userName].records.push(r); }); } else { recordsByUser[user.name] = { name: user.name, records: records }; }

  let currentY = 45;
  Object.values(recordsByUser).forEach((userData, userIdx) => {
    const sortedRecords = [...userData.records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const dailyTotals: { [key: string]: number } = {}; let totalUserMs = 0;
    for (let i = 0; i < sortedRecords.length; i++) {
      if (sortedRecords[i].type === 'IN') {
        let nextOutIdx = -1;
        for (let j = i + 1; j < sortedRecords.length; j++) { if (sortedRecords[j].type === 'OUT') { nextOutIdx = j; break; } else if (sortedRecords[j].type === 'IN') { break; } }
        if (nextOutIdx !== -1) {
          const inTime = new Date(sortedRecords[i].timestamp).getTime(); const outTime = new Date(sortedRecords[nextOutIdx].timestamp).getTime(); const diff = outTime - inTime;
          totalUserMs += diff;
          const outDateStr = new Date(sortedRecords[nextOutIdx].timestamp).toLocaleDateString('es-ES');
          dailyTotals[outDateStr] = (dailyTotals[outDateStr] || 0) + diff;
          i = nextOutIdx;
        }
      }
    }

    if (isConsolidated) { if (userIdx > 0) { doc.addPage(); currentY = 20; } doc.setFontSize(14); doc.setTextColor(0); doc.text(`Empleado: ${userData.name}`, 20, currentY); currentY += 10; }
    const dayLastRecordIndex: { [key: string]: number } = {};
    sortedRecords.forEach((r, idx) => { const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES'); dayLastRecordIndex[dateStr] = idx; });
    const tableData = sortedRecords.map((r, idx) => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES'); const isLastOfDay = dayLastRecordIndex[dateStr] === idx; const dayTotalMs = dailyTotals[dateStr] || 0;
      let dayTotalStr = '';
      if (isLastOfDay && dayTotalMs > 0) { const h = Math.floor(dayTotalMs / 3600000); const m = Math.floor((dayTotalMs % 3600000) / 60000); dayTotalStr = `${h}h ${m}m`; } else if (isLastOfDay && dayTotalMs === 0) { dayTotalStr = '0h 0m'; }
      let typeText = r.type === 'IN' ? 'Entrada' : 'Salida'; if (r.estado_extra === 'PENDIENTE') typeText += ' (+Extras)';
      return [ dateStr, new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), typeText, r.worksite_name, `${(r.distance || 0).toFixed(1)}m`, r.is_manual ? 'Manual' : 'GPS', dayTotalStr ];
    });
    
    const totalUserH = Math.floor(totalUserMs / 3600000); const totalUserM = Math.floor((totalUserMs % 3600000) / 60000);
    autoTable(doc, { startY: currentY, head: [['Fecha', 'Hora', 'Tipo', 'Sede', 'Distancia', 'Método', 'Total Día']], body: tableData, foot: [['', '', '', '', '', 'TOTAL EMPLEADO:', `${totalUserH}h ${totalUserM}m`]], headStyles: { fillColor: [255, 140, 0] }, footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [245, 245, 245] }, margin: { top: 20 }, didDrawPage: (data) => { currentY = data.cursor?.y || currentY; } });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });
  doc.save(`Informe_Asistencia_${new Date().getTime()}.pdf`);
};

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('john@empresa.com'); const [password, setPassword] = useState('password123'); const [error, setError] = useState(''); const [mode, setMode] = useState<'USER' | 'ADMIN'>('USER');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) { const user = await res.json(); if (mode === 'ADMIN' && user.role !== 'ADMIN') { setError('Se requieren credenciales de administrador'); return; } onLogin(user); } else { setError('Credenciales inválidas'); }
  };
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-['Quicksand']">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/10 mb-4 border border-orange-500/20">{mode === 'ADMIN' ? <Shield className="w-10 h-10 text-[#ff8c00]" /> : <Clock className="w-10 h-10 text-[#ff8c00]" />}</div>
          <h1 className="text-4xl font-black text-white tracking-tight">{mode === 'ADMIN' ? 'Portal de Administración' : 'GeoClock'}</h1>
        </div>
        <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm flex items-center gap-2"><X className="w-4 h-4" />{error}</div>}
            <div className="space-y-2"><label className="text-sm font-bold text-slate-400 ml-1">Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-[#ff8c00]" /></div></div>
            <div className="space-y-2"><label className="text-sm font-bold text-slate-400 ml-1">Contraseña</label><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:border-[#ff8c00]" /></div></div>
            <button type="submit" className="w-full bg-gradient-to-r from-[#ff8c00] to-orange-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"><span>Entrar</span><ChevronRight className="w-5 h-5" /></button>
          </form>
        </div>
        <div className="text-center"><button onClick={() => { setMode(mode === 'USER' ? 'ADMIN' : 'USER'); setEmail(''); setPassword(''); }} className="text-sm font-bold text-slate-400 hover:text-white transition-colors">{mode === 'USER' ? '¿Eres administrador? Acceder al Panel' : 'Volver al Inicio de Sesión'}</button></div>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ user, onClockIn, records }: { user: User, onClockIn: (worksiteId: number) => void, records: Record[] }) => {
  const [worksites, setWorksites] = useState<Worksite[]>([]); const [selectedWorksite, setSelectedWorksite] = useState<number>(0);
  const { location, error: geoError } = useGeolocation(); const [distance, setDistance] = useState<number | null>(null); const [currentTime, setCurrentTime] = useState(new Date());

  const stats = useMemo(() => {
    const today = new Date().toDateString(); const todayRecords = records.filter(r => new Date(r.timestamp).toDateString() === today);
    let todayMs = 0; const sortedToday = [...todayRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sortedToday.length; i++) { if (sortedToday[i].type === 'IN' && sortedToday[i+1]?.type === 'OUT') { todayMs += new Date(sortedToday[i+1].timestamp).getTime() - new Date(sortedToday[i].timestamp).getTime(); i++; } }
    const now = new Date(); const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1); const monday = new Date(now.setDate(diff)); monday.setHours(0, 0, 0, 0);
    const weekRecords = records.filter(r => new Date(r.timestamp) >= monday);
    let weekMs = 0; const sortedWeek = [...weekRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sortedWeek.length; i++) { if (sortedWeek[i].type === 'IN' && sortedWeek[i+1]?.type === 'OUT') { weekMs += new Date(sortedWeek[i+1].timestamp).getTime() - new Date(sortedWeek[i].timestamp).getTime(); i++; } }
    return {
      todayStr: `${Math.floor(todayMs / 3600000)}h ${Math.floor((todayMs % 3600000) / 60000)}m`,
      weekStr: `${Math.floor(weekMs / 3600000)}h ${Math.floor((weekMs % 3600000) / 60000)}m`,
      weekPct: Math.min((weekMs / (40 * 3600000)) * 100, 100)
    };
  }, [records]);

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { fetch('/api/worksites').then(res => res.json()).then(data => { setWorksites(data); if (data.length > 0) setSelectedWorksite(data[0].id); }); }, []);
  useEffect(() => { if (location && selectedWorksite) { const site = worksites.find(w => w.id === selectedWorksite); if (site) setDistance(calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude)); } }, [location, selectedWorksite, worksites]);

  const currentSite = worksites.find(w => w.id === selectedWorksite);
  const canClockIn = distance !== null && currentSite && distance <= currentSite.radius;

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 max-w-md mx-auto w-full font-['Quicksand'] pb-24">
      <section className="text-center py-6">
        <p className="text-slate-400 font-medium mb-1 capitalize">{currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        <h1 className="text-5xl font-bold tracking-tight text-white mb-4">{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</h1>
      </section>
      <section className="space-y-4 px-2">
        <div className="relative">
          <select value={selectedWorksite} onChange={(e) => setSelectedWorksite(Number(e.target.value))} className="w-full bg-slate-900 border border-orange-500/20 text-white rounded-xl px-4 py-3 outline-none font-medium appearance-none">
            {worksites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[#ff8c00]" />
        </div>
        <div className={`flex items-center gap-2 justify-center py-2 px-4 rounded-lg border ${canClockIn ? 'bg-green-500/10 border-green-500/20' : 'bg-orange-500/5 border-orange-500/10'}`}>
          <MapPin className={`w-4 h-4 ${canClockIn ? 'text-green-500' : 'text-[#ff8c00]'}`} />
          <p className={`text-xs font-medium ${canClockIn ? 'text-green-500' : 'text-slate-400'}`}>{canClockIn ? `¡Estás a ${distance?.toFixed(1)}m! Puedes fichar.` : `Acércate a la sede (Estás a ${distance !== null ? distance.toFixed(1) : '?'}m)`}</p>
        </div>
        {geoError && <p className="text-red-500 text-[10px] font-bold mt-2 uppercase w-full text-center">⚠️ Error GPS: {geoError}</p>}
      </section>
      <section className="flex justify-center pb-4">
        <button disabled={!canClockIn} onClick={() => onClockIn(selectedWorksite)} className={`w-full max-w-xs aspect-square rounded-full shadow-xl flex flex-col items-center justify-center text-white transition-all ${canClockIn ? 'bg-[#ff8c00] hover:bg-orange-600 cursor-pointer' : 'bg-slate-800 cursor-not-allowed'}`}>
          <Fingerprint className="w-16 h-16 mb-2" /><span className="text-xl font-bold uppercase">Fichar Entrada</span>
        </button>
      </section>
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Horas Hoy</p><p className="text-2xl font-black text-white">{stats.todayStr}</p></div>
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Esta Semana</p><p className="text-2xl font-black text-[#ff8c00]">{stats.weekStr}</p></div>
      </section>
    </div>
  );
};

const ActiveSession = ({ user, onFinish, onDiscard, startTime }: { user: User, onFinish: (notes: string) => void, onDiscard: () => void, startTime: Date }) => {
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 }); const [notes, setNotes] = useState('');
  useEffect(() => { const interval = setInterval(() => { const diff = new Date().getTime() - startTime.getTime(); setElapsed({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) }); }, 1000); return () => clearInterval(interval); }, [startTime]);
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 font-['Quicksand'] pb-24">
      <div className="flex justify-center mb-8"><div className="bg-orange-500/10 text-[#ff8c00] px-4 py-1.5 rounded-full flex items-center gap-2"><span className="animate-ping w-2 h-2 rounded-full bg-[#ff8c00]"></span><span className="text-xs font-semibold uppercase">TRABAJANDO ACTUALMENTE</span></div></div>
      <div className="text-center mb-8"><div className="flex justify-center items-baseline gap-2">
        <div className="flex flex-col items-center"><span className="text-6xl font-bold text-white">{elapsed.h.toString().padStart(2, '0')}</span><span className="text-[10px] text-slate-500">HORAS</span></div><span className="text-5xl font-light mb-6">:</span>
        <div className="flex flex-col items-center"><span className="text-6xl font-bold text-white">{elapsed.m.toString().padStart(2, '0')}</span><span className="text-[10px] text-slate-500">MINUTOS</span></div><span className="text-5xl font-light mb-6">:</span>
        <div className="flex flex-col items-center"><span className="text-6xl font-bold text-white">{elapsed.s.toString().padStart(2, '0')}</span><span className="text-[10px] text-slate-500">SEGUNDOS</span></div>
      </div></div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-32 p-4 bg-slate-900 border border-slate-800 rounded-xl outline-none" placeholder="Añade notas del turno..." />
      <button onClick={() => onFinish(notes)} className="mt-8 w-full bg-[#ff8c00] py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white"><TimerOff /> Finalizar Turno</button>
    </div>
  );
};

const HistoryView = ({ records, user, onSelectRecord }: { records: Record[], user: User, onSelectRecord: (record: Record) => void }) => (
  <div className="flex-1 px-4 py-6 space-y-4 pb-24 font-['Quicksand']">
    <h2 className="text-xl font-bold">Historial de Registros</h2>
    <div className="space-y-4">
      {records.map(record => (
        <div key={record.id} onClick={() => onSelectRecord(record)} className={`bg-slate-900 rounded-xl border-l-4 p-4 flex justify-between cursor-pointer border border-slate-800 ${record.type === 'IN' ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 w-14 h-14 rounded-lg flex flex-col items-center justify-center"><span className="text-xl font-black">{new Date(record.timestamp).getDate()}</span><span className="text-[10px] text-slate-500 uppercase">{new Date(record.timestamp).toLocaleDateString('es-ES', {month:'short'})}</span></div>
            <div><p className="font-bold">{record.type === 'IN' ? 'Entrada' : 'Salida'} {record.estado_extra === 'PENDIENTE' && <span className="text-orange-500 text-[10px] ml-2">+Extras</span>}</p><p className="text-xs text-slate-400">{new Date(record.timestamp).toLocaleTimeString()} • {record.worksite_name}</p></div>
          </div>
          <Printer className="w-5 h-5 text-slate-500" />
        </div>
      ))}
    </div>
  </div>
);

const RecordDetailView = ({ record, user, onBack }: { record: Record, user: User, onBack: () => void }) => (
  <div className="flex-1 bg-slate-950 font-['Quicksand'] pb-24">
    <header className="flex items-center gap-4 p-4 border-b border-slate-800"><button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full"><ArrowLeft /></button><h1 className="text-lg font-semibold">Detalle del Registro</h1></header>
    <div className="p-6 space-y-6">
      <div className="bg-slate-900 p-6 rounded-xl"><h2 className="text-3xl font-bold text-[#ff8c00]">{record.type === 'IN' ? 'Entrada' : 'Salida'}</h2><p className="text-slate-400">{new Date(record.timestamp).toLocaleString()}</p></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl"><p className="text-slate-500 text-[10px] uppercase font-bold">Sede</p><p className="font-bold">{record.worksite_name}</p></div>
        <div className="bg-slate-900 p-4 rounded-xl"><p className="text-slate-500 text-[10px] uppercase font-bold">Distancia</p><p className="font-bold">{record.distance.toFixed(1)}m</p></div>
      </div>
      {record.minutos_extra ? (
        <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl"><p className="text-orange-500 text-[10px] uppercase font-bold">Horas Extra</p><p className="font-bold text-orange-400">+{record.minutos_extra} min ({record.estado_extra})</p></div>
      ) : null}
      <div className="bg-slate-900 p-6 rounded-xl"><p className="text-slate-500 text-[10px] uppercase font-bold mb-2">Notas</p><p className="italic">"{record.notes || 'Sin notas'}"</p></div>
      <button onClick={() => generateRecordPDF(record, user)} className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold flex justify-center gap-2"><Printer /> Descargar Comprobante</button>
    </div>
  </div>
);

const WeeklySummaryView = ({ records, user, showToast }: { records: Record[], user: User, showToast: (msg: string, type: 'success' | 'error') => void }) => (
  <div className="flex-1 p-6 text-center space-y-6 font-['Quicksand'] pb-24">
    <h2 className="text-2xl font-bold mt-4">Informes Generales</h2>
    <button onClick={() => { generateFullReportPDF(records, user); showToast('Informe PDF Generado', 'success'); }} className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold flex justify-center gap-2"><FileText /> Descargar Informe</button>
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold">{user ? 'Editar' : 'Añadir'} Empleado</h3>
        <input placeholder="Nombre" value={f.name} onChange={e=>setF({...f,name:e.target.value})} className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" />
        <input placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" />
        <input placeholder="Contraseña" value={f.password} onChange={e=>setF({...f,password:e.target.value})} className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="ID (EMP-01)" value={f.employee_id} onChange={e=>setF({...f,employee_id:e.target.value})} className="bg-slate-900 border border-slate-800 p-3 rounded-xl w-full" />
          <select value={f.role} onChange={e=>setF({...f,role:e.target.value as 'USER'|'ADMIN'})} className="bg-slate-900 border border-slate-800 p-3 rounded-xl w-full"><option value="USER">Usuario</option><option value="ADMIN">Admin</option></select>
        </div>
        <div className="pt-4 border-t border-slate-800">
          <p className="text-orange-500 font-bold mb-2">Horario Mañana</p>
          <div className="flex gap-2"><input type="time" value={f.horario_manana_inicio} onChange={e=>setF({...f,horario_manana_inicio:e.target.value})} className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex-1" /><input type="time" value={f.horario_manana_fin} onChange={e=>setF({...f,horario_manana_fin:e.target.value})} className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex-1" /></div>
          <p className="text-orange-500 font-bold mt-4 mb-2">Horario Tarde</p>
          <div className="flex gap-2"><input type="time" value={f.horario_tarde_inicio} onChange={e=>setF({...f,horario_tarde_inicio:e.target.value})} className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex-1" /><input type="time" value={f.horario_tarde_fin} onChange={e=>setF({...f,horario_tarde_fin:e.target.value})} className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex-1" /></div>
        </div>
        <div className="flex gap-2 mt-4"><button onClick={()=>onSave(f)} className="flex-1 bg-orange-500 p-3 rounded-xl font-bold">Guardar</button><button onClick={onClose} className="flex-1 bg-slate-800 p-3 rounded-xl text-slate-400">Cancelar</button></div>
      </div>
    </div>
  );
};

const UserManagementView = ({ users, onAdd, onUpdate, onDelete, onBack }: any) => {
  const [show, setShow] = useState(false); const [edit, setEdit] = useState<any>();
  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto pb-24"><div className="flex gap-4 items-center mb-6"><button onClick={onBack}><ArrowLeft/></button><h2 className="text-2xl font-bold flex-1">Usuarios</h2> <button onClick={()=>{setEdit(null);setShow(true);}} className="bg-[#ff8c00] p-2 rounded-xl"><Plus/></button></div>
    {users.map((u:any) => (<div key={u.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center"><div><p className="font-bold">{u.name}</p><p className="text-xs text-slate-500">{u.role}</p></div><div className="flex gap-2"><button onClick={()=>{setEdit(u);setShow(true);}} className="p-2"><Edit3 className="w-5 text-slate-500"/></button><button onClick={()=>onDelete(u.id)} className="p-2"><Trash className="w-5 text-red-500"/></button></div></div>))}
    {show && <UserModal user={edit} onClose={()=>setShow(false)} onSave={edit?(d:any)=>onUpdate(edit.id,d):onAdd} />}</div>
  );
};

const WorksiteModal = ({ worksite, onSave, onClose }: any) => {
  const [f, setF] = useState({ name: worksite?.name || '', address: worksite?.address || '', latitude: worksite?.latitude || 40.4, longitude: worksite?.longitude || -3.7, radius: worksite?.radius || 100 });
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl w-full max-w-md space-y-4"><h3 className="text-2xl font-bold">Sede</h3>
      <input placeholder="Nombre" value={f.name} onChange={e=>setF({...f,name:e.target.value})} className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" />
      <div className="flex gap-2"><input type="number" placeholder="Latitud" value={f.latitude} onChange={e=>setF({...f,latitude:parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-800 p-3 rounded-xl w-full" /><input type="number" placeholder="Longitud" value={f.longitude} onChange={e=>setF({...f,longitude:parseFloat(e.target.value)})} className="bg-slate-900 border border-slate-800 p-3 rounded-xl w-full" /></div>
      <p className="text-sm text-slate-400">Radio: {f.radius}m</p><input type="range" min="10" max="1000" value={f.radius} onChange={e=>setF({...f,radius:parseInt(e.target.value)})} className="w-full accent-orange-500" />
      <div className="flex gap-2 mt-4"><button onClick={()=>onSave(f)} className="flex-1 bg-orange-500 p-3 rounded-xl font-bold">Guardar</button><button onClick={onClose} className="flex-1 bg-slate-800 p-3 rounded-xl text-slate-400">Cancelar</button></div></div>
    </div>
  );
};

const WorksiteManagementView = ({ worksites, onAdd, onUpdate, onDelete, onBack }: any) => {
  const [show, setShow] = useState(false); const [edit, setEdit] = useState<any>();
  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto pb-24"><div className="flex gap-4 items-center mb-6"><button onClick={onBack}><ArrowLeft/></button><h2 className="text-2xl font-bold flex-1">Sedes</h2> <button onClick={()=>{setEdit(null);setShow(true);}} className="bg-[#ff8c00] p-2 rounded-xl"><Plus/></button></div>
    {worksites.map((w:any) => (<div key={w.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center"><div><p className="font-bold text-lg">{w.name}</p><p className="text-orange-500 text-xs">Radio: {w.radius}m</p></div><div className="flex gap-2"><button onClick={()=>{setEdit(w);setShow(true);}} className="p-2"><Edit3 className="w-5 text-slate-500"/></button><button onClick={()=>onDelete(w.id)} className="p-2"><Trash className="w-5 text-red-500"/></button></div></div>))}
    {show && <WorksiteModal worksite={edit} onClose={()=>setShow(false)} onSave={edit?(d:any)=>onUpdate(edit.id,d):onAdd} />}</div>
  );
};

const PendingRequestsView = ({ onBack, onActionComplete, requests, onSelectRecord }: any) => (
  <div className="flex-1 p-6 space-y-4 overflow-y-auto pb-24">
    <div className="flex items-center gap-4 mb-6"><button onClick={onBack}><ArrowLeft/></button><h2 className="text-2xl font-bold">Alertas Pendientes</h2></div>
    {requests.length === 0 && <p className="text-center text-slate-500 italic mt-12">Todo está al día</p>}
    {requests.map((r:any) => (
      <div key={r.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
        <div className="flex justify-between cursor-pointer" onClick={() => onSelectRecord(r)}>
          <div><p className="font-bold text-lg">{r.user_name}</p><p className="text-xs text-slate-400">{new Date(r.timestamp).toLocaleString()}</p></div>
          <div className="flex flex-col items-end gap-1">
            {r.distance > 100 && <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-2 py-1 rounded">FUERA RANGO</span>}
            {r.estado_extra === 'PENDIENTE' && <span className="bg-orange-500/10 text-orange-500 text-[10px] font-black px-2 py-1 rounded">+{r.minutos_extra} MIN</span>}
          </div>
        </div>
        {r.estado_extra === 'PENDIENTE' && <p className="text-xs text-slate-400 italic bg-slate-800/50 p-3 rounded-xl border border-slate-800">El empleado excedió su horario teórico en {r.minutos_extra} minutos.</p>}
        <div className="flex gap-2"><button onClick={()=>onActionComplete(r.id, 'APPROVED')} className="bg-green-500 text-white font-bold p-3 rounded-xl flex-1">APROBAR</button><button onClick={()=>onActionComplete(r.id, 'REJECTED')} className="bg-red-500/10 text-red-500 font-bold p-3 rounded-xl flex-1">RECHAZAR</button></div>
      </div>
    ))}
  </div>
);

const AdminRecordsListView = ({ records, users, onSelectRecord, onBack }: any) => {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const filtered = records.filter((r:any) => r.timestamp.startsWith(filterDate));
  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto pb-24">
      <div className="flex items-center gap-4 mb-6"><button onClick={onBack}><ArrowLeft/></button><h2 className="text-2xl font-bold">Logs Diarios</h2></div>
      <input type="date" value={filterDate} onChange={(e)=>setFilterDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl outline-none" />
      <div className="space-y-2 mt-4">
        {filtered.map((r:any) => (
          <div key={r.id} onClick={()=>onSelectRecord(r)} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between cursor-pointer">
            <div><p className="font-bold">{r.user_name}</p><p className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleTimeString()} - {r.worksite_name}</p></div>
            <p className={`font-black text-xs ${r.type === 'IN' ? 'text-green-500' : 'text-red-500'}`}>{r.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExportView = ({ onBack, records, showToast }: any) => {
  const exportData = () => { generateFullReportPDF(records, { name: 'Exportación Global', employee_id: 'ADMIN' } as any); showToast('Archivo generado', 'success'); };
  return (
    <div className="flex-1 p-6 space-y-8 font-['Quicksand'] text-center">
      <div className="flex items-center gap-4"><button onClick={onBack}><ArrowLeft/></button></div>
      <Download className="w-20 h-20 mx-auto text-slate-800" />
      <h2 className="text-2xl font-bold">Exportación de Datos</h2>
      <button onClick={exportData} className="w-full bg-[#ff8c00] py-4 rounded-2xl font-bold">DESCARGAR PDF CONSOLIDADO</button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [userRecords, setUserRecords] = useState<Record[]>([]);
  const [allRecords, setAllRecords] = useState<Record[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminWorksites, setAdminWorksites] = useState<Worksite[]>([]);
  const [pendingReqs, setPendingReqs] = useState([]);
  const [adminStats, setAdminStats] = useState({ activeEmployees: 0, totalHoursToday: 0, pendingAlerts: 0 });
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const { location } = useGeolocation();

  useEffect(() => {
    if (user) {
      fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
      fetch(`/api/status/${user.id}`).then(res => res.json()).then(s => { if (s.isClockedIn) { setIsClockedIn(true); setStartTime(new Date(s.startTime)); } });
      if (user.role === 'ADMIN') { if (!activeTab.startsWith('admin-')) { setActiveTab('admin-dashboard'); } fetchAdminData(); }
    }
  }, [user]);

  const fetchAdminData = async () => {
    const [s, u, w, r, p] = await Promise.all([ fetch('/api/admin/stats').then(res => res.json()), fetch('/api/admin/users').then(res => res.json()), fetch('/api/admin/worksites').then(res => res.json()), fetch('/api/admin/records').then(res => res.json()), fetch('/api/admin/pending-records').then(res => res.json()) ]);
    setAdminStats(s); setAdminUsers(u); setAdminWorksites(w); setAllRecords(r); setPendingReqs(p);
  };

  const handleClockIn = async (worksiteId: number) => {
    if (!user || !location) return;
    const worksites = await fetch('/api/worksites').then(res => res.json()); const site = worksites.find((w: any) => w.id === worksiteId);
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    const res = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, worksite_id: worksiteId, type: 'IN', latitude: location.latitude, longitude: location.longitude, distance: dist, notes: '' }) });
    if (res.ok) { setIsClockedIn(true); setStartTime(new Date()); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); if (user.role === 'ADMIN') fetchAdminData(); }
  };

  const handleClockOut = async (notes: string) => {
    if (!user || !location) return;
    const lastRecord = userRecords[0]; const worksites = await fetch('/api/worksites').then(res => res.json()); const site = worksites.find((w: any) => w.id === lastRecord.worksite_id);
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    
    const now = new Date();
    const esManana = now.getHours() < 14 || (now.getHours() === 14 && now.getMinutes() < 30);
    const horaSalidaPrevista = esManana ? (user.horario_manana_fin || "14:00") : (user.horario_tarde_fin || "18:00");
    const [hP, mP] = horaSalidaPrevista.split(':').map(Number);
    const previstoMs = (hP * 60 + mP) * 60000; const actualMs = (now.getHours() * 60 + now.getMinutes()) * 60000;
    let minutosExtra = 0; let estadoExtra = 'N/A';
    if (actualMs > previstoMs + 300000) { minutosExtra = Math.floor((actualMs - previstoMs) / 60000); estadoExtra = 'PENDIENTE'; }

    const res = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, worksite_id: lastRecord.worksite_id, type: 'OUT', latitude: location.latitude, longitude: location.longitude, distance: dist, notes, minutos_extra: minutosExtra, estado_extra: estadoExtra }) });
    if (res.ok) { setIsClockedIn(false); setStartTime(null); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); if (user.role === 'ADMIN') fetchAdminData(); }
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-['Quicksand'] relative">
      <header className="flex justify-between items-center p-4 border-b border-orange-500/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2"><Clock className="text-[#ff8c00]" /><h2 className="font-bold text-lg">GeoClock</h2></div>
        <button onClick={() => setUser(null)} className="p-2 text-slate-500 hover:text-red-500 transition-colors"><LogOut /></button>
      </header>
      <main className="flex-1 flex flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedRecord ? (
             <motion.div key="detail" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex-1 flex flex-col"><RecordDetailView record={selectedRecord} user={user} onBack={() => setSelectedRecord(null)} /></motion.div>
          ) : (
             <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
               {user.role === 'ADMIN' ? (
                 <>
                   {activeTab === 'admin-dashboard' && <AdminDashboard records={allRecords} users={adminUsers} stats={adminStats || { activeEmployees: 0, totalHoursToday: 0, pendingAlerts: 0 }} onViewRequests={() => setActiveTab('admin-requests')} onNavigate={setActiveTab} />}
                   {activeTab === 'admin-reports' && <ReportsView records={allRecords} users={adminUsers} onBack={() => setActiveTab('admin-dashboard')} />}
                   {activeTab === 'admin-users' && <UserManagementView users={adminUsers} onBack={() => setActiveTab('admin-dashboard')} onAdd={async(d:any)=>{await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});fetchAdminData();}} onUpdate={async(id:any,d:any)=>{await fetch(`/api/admin/users/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});fetchAdminData();}} onDelete={async(id:any)=>{if(confirm('¿Borrar?')){await fetch(`/api/admin/users/${id}`,{method:'DELETE'});fetchAdminData();}}} />}
                   {activeTab === 'admin-worksites' && <WorksiteManagementView worksites={adminWorksites} onBack={() => setActiveTab('admin-dashboard')} onAdd={async(d:any)=>{await fetch('/api/admin/worksites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});fetchAdminData();}} onUpdate={async(id:any,d:any)=>{await fetch(`/api/admin/worksites/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});fetchAdminData();}} onDelete={async(id:any)=>{if(confirm('¿Borrar?')){await fetch(`/api/admin/worksites/${id}`,{method:'DELETE'});fetchAdminData();}}} />}
                   {activeTab === 'admin-records' && <AdminRecordsListView records={allRecords} users={adminUsers} onSelectRecord={setSelectedRecord} onBack={() => setActiveTab('admin-dashboard')} />}
                   {activeTab === 'admin-export' && <ExportView records={allRecords} showToast={(m:string,t:any)=>setToast({message:m,type:t})} onBack={() => setActiveTab('admin-dashboard')} />}
                   {activeTab === 'admin-requests' && <PendingRequestsView requests={pendingReqs} onSelectRecord={setSelectedRecord} onBack={() => setActiveTab('admin-dashboard')} onActionComplete={async(id:any,status:any)=>{await fetch('/api/admin/records/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});fetchAdminData();}} />}
                   {activeTab === 'admin-clockin' && (isClockedIn ? <ActiveSession user={user} startTime={startTime!} onFinish={handleClockOut} onDiscard={() => { setIsClockedIn(false); setStartTime(null); }} /> : <Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />)}
                   {activeTab === 'profile' && <div className="p-8 text-center space-y-4"><UserIcon className="w-20 h-20 mx-auto text-slate-700"/><h2 className="text-2xl font-bold">{user.name}</h2><p className="text-orange-500 font-bold">{user.department}</p></div>}
                 </>
               ) : (
                 <>
                   {activeTab === 'home' && (isClockedIn ? <ActiveSession user={user} startTime={startTime!} onFinish={handleClockOut} onDiscard={() => { setIsClockedIn(false); setStartTime(null); }} /> : <Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />)}
                   {activeTab === 'history' && <HistoryView records={userRecords} user={user} onSelectRecord={setSelectedRecord} />}
                   {activeTab === 'summary' && <WeeklySummaryView records={userRecords} user={user} showToast={(m,t)=>setToast({message:m,type:t})} />}
                   {activeTab === 'profile' && <div className="p-8 text-center space-y-4"><UserIcon className="w-20 h-20 mx-auto text-slate-700"/><h2 className="text-2xl font-bold">{user.name}</h2><p className="text-orange-500 font-bold">{user.department}</p></div>}
                 </>
               )}
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!selectedRecord && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 pb-6 pt-3 flex justify-between items-center z-50">
          {user.role === 'ADMIN' ? (
            <>
              <button onClick={() => setActiveTab('admin-dashboard')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'admin-dashboard' ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}><LayoutDashboard className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">Panel</span></button>
              <button onClick={() => setActiveTab('admin-records')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'admin-records' ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}><FileText className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">Logs</span></button>
              <button onClick={() => setActiveTab('admin-clockin')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'admin-clockin' ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}><Fingerprint className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">Fichar</span></button>
              <button onClick={() => setActiveTab('admin-users')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'admin-users' ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}><Users className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">Staff</span></button>
              <button onClick={() => setActiveTab('admin-worksites')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'admin-worksites' ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}><Building2 className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">Sedes</span></button>
              <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}><Settings2 className="w-6 h-6" /><span className="text-[9px] font-bold uppercase">Ajustes</span></button>
            </>
          ) : (
            <>
              <button onClick={() => setActiveTab('home')} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-[#ff8c00]' : 'text-slate-500'}`}><Home className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">Inicio</span></button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-[#ff8c00]' : 'text-slate-500'}`}><FileText className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">Registros</span></button>
              <button onClick={() => setActiveTab('summary')} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${activeTab === 'summary' ? 'text-[#ff8c00]' : 'text-slate-500'}`}><BarChart3 className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">Resumen</span></button>
              <button onClick={() => setActiveTab('profile')} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-[#ff8c00]' : 'text-slate-500'}`}><UserIcon className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">Perfil</span></button>
            </>
          )}
        </nav>
      )}
      <AnimatePresence>{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>
    </div>
  );
}
