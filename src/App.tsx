import React, { useState, useEffect, useMemo } from 'react';
import { useGeolocation, calculateDistance } from './types';
import { LogIn, LogOut, Clock, History, User as UserIcon, MapPin, ChevronRight, ArrowLeft, MoreVertical, Edit3, PauseCircle, PlayCircle, Trash2, TimerOff, TrendingUp, Coffee, Verified, Share2, Printer, Calendar, ChevronLeft, BarChart3, Home, FileText, Settings, Fingerprint, Bell, Mail, Lock, Eye, Check, X, Shield, Users, Map, Settings2, Download, AlertTriangle, LayoutDashboard, UserPlus, Building2, Search, Filter, Plus, Trash, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

// Definición local de tipos para evadir los fallos de Vercel
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

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-24 left-4 right-4 p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border ${
        type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
      }`}
    >
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      <p className="text-sm font-bold">{message}</p>
    </motion.div>
  );
};

// --- PDF Generation Utilities ---

const generateRecordPDF = (record: TimeRecord, user: User) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(255, 140, 0); // Orange
  doc.text('GeoClock - Comprobante de Registro', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 20, 30);
  
  // User Info
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('Información del Empleado', 20, 45);
  doc.setFontSize(12);
  doc.text(`Nombre: ${record.user_name || user.name}`, 20, 55);
  doc.text(`Email: ${user.email}`, 20, 62);
  doc.text(`ID Empleado: ${user.employee_id}`, 20, 69);
  doc.text(`Departamento: ${user.department}`, 20, 76);
  
  // Record Info
  doc.setFontSize(16);
  doc.text('Detalles del Registro', 20, 90);
  doc.setFontSize(12);
  doc.text(`Tipo: ${record.type === 'IN' ? 'ENTRADA' : 'SALIDA'}`, 20, 100);
  doc.text(`Fecha: ${new Date(record.timestamp).toLocaleDateString('es-ES')}`, 20, 107);
  doc.text(`Hora: ${new Date(record.timestamp).toLocaleTimeString('es-ES')}`, 20, 114);
  doc.text(`Sede: ${record.worksite_name}`, 20, 121);
  doc.text(`Distancia: ${(record.distance || 0).toFixed(1)}m`, 20, 128);
  doc.text(`Coordenadas: ${(record.latitude || 0).toFixed(6)}, ${(record.longitude || 0).toFixed(6)}`, 20, 135);
  doc.text(`Método: ${record.is_manual ? 'Manual' : 'Automático (GPS)'}`, 20, 142);
  
  if (record.notes) {
    doc.text('Notas:', 20, 155);
    doc.setFontSize(10);
    doc.setTextColor(100);
    const splitNotes = doc.splitTextToSize(record.notes, 170);
    doc.text(splitNotes, 20, 162);
  }
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text('Este documento es un comprobante oficial generado por el sistema GeoClock.', 20, 280);
  
  const rDate = new Date(record.timestamp);
  const fileDate = `${rDate.getFullYear()}-${(rDate.getMonth() + 1).toString().padStart(2, '0')}-${rDate.getDate().toString().padStart(2, '0')}`;
  const randomSuffix = Math.floor(Math.random() * 1000);
  doc.save(`Registro_${record.type}_${fileDate}_${randomSuffix}.pdf`);
};

const generateFullReportPDF = (records: TimeRecord[], user: User, periodLabel?: string) => {
  if (!records || records.length === 0) return;
  
  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.setTextColor(255, 140, 0);
  doc.text('GeoClock - Informe de Asistencia', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  
  const isConsolidated = user.employee_id === 'ADMIN';
  
  if (!isConsolidated) {
    doc.text(`Empleado: ${user.name} (${user.employee_id})`, 20, 30);
  } else {
    doc.text(`Informe Consolidado de Administración`, 20, 30);
  }
  
  const startDateLabel = periodLabel || new Date(records[0].timestamp).toLocaleDateString('es-ES');
  const endDateLabel = periodLabel ? '' : ` - ${new Date(records[records.length - 1].timestamp).toLocaleDateString('es-ES')}`;
  doc.text(`Periodo: ${startDateLabel}${endDateLabel}`, 20, 37);

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
          if (sortedRecords[j].type === 'OUT') {
            nextOutIdx = j;
            break;
          } else if (sortedRecords[j].type === 'IN') {
            break; 
          }
        }

        if (nextOutIdx !== -1) {
          const inTime = new Date(sortedRecords[i].timestamp).getTime();
          const outTime = new Date(sortedRecords[nextOutIdx].timestamp).getTime();
          const diff = outTime - inTime;
          
          totalUserMs += diff;
          
          const outDateStr = new Date(sortedRecords[nextOutIdx].timestamp).toLocaleDateString('es-ES');
          if (!dailyTotals[outDateStr]) dailyTotals[outDateStr] = 0;
          dailyTotals[outDateStr] += diff;

          i = nextOutIdx;
        }
      }
    }

    if (isConsolidated) {
      if (userIdx > 0) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Empleado: ${userData.name}`, 20, currentY);
      currentY += 10;
    }

    const dayLastRecordIndex: { [key: string]: number } = {};
    sortedRecords.forEach((r, idx) => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      dayLastRecordIndex[dateStr] = idx;
    });

    const tableData = sortedRecords.map((r, idx) => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      const isLastOfDay = dayLastRecordIndex[dateStr] === idx;
      const dayTotalMs = dailyTotals[dateStr] || 0;
      
      let dayTotalStr = '';
      if (isLastOfDay && dayTotalMs > 0) {
        const h = Math.floor(dayTotalMs / 3600000);
        const m = Math.floor((dayTotalMs % 3600000) / 60000);
        dayTotalStr = `${h}h ${m}m`;
      } else if (isLastOfDay && dayTotalMs === 0) {
        dayTotalStr = '0h 0m';
      }
      
      return [
        dateStr,
        new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        r.type === 'IN' ? 'Entrada' : 'Salida',
        r.worksite_name,
        `${(r.distance || 0).toFixed(1)}m`,
        r.is_manual ? 'Manual' : 'GPS',
        dayTotalStr
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
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 20 },
      didDrawPage: (data) => {
        currentY = data.cursor?.y || currentY;
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });
  
  const safeName = user.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const firstRecordDate = new Date(records[0].timestamp);
  const fileDate = `${firstRecordDate.getFullYear()}-${(firstRecordDate.getMonth() + 1).toString().padStart(2, '0')}-${firstRecordDate.getDate().toString().padStart(2, '0')}`;
  const randomSuffix = Math.floor(Math.random() * 1000);
  
  doc.save(`Informe_${safeName}_${fileDate}_${randomSuffix}.pdf`);
};

// --- Components ---

const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('john@empresa.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'USER' | 'ADMIN'>('USER');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      const user = await res.json();
      if (mode === 'ADMIN' && user.role !== 'ADMIN') {
        setError('Acceso denegado: Se requieren credenciales de administrador');
        return;
      }
      onLogin(user);
    } else {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-['Quicksand']">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/10 mb-4 border border-orange-500/20">
            {mode === 'ADMIN' ? <Shield className="w-10 h-10 text-[#ff8c00]" /> : <Clock className="w-10 h-10 text-[#ff8c00]" />}
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            {mode === 'ADMIN' ? 'Portal de Administración' : 'GeoClock'}
          </h1>
          <p className="text-slate-500 font-medium">
            {mode === 'ADMIN' ? 'Acceso restringido para gestión de plataforma' : 'Sistema de fichaje con validación de geolocalización'}
          </p>
        </div>

        <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm flex items-center gap-2">
                <X className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 ml-1">ID de {mode === 'ADMIN' ? 'Administrador' : 'Empleado'} / Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff8c00] outline-none transition-all"
                  placeholder={mode === 'ADMIN' ? 'name@company.admin' : 'empleado@empresa.com'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold text-slate-400">Contraseña Segura</label>
                <button type="button" className="text-xs font-bold text-[#ff8c00] hover:underline">¿Olvidó su contraseña?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff8c00] outline-none transition-all"
                  placeholder="••••••••••••"
                />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-[#ff8c00] to-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span>{mode === 'ADMIN' ? 'Entrar al Panel de Control' : 'Iniciar Sesión'}</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
              <Check className="w-3 h-3 text-green-500" /> Sesión Segura con Cifrado de 256 bits
            </p>
          </div>
        </div>

        <div className="text-center">
          <button 
            onClick={() => {
              setMode(mode === 'USER' ? 'ADMIN' : 'USER');
              setEmail(mode === 'USER' ? 'admin@empresa.com' : 'john@empresa.com');
              setPassword(mode === 'USER' ? 'admin123' : 'password123');
            }}
            className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            {mode === 'USER' ? '¿Eres administrador? Acceder al Panel' : '¿No eres administrador? Volver al Inicio de Sesión de Usuario'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

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

    const tH = Math.floor(todayMs / 3600000);
    const tM = Math.floor((todayMs % 3600000) / 60000);
    const wH = Math.floor(weekMs / 3600000);
    const wM = Math.floor((weekMs % 3600000) / 60000);

    return {
      todayStr: `${tH}h ${tM}m`,
      weekStr: `${wH}h ${wM}m`,
      weekPct: Math.min((weekMs / (40 * 3600000)) * 100, 100)
    };
  }, [records]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/worksites').then(res => res.json()).then(data => {
      setWorksites(data);
      if (data.length > 0) setSelectedWorksite(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (location && selectedWorksite) {
      const site = worksites.find(w => w.id === selectedWorksite);
      if (site) {
        const d = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
        setDistance(d);
      }
    }
  }, [location, selectedWorksite, worksites]);

  const currentSite = worksites.find(w => w.id === selectedWorksite);
  const canClockIn = distance !== null && currentSite && distance <= currentSite.radius;

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 max-w-md mx-auto w-full font-['Quicksand']">
      <section className="text-center py-6">
        <p className="text-slate-400 font-medium mb-1 capitalize">
          {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-white mb-4">
          {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
        </h1>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          Estado: No ha fichado
        </div>
      </section>

      <section className="space-y-4 px-2">
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Seleccionar Sede</label>
          <div className="relative">
            <select 
              value={selectedWorksite}
              onChange={(e) => setSelectedWorksite(Number(e.target.value))}
              className="w-full bg-slate-900 border border-orange-500/20 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-medium"
            >
              {worksites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#ff8c00]">
              <ChevronRight className="rotate-90" />
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-2 justify-center py-2 px-4 rounded-lg border transition-colors ${canClockIn ? 'bg-green-500/10 border-green-500/20' : 'bg-orange-500/5 border-orange-500/10'}`}>
          <MapPin className={`w-4 h-4 ${canClockIn ? 'text-green-500' : 'text-[#ff8c00]'}`} />
          <p className={`text-xs font-medium ${canClockIn ? 'text-green-500' : 'text-slate-400'}`}>
            {canClockIn 
              ? `¡Estás en la sede (a ${distance?.toFixed(1)}m)! Puedes fichar.` 
              : `Solo disponible a menos de ${currentSite?.radius || 10}m de la sede (Estás a ${distance !== null ? distance.toFixed(1) : '?'}m)`}
          </p>
        </div>
        {geoError && <p className="text-red-500 text-[10px] font-bold mt-2 uppercase w-full text-center">⚠️ Error GPS: {geoError}</p>}
      </section>

      <section className="flex justify-center pb-4">
        <button 
          disabled={!canClockIn}
          onClick={() => onClockIn(selectedWorksite)}
          className={`w-full max-w-xs aspect-square rounded-full shadow-xl flex flex-col items-center justify-center text-white transition-all active:scale-95 group ${canClockIn ? 'bg-[#ff8c00] hover:bg-orange-600 shadow-orange-500/20 cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'}`}
        >
          <Fingerprint className={`w-16 h-16 mb-2 transition-transform ${canClockIn ? 'group-hover:scale-110' : ''}`} />
          <span className="text-xl font-bold uppercase tracking-wider">Fichar Entrada</span>
        </button>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Horas Hoy</p>
          <p className="text-2xl font-black text-white">{stats.todayStr || '0h 0m'}</p>
          <div className="flex items-center gap-1 text-green-400 text-[10px] font-bold mt-1">
            <TrendingUp className="w-3 h-3" /> Turno actual
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Puntualidad</p>
          <p className="text-2xl font-black text-white">--%</p>
          <div className="flex items-center gap-1 text-[#ff8c00] text-[10px] font-bold mt-1">
            <Check className="w-3 h-3" /> Sin datos
          </div>
        </div>
      </section>

      <section className="bg-slate-900 rounded-xl p-5 border border-orange-500/5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-300">Esta semana</h3>
          <span className="text-[#ff8c00] font-bold text-lg">{stats.weekStr || '0h 0m'}</span>
        </div>
        <div className="w-full bg-orange-500/10 rounded-full h-2.5 mb-2">
          <div className="bg-[#ff8c00] h-2.5 rounded-full" style={{ width: `${stats.weekPct || 0}%` }}></div>
        </div>
        <p className="text-xs text-slate-500">Objetivo: 40h 00m</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-slate-300">Actividad reciente</h3>
          <button className="text-[#ff8c00] text-sm font-medium">Ver todo</button>
        </div>
        <div className="space-y-2">
          {records.slice(0, 3).map(record => (
            <div key={record.id} className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  {record.type === 'IN' ? <LogIn className="text-[#ff8c00] w-5 h-5" /> : <LogOut className="text-[#ff8c00] w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm">{new Date(record.timestamp).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                  <p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {record.worksite_name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{record.type === 'IN' ? 'Entrada' : 'Salida'}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ActiveSession = ({ user, onFinish, onDiscard, startTime }: { user: User, onFinish: (notes: string) => void, onDiscard: () => void, startTime: Date }) => {
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
  const [notes, setNotes] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const diff = new Date().getTime() - startTime.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed({ h, m, s });
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isPaused]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 font-['Quicksand']">
      <div className="flex justify-center mb-8">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isPaused ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-orange-500/10 text-[#ff8c00] border-orange-500/20'}`}>
          <span className="relative flex h-2 w-2">
            {!isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c00] opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? 'bg-amber-500' : 'bg-[#ff8c00]'}`}></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider">{isPaused ? 'SESIÓN EN PAUSA' : 'TRABAJANDO ACTUALMENTE'}</span>
        </div>
      </div>

      <div className="text-center mb-4">
        <div className="flex justify-center items-baseline gap-2">
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold tracking-tighter tabular-nums text-white">{elapsed.h.toString().padStart(2, '0')}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 mt-1">HORAS</span>
          </div>
          <span className="text-5xl font-light text-slate-700 mb-6 animate-pulse">:</span>
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold tracking-tighter tabular-nums text-white">{elapsed.m.toString().padStart(2, '0')}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 mt-1">MINUTOS</span>
          </div>
          <span className="text-5xl font-light text-slate-700 mb-6 animate-pulse">:</span>
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold tracking-tighter tabular-nums text-white">{elapsed.s.toString().padStart(2, '0')}</span>
            <span className="text-[10px] uppercase font-bold text-slate-500 mt-1">SEGUNDOS</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center mb-12">
        <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-800">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Iniciado a las {startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-300">¿En qué estás trabajando?</label>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">OPCIONAL</span>
        </div>
        <div className="relative">
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full min-h-[120px] p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff8c00] outline-none transition-all resize-none text-slate-200" 
            placeholder="p. ej. Diseñando componentes de UI móvil y finalizando el flujo de usuario..."
          ></textarea>
          <div className="absolute bottom-3 right-3">
            <Edit3 className="text-slate-500 w-5 h-5" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['#Desarrollo', '#Diseño', '#Reunión', '#Formación', '#Viaje', '#Soporte'].map(tag => (
            <button key={tag} onClick={() => setNotes(n => n + ' ' + tag)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:border-orange-500/40 transition-colors">
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <button 
          onClick={() => onFinish(notes)}
          className="flex items-center justify-center gap-3 w-full h-14 bg-[#ff8c00] hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
        >
          <TimerOff className="w-6 h-6" />
          <span>Finalizar Turno</span>
        </button>
        <div className="flex gap-3 mt-4">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-all ${isPaused ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {isPaused ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
            <span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
          </button>
          <button 
            onClick={() => {
              if (confirm('¿Estás seguro de que quieres descartar este turno? No se guardará ningún registro.')) {
                onDiscard();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-all"
          >
            <Trash2 className="w-5 h-5" />
            <span>Descartar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ records, user, onSelectRecord }: { records: TimeRecord[], user: User, onSelectRecord: (record: TimeRecord) => void }) => {
  const totalDurationMs = (() => {
    let total = 0;
    const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
        total += new Date(sorted[i+1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
        i++;
      }
    }
    return total;
  })();

  const hours = Math.floor(totalDurationMs / 3600000);
  const minutes = Math.floor((totalDurationMs % 3600000) / 60000);

  return (
    <div className="flex-1 px-4 py-6 space-y-4 pb-24 font-['Quicksand']">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-orange-500/5 shadow-sm">
          <div className="flex items-center gap-2 cursor-pointer group">
            <span className="text-sm font-medium text-slate-400">Viendo:</span>
            <div className="flex items-center gap-1 font-bold text-white group-hover:text-[#ff8c00] transition-colors capitalize">
              {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} <ChevronRight className="rotate-90 w-4 h-4" />
            </div>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Duración Total</p>
            <p className="text-lg font-bold text-[#ff8c00]">{hours}h {minutes}m</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {records.map(record => (
          <div 
            key={record.id} 
            onClick={() => onSelectRecord(record)}
            className={`bg-slate-800 rounded-xl border-l-4 shadow-sm border border-slate-700/50 overflow-hidden cursor-pointer hover:border-orange-500/30 transition-all ${record.type === 'IN' ? 'border-l-green-500' : 'border-l-red-500'}`}
          >
            <div className="p-4 flex items-center gap-4">
              <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-lg w-16 h-16 border border-slate-800">
                <span className="text-2xl font-black text-white">{new Date(record.timestamp).getDate()}</span>
                <span className="text-[10px] font-bold uppercase text-slate-500">{new Date(record.timestamp).toLocaleDateString('es-ES', { month: 'short' })}</span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                    {record.type === 'IN' ? <LogIn className="w-3 h-3 text-green-500" /> : <LogOut className="w-3 h-3 text-red-500" />}
                    {record.type === 'IN' ? 'Entrada' : 'Salida'}
                  </p>
                  <p className="text-base font-semibold text-slate-200">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Sede</p>
                  <p className="text-xs text-slate-400 truncate">{record.worksite_name}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-500/10 text-[#ff8c00] text-xs font-bold">
                  {(record.distance || 0) < 0.1 ? '<0.1m' : `${(record.distance || 0).toFixed(1)}m`}
                </span>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    generateRecordPDF(record, user);
                  }}
                  className="p-2 text-slate-500 hover:text-[#ff8c00] hover:bg-orange-500/5 rounded-lg transition-all"
                >
                  <Printer className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RecordDetailView = ({ record, user, onBack }: { record: TimeRecord, user: User, onBack: () => void }) => {
  return (
    <div className="flex-1 bg-slate-950 font-['Quicksand'] overflow-y-auto pb-24">
      <header className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">Detalle del Registro</h1>
        </div>
        <button className="text-[#ff8c00] font-semibold text-sm px-3 py-1 hover:bg-orange-500/20 rounded transition-colors">Editar</button>
      </header>

      <div className="p-6 space-y-6">
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex gap-5 items-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden">
                <img src={`https://picsum.photos/seed/${record.user_id}/200`} alt="Profile" className="w-full h-full object-cover" />
              </div>
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
            </div>
            <div>
              <h2 className="text-xl font-bold">{record.user_name || user.name}</h2>
              <p className="text-slate-500 text-xs">ID: {user.employee_id} • {user.department}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[#ff8c00] font-bold text-sm">{new Date(record.timestamp).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/30 text-green-400">
              <Verified className="w-3 h-3 mr-1" /> Registro Verificado
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase">Tipo de Registro</p>
            <p className="text-xl font-bold text-[#ff8c00]">{record.type === 'IN' ? 'Entrada' : 'Salida'}</p>
            <p className="text-slate-500 text-[10px]">{record.is_manual ? 'Registro Manual' : 'Registro Automático'}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase">Distancia a Sede</p>
            <p className="text-xl font-bold">{(record.distance || 0).toFixed(1)}m</p>
            <p className="text-slate-500 text-[10px]">{(record.distance || 0) < 0.1 ? 'En el punto exacto' : 'Dentro del radio'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-white text-sm font-bold flex items-center gap-2">
            <History className="w-4 h-4 text-[#ff8c00]" /> Detalles del Evento
          </h3>
          <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            <div className="relative mb-8">
              <div className={`absolute -left-6 top-0 w-4 h-4 rounded-full bg-slate-950 border-2 flex items-center justify-center ${record.type === 'IN' ? 'border-green-500' : 'border-red-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${record.type === 'IN' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-sm">{record.type === 'IN' ? 'Entrada Registrada' : 'Salida Registrada'}</p>
                  <p className="text-xs text-slate-400">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {record.worksite_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {record.notes && (
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase mb-2">Notas del Empleado</p>
            <p className="text-slate-300 text-sm italic leading-relaxed">"{record.notes}"</p>
          </div>
        )}

        <button 
          onClick={() => generateRecordPDF(record, user)}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-700"
        >
          <Printer className="w-5 h-5" /> Descargar Comprobante PDF
        </button>
      </div>
    </div>
  );
};

const WeeklySummaryView = ({ records, user, showToast, onSelectRecord }: { records: TimeRecord[], user: User, showToast: (msg: string, type: 'success' | 'error') => void, onSelectRecord: (record: TimeRecord) => void }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const m = new Date(now.setDate(diff));
    m.setHours(0, 0, 0, 0);
    return m;
  });

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekRecords = records.filter(r => {
    const d = new Date(r.timestamp);
    return d >= currentWeekStart && d <= weekEnd;
  });

  const totalWeeklyMs = useMemo(() => {
    let total = 0;
    const sorted = [...weekRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
        total += new Date(sorted[i+1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
        i++;
      }
    }
    return total;
  }, [weekRecords]);

  const h = Math.floor(totalWeeklyMs / 3600000);
  const m = Math.floor((totalWeeklyMs % 3600000) / 60000);

  return (
    <div className="flex-1 px-4 py-4 space-y-6 pb-24 font-['Quicksand'] overflow-y-auto">
      <div className="flex items-center justify-between bg-slate-900 rounded-xl p-3 border border-slate-800">
        <button onClick={() => {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() - 7);
          setCurrentWeekStart(d);
        }}><ChevronLeft /></button>
        <span className="text-sm font-semibold">
          {currentWeekStart.getDate()} {currentWeekStart.toLocaleDateString('es-ES', { month: 'short' })} - {weekEnd.getDate()} {weekEnd.toLocaleDateString('es-ES', { month: 'short' })}
        </span>
        <button onClick={() => {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() + 7);
          setCurrentWeekStart(d);
        }}><ChevronRight /></button>
      </div>

      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 text-center">
        <p className="text-xs text-slate-400 font-bold uppercase mb-2">Total de la Semana</p>
        <p className="text-5xl font-black text-[#ff8c00]">{h}h {m}m</p>
      </div>

      <button 
        onClick={() => {
          const p = `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
          generateFullReportPDF(weekRecords, user, p);
          showToast('Informe generado', 'success');
        }}
        className="w-full flex items-center justify-center gap-2 bg-[#ff8c00] text-white font-bold py-4 rounded-2xl"
      >
        <FileText /> Descargar Informe Semanal
      </button>

      <div className="space-y-3">
        {weekRecords.map(r => (
          <div key={r.id} onClick={() => onSelectRecord(r)} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center cursor-pointer">
            <div>
              <p className="text-sm font-bold">{new Date(r.timestamp).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</p>
              <p className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleTimeString()} - {r.type === 'IN' ? 'Entrada' : 'Salida'}</p>
            </div>
            <span className={`px-2 py-1 rounded text-[10px] font-black ${r.type === 'IN' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{r.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EditProfileView = ({ user, onSave, onBack }: { user: User, onSave: (u: User) => void, onBack: () => void }) => {
  const [name, setName] = useState(user.name);
  const [department, setDepartment] = useState(user.department);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, name, department })
    });
    if (res.ok) {
      const u = await res.json();
      onSave(u);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 space-y-8 font-['Quicksand']">
      <div className="flex items-center gap-4">
        <button onClick={onBack}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Editar Perfil</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 p-3 rounded-xl border border-slate-700 outline-none focus:border-[#ff8c00]" placeholder="Nombre" />
        <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-slate-800 p-3 rounded-xl border border-slate-700 outline-none focus:border-[#ff8c00]" placeholder="Departamento" />
        <button type="submit" disabled={loading} className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold">{loading ? 'Guardando...' : 'Guardar'}</button>
      </form>
    </div>
  );
};

const ChangePasswordView = ({ user, onBack }: { user: User, onBack: () => void }) => {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [confirmP, setConfirmP] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newP !== confirmP) return setError('No coinciden');
    const res = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, oldPassword: oldP, newPassword: newP })
    });
    if (res.ok) setSuccess(true);
    else setError('Contraseña actual incorrecta');
  };

  return (
    <div className="p-8 space-y-8 font-['Quicksand']">
      <div className="flex items-center gap-4">
        <button onClick={onBack}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Seguridad</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {success && <div className="p-4 bg-green-500/20 text-green-500 rounded-xl">Cambiada con éxito</div>}
        {error && <div className="p-4 bg-red-500/20 text-red-500 rounded-xl">{error}</div>}
        <input type="password" value={oldP} onChange={e => setOldP(e.target.value)} className="w-full bg-slate-800 p-3 rounded-xl border border-slate-700 outline-none focus:border-[#ff8c00]" placeholder="Contraseña actual" />
        <input type="password" value={newP} onChange={e => setNewP(e.target.value)} className="w-full bg-slate-800 p-3 rounded-xl border border-slate-700 outline-none focus:border-[#ff8c00]" placeholder="Nueva contraseña" />
        <input type="password" value={confirmP} onChange={e => setConfirmP(e.target.value)} className="w-full bg-slate-800 p-3 rounded-xl border border-slate-700 outline-none focus:border-[#ff8c00]" placeholder="Confirmar" />
        <button type="submit" className="w-full bg-[#const generateRecordPDF = (record: Record, user: User) => {
const doc = new jsPDF();
// Header
doc.setFontSize(22);
doc.setTextColor(255, 140, 0); // Orange
doc.text('GeoClock - Comprobante de Registro', 20, 20);
doc.setFontSize(12);
doc.setTextColor(100);
doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 20, 30);
// User Info
doc.setFontSize(16);
doc.setTextColor(0);
doc.text('Información del Empleado', 20, 45);
doc.setFontSize(12);
doc.text(`Nombre: ${record.user_name || user.name}`, 20, 55);
doc.text(`Email: ${user.email}`, 20, 62);
doc.text(`ID Empleado: ${user.employee_id}`, 20, 69);
doc.text(`Departamento: ${user.department}`, 20, 76);
// Record Info
doc.setFontSize(16);
doc.text('Detalles del Registro', 20, 90);
doc.setFontSize(12);
doc.text(`Tipo: ${record.type === 'IN' ? 'ENTRADA' : 'SALIDA'}`, 20, 100);
doc.text(`Fecha: ${new Date(record.timestamp).toLocaleDateString('es-ES')}`, 20, 107);
doc.text(`Hora: ${new Date(record.timestamp).toLocaleTimeString('es-ES')}`, 20, 114);
doc.text(`Sede: ${record.worksite_name}`, 20, 121);
doc.text(`Distancia: ${(record.distance || 0).toFixed(1)}m`, 20, 128);
doc.text(`Coordenadas: ${(record.latitude || 0).toFixed(6)}, ${(record.longitude || 0).toFixed(6)}`, 20, 135);
doc.text(`Método: ${record.is_manual ? 'Manual' : 'Automático (GPS)'}`, 20, 142);
if (record.notes) {
doc.text('Notas:', 20, 155);
doc.setFontSize(10);
doc.setTextColor(100);
const splitNotes = doc.splitTextToSize(record.notes, 170);
doc.text(splitNotes, 20, 162);
}
// Footer
doc.setFontSize(10);
doc.setTextColor(150);
doc.text('Este documento es un comprobante oficial generado por el sistema GeoClock.', 20, 280);
const rDate = new Date(record.timestamp);
const fileDate = `${rDate.getFullYear()}-${(rDate.getMonth() + 1).toString().padStart(2, '0')}-${rDate.getDate().toString().padStart(2, '0')}`;
const randomSuffix = Math.floor(Math.random() * 1000);
doc.save(`Registro_${record.type}_${fileDate}_${randomSuffix}.pdf`);
};
const generateFullReportPDF = (records: Record[], user: User, periodLabel?: string) => {
  if (!records || records.length === 0) return;
  
  const doc = new jsPDF();
  
  doc.setFontSize(22);
  doc.setTextColor(255, 140, 0);
  doc.text('GeoClock - Informe de Asistencia', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  
  const isConsolidated = user.employee_id === 'ADMIN';
  
  if (!isConsolidated) {
    doc.text(`Empleado: ${user.name} (${user.employee_id})`, 20, 30);
  } else {
    doc.text(`Informe Consolidado de Administración`, 20, 30);
  }
  
  const startDateLabel = periodLabel || new Date(records[0].timestamp).toLocaleDateString('es-ES');
  const endDateLabel = periodLabel ? '' : ` - ${new Date(records[records.length - 1].timestamp).toLocaleDateString('es-ES')}`;
  doc.text(`Periodo: ${startDateLabel}${endDateLabel}`, 20, 37);

  const recordsByUser: { [key: string]: { name: string, records: Record[] } } = {};
  
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
    // 1. Ordenamos TODOS los registros en una línea de tiempo continua
    const sortedRecords = [...userData.records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // 2. Variables para acumular tiempo real
    const dailyTotals: { [key: string]: number } = {};
    let totalUserMs = 0;

    // 3. NUEVA LÓGICA: Emparejamos IN con OUT a prueba de fallos
    for (let i = 0; i < sortedRecords.length; i++) {
      if (sortedRecords[i].type === 'IN') {
        let nextOutIdx = -1;
        
        // Buscamos hacia adelante la primera Salida (OUT)
        for (let j = i + 1; j < sortedRecords.length; j++) {
          if (sortedRecords[j].type === 'OUT') {
            nextOutIdx = j;
            break;
          } else if (sortedRecords[j].type === 'IN') {
            // Si el empleado fichó IN dos veces seguidas (olvidó salir), ignoramos el primer IN
            break; 
          }
        }

        if (nextOutIdx !== -1) {
          const inTime = new Date(sortedRecords[i].timestamp).getTime();
          const outTime = new Date(sortedRecords[nextOutIdx].timestamp).getTime();
          const diff = outTime - inTime;
          
          totalUserMs += diff;
          
          // Sumamos el tiempo al día en que terminó el turno (por si cruzó la medianoche)
          const outDateStr = new Date(sortedRecords[nextOutIdx].timestamp).toLocaleDateString('es-ES');
          if (!dailyTotals[outDateStr]) dailyTotals[outDateStr] = 0;
          dailyTotals[outDateStr] += diff;

          // Avanzamos el bucle principal para saltarnos los registros ya procesados
          i = nextOutIdx;
        }
      }
    }

    if (isConsolidated) {
      if (userIdx > 0) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Empleado: ${userData.name}`, 20, currentY);
      currentY += 10;
    }

    const dayLastRecordIndex: { [key: string]: number } = {};
    sortedRecords.forEach((r, idx) => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      dayLastRecordIndex[dateStr] = idx;
    });

    const tableData = sortedRecords.map((r, idx) => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      const isLastOfDay = dayLastRecordIndex[dateStr] === idx;
      const dayTotalMs = dailyTotals[dateStr] || 0;
      
      let dayTotalStr = '';
      if (isLastOfDay && dayTotalMs > 0) {
        const h = Math.floor(dayTotalMs / 3600000);
        const m = Math.floor((dayTotalMs % 3600000) / 60000);
        dayTotalStr = `${h}h ${m}m`;
      } else if (isLastOfDay && dayTotalMs === 0) {
        dayTotalStr = '0h 0m';
      }
      
      return [
        dateStr,
        new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        r.type === 'IN' ? 'Entrada' : 'Salida',
        r.worksite_name,
        `${(r.distance || 0).toFixed(1)}m`,
        r.is_manual ? 'Manual' : 'GPS',
        dayTotalStr
      ];
    });
    
    // Total final en horas y minutos exactos
    const totalUserH = Math.floor(totalUserMs / 3600000);
    const totalUserM = Math.floor((totalUserMs % 3600000) / 60000);

    autoTable(doc, {
      startY: currentY,
      head: [['Fecha', 'Hora', 'Tipo', 'Sede', 'Distancia', 'Método', 'Total Día']],
      body: tableData,
      foot: [['', '', '', '', '', 'TOTAL EMPLEADO:', `${totalUserH}h ${totalUserM}m`]],
      headStyles: { fillColor: [255, 140, 0] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 20 },
      didDrawPage: (data) => {
        currentY = data.cursor?.y || currentY;
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });
  
  const safeName = user.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const firstRecordDate = new Date(records[0].timestamp);
  const fileDate = `${firstRecordDate.getFullYear()}-${(firstRecordDate.getMonth() + 1).toString().padStart(2, '0')}-${firstRecordDate.getDate().toString().padStart(2, '0')}`;
  const randomSuffix = Math.floor(Math.random() * 1000);
  
  doc.save(`Informe_${safeName}_${fileDate}_${randomSuffix}.pdf`);
};
// --- Components ---
const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
const [email, setEmail] = useState('john@empresa.com');
const [password, setPassword] = useState('password123');
const [error, setError] = useState('');
const [mode, setMode] = useState<'USER' | 'ADMIN'>('USER');
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setError('');
const res = await fetch('/api/login', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email, password })
});
if (res.ok) {
const user = await res.json();
if (mode === 'ADMIN' && user.role !== 'ADMIN') {
setError('Acceso denegado: Se requieren credenciales de administrador');
return;
}
onLogin(user);
} else {
setError('Credenciales inválidas');
}
};
return (
<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-['Quicksand']">
<motion.div 
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
className="w-full max-w-md space-y-8"
>
<div className="text-center space-y-2">
<div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-orange-500/10 mb-4 border border-orange-500/20">
{mode === 'ADMIN' ? <Shield className="w-10 h-10 text-[#ff8c00]" /> : <Clock className="w-10 h-10 text-[#ff8c00]" />}
</div>
<h1 className="text-4xl font-black text-white tracking-tight">
{mode === 'ADMIN' ? 'Portal de Administración' : 'GeoClock'}
</h1>
<p className="text-slate-500 font-medium">
{mode === 'ADMIN' ? 'Acceso restringido para gestión de plataforma' : 'Sistema de fichaje con validación de geolocalización'}
</p>
</div>
<div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
<form onSubmit={handleSubmit} className="space-y-6">
{error && (
<div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm flex items-center gap-2">
<X className="w-4 h-4" />
{error}
</div>
)}
<div className="space-y-2">
<label className="text-sm font-bold text-slate-400 ml-1">ID de {mode === 'ADMIN' ? 'Administrador' : 'Empleado'} / Email</label>
<div className="relative">
<Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
<input 
type="email" 
value={email}
onChange={(e) => setEmail(e.target.value)}
className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff8c00] outline-none transition-all"
placeholder={mode === 'ADMIN' ? 'name@company.admin' : 'empleado@empresa.com'}
/>
</div>
</div>
<div className="space-y-2">
<div className="flex justify-between items-center ml-1">
<label className="text-sm font-bold text-slate-400">Contraseña Segura</label>
<button type="button" className="text-xs font-bold text-[#ff8c00] hover:underline">¿Olvidó su contraseña?</button>
</div>
<div className="relative">
<Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
<input 
type="password" 
value={password}
onChange={(e) => setPassword(e.target.value)}
className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff8c00] outline-none transition-all"
placeholder="••••••••••••"
/>
<button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
<Eye className="w-5 h-5" />
</button>
</div>
</div>
<button 
type="submit"
className="w-full bg-gradient-to-r from-[#ff8c00] to-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
>
<span>{mode === 'ADMIN' ? 'Entrar al Panel de Control' : 'Iniciar Sesión'}</span>
<ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
</button>
</form>
<div className="mt-8 pt-8 border-t border-slate-800 text-center">
<p className="text-xs text-slate-500 flex items-center justify-center gap-2">
<Check className="w-3 h-3 text-green-500" /> Sesión Segura con Cifrado de 256 bits
</p>
</div>
</div>
<div className="text-center">
<button 
onClick={() => {
setMode(mode === 'USER' ? 'ADMIN' : 'USER');
setEmail(mode === 'USER' ? 'admin@empresa.com' : 'john@empresa.com');
setPassword(mode === 'USER' ? 'admin123' : 'password123');
}}
className="text-sm font-bold text-slate-400 hover:text-white transition-colors"
>
{mode === 'USER' ? '¿Eres administrador? Acceder al Panel' : '¿No eres administrador? Volver al Inicio de Sesión de Usuario'}
</button>
</div>
</motion.div>
</div>
);
};
const Dashboard = ({ user, onClockIn, records }: { user: User, onClockIn: (worksiteId: number) => void, records: Record[] }) => {
const [worksites, setWorksites] = useState<Worksite[]>([]);
const [selectedWorksite, setSelectedWorksite] = useState<number>(0);
const { location, error: geoError } = useGeolocation();
const [distance, setDistance] = useState<number | null>(null);
const [currentTime, setCurrentTime] = useState(new Date());
// Calculate stats
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
todayHours: (todayMs / 3600000).toFixed(1),
weekHours: (weekMs / 3600000).toFixed(1),
weekMinutes: Math.floor((weekMs % 3600000) / 60000)
};
}, [records]);
useEffect(() => {
const timer = setInterval(() => {
setCurrentTime(new Date());
}, 1000);
return () => clearInterval(timer);
}, []);
useEffect(() => {
fetch('/api/worksites').then(res => res.json()).then(data => {
setWorksites(data);
if (data.length > 0) setSelectedWorksite(data[0].id);
});
}, []);
useEffect(() => {
if (location && selectedWorksite) {
const site = worksites.find(w => w.id === selectedWorksite);
if (site) {
const d = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
setDistance(d);
}
}
}, [location, selectedWorksite, worksites]);
const currentSite = worksites.find(w => w.id === selectedWorksite);
const canClockIn = distance !== null && currentSite && distance <= currentSite.radius;
return (
<div className="flex-1 flex flex-col p-4 space-y-6 max-w-md mx-auto w-full font-['Quicksand']">
<section className="text-center py-6">
<p className="text-slate-400 font-medium mb-1 capitalize">
{currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
</p>
<h1 className="text-5xl font-bold tracking-tight text-white mb-4">
{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
</h1>
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-sm font-medium">
<span className="w-2 h-2 rounded-full bg-slate-400"></span>
Estado: No ha fichado
</div>
</section>
<section className="space-y-4 px-2">
<div className="space-y-2">
<label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Seleccionar Sede</label>
<div className="relative">
<select 
value={selectedWorksite}
onChange={(e) => setSelectedWorksite(Number(e.target.value))}
className="w-full bg-slate-900 border border-orange-500/20 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-medium"
>
{worksites.map(site => (
<option key={site.id} value={site.id}>{site.name}</option>
))}
</select>
<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#ff8c00]">
<ChevronRight className="rotate-90" />
</div>
</div>
</div>
<div className={`flex items-center gap-2 justify-center py-2 px-4 rounded-lg border transition-colors ${canClockIn ? 'bg-green-500/10 border-green-500/20' : 'bg-orange-500/5 border-orange-500/10'}`}>
<MapPin className={`w-4 h-4 ${canClockIn ? 'text-green-500' : 'text-[#ff8c00]'}`} />
<p className={`text-xs font-medium ${canClockIn ? 'text-green-500' : 'text-slate-400'}`}>
{canClockIn 
? `¡Estás en la sede (a ${distance?.toFixed(1)}m)! Puedes fichar.` 
: `Solo disponible a menos de ${currentSite?.radius || 10}m de la sede (Estás a ${distance !== null ? distance.toFixed(1) : '?'}m)`}
</p>
</div>
{/* AQUÍ ESTÁ EL AVISO ROJO DEL ERROR GPS */}
{geoError && <p className="text-red-500 text-[10px] font-bold mt-2 uppercase w-full text-center">⚠️ Error GPS: {geoError}</p>}
</section>
<section className="flex justify-center pb-4">
</section>
<section className="flex justify-center pb-4">
<button 
disabled={!canClockIn}
onClick={() => onClockIn(selectedWorksite)}
className={`w-full max-w-xs aspect-square rounded-full shadow-xl flex flex-col items-center justify-center text-white transition-all active:scale-95 group ${canClockIn ? 'bg-[#ff8c00] hover:bg-orange-600 shadow-orange-500/20 cursor-pointer' : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'}`}
>
<Fingerprint className={`w-16 h-16 mb-2 transition-transform ${canClockIn ? 'group-hover:scale-110' : ''}`} />
<span className="text-xl font-bold uppercase tracking-wider">Fichar Entrada</span>
</button>
</section>
<section className="grid grid-cols-2 gap-4">
<div className="bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
<p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Horas Hoy</p>
<p className="text-2xl font-black text-white">{stats.todayHours}h</p>
<div className="flex items-center gap-1 text-green-400 text-[10px] font-bold mt-1">
<TrendingUp className="w-3 h-3" /> Turno actual
</div>
</div>
<div className="bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
<p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Puntualidad</p>
<p className="text-2xl font-black text-white">--%</p>
<div className="flex items-center gap-1 text-[#ff8c00] text-[10px] font-bold mt-1">
<Check className="w-3 h-3" /> Sin datos
</div>
</div>
</section>
<section className="bg-slate-900 rounded-xl p-5 border border-orange-500/5 shadow-sm">
<div className="flex justify-between items-center mb-4">
<h3 className="font-semibold text-slate-300">Esta semana</h3>
<span className="text-[#ff8c00] font-bold text-lg">{stats.weekHours}h {stats.weekMinutes}m</span>
</div>
<div className="w-full bg-orange-500/10 rounded-full h-2.5 mb-2">
<div className="bg-[#ff8c00] h-2.5 rounded-full" style={{ width: `${Math.min((parseFloat(stats.weekHours) / 40) * 100, 100)}%` }}></div>
</div>
<p className="text-xs text-slate-500">Objetivo: 40h 00m</p>
</section>
<section className="space-y-3">
<div className="flex items-center justify-between px-1">
<h3 className="font-semibold text-slate-300">Actividad reciente</h3>
<button className="text-[#ff8c00] text-sm font-medium">Ver todo</button>
</div>
<div className="space-y-2">
{records.slice(0, 3).map(record => (
<div key={record.id} className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
{record.type === 'IN' ? <LogIn className="text-[#ff8c00] w-5 h-5" /> : <LogOut className="text-[#ff8c00] w-5 h-5" />}
</div>
<div>
<p className="font-semibold text-sm">{new Date(record.timestamp).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
<p className="text-xs text-slate-500">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {record.worksite_name}</p>
</div>
</div>
<div className="text-right">
<p className="font-bold text-sm">{record.type === 'IN' ? 'Entrada' : 'Salida'}</p>
</div>
</div>
))}
</div>
</section>
</div>
);
};
const ActiveSession = ({ user, onFinish, onDiscard, startTime }: { user: User, onFinish: (notes: string) => void, onDiscard: () => void, startTime: Date }) => {
const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
const [notes, setNotes] = useState('');
const [isPaused, setIsPaused] = useState(false);
useEffect(() => {
if (isPaused) return;
const interval = setInterval(() => {
const diff = new Date().getTime() - startTime.getTime();
const h = Math.floor(diff / 3600000);
const m = Math.floor((diff % 3600000) / 60000);
const s = Math.floor((diff % 60000) / 1000);
setElapsed({ h, m, s });
}, 1000);
return () => clearInterval(interval);
}, [startTime, isPaused]);
return (
<div className="flex-1 overflow-y-auto px-6 py-8 font-['Quicksand']">
<div className="flex justify-center mb-8">
<div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isPaused ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-orange-500/10 text-[#ff8c00] border-orange-500/20'}`}>
<span className="relative flex h-2 w-2">
{!isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c00] opacity-75"></span>}
<span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? 'bg-amber-500' : 'bg-[#ff8c00]'}`}></span>
</span>
<span className="text-xs font-semibold uppercase tracking-wider">{isPaused ? 'SESIÓN EN PAUSA' : 'TRABAJANDO ACTUALMENTE'}</span>
</div>
</div>
<div className="text-center mb-4">
<div className="flex justify-center items-baseline gap-2">
<div className="flex flex-col items-center">
<span className="text-6xl font-bold tracking-tighter tabular-nums text-white">{elapsed.h.toString().padStart(2, '0')}</span>
<span className="text-[10px] uppercase font-bold text-slate-500 mt-1">HORAS</span>
</div>
<span className="text-5xl font-light text-slate-700 mb-6 animate-pulse">:</span>
<div className="flex flex-col items-center">
<span className="text-6xl font-bold tracking-tighter tabular-nums text-white">{elapsed.m.toString().padStart(2, '0')}</span>
<span className="text-[10px] uppercase font-bold text-slate-500 mt-1">MINUTOS</span>
</div>
<span className="text-5xl font-light text-slate-700 mb-6 animate-pulse">:</span>
<div className="flex flex-col items-center">
<span className="text-6xl font-bold tracking-tighter tabular-nums text-white">{elapsed.s.toString().padStart(2, '0')}</span>
<span className="text-[10px] uppercase font-bold text-slate-500 mt-1">SEGUNDOS</span>
</div>
</div>
</div>
<div className="flex flex-col items-center mb-12">
<div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-800">
<Clock className="w-4 h-4" />
<span className="text-sm font-medium">Iniciado a las {startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
</div>
</div>
<div className="space-y-4">
<div className="flex items-center justify-between">
<label className="text-sm font-bold text-slate-300">¿En qué estás trabajando?</label>
<span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">OPCIONAL</span>
</div>
<div className="relative">
<textarea 
value={notes}
onChange={(e) => setNotes(e.target.value)}
className="w-full min-h-[120px] p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-[#ff8c00] outline-none transition-all resize-none text-slate-200" 
placeholder="p. ej. Diseñando componentes de UI móvil y finalizando el flujo de usuario..."
></textarea>
<div className="absolute bottom-3 right-3">
<Edit3 className="text-slate-500 w-5 h-5" />
</div>
</div>
<div className="flex gap-2 flex-wrap">
{['#Desarrollo', '#Diseño', '#Reunión', '#Formación', '#Viaje', '#Soporte'].map(tag => (
<button key={tag} onClick={() => setNotes(n => n + ' ' + tag)} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:border-orange-500/40 transition-colors">
{tag}
</button>
))}
</div>
</div>
<div className="mt-12">
<button 
onClick={() => onFinish(notes)}
className="flex items-center justify-center gap-3 w-full h-14 bg-[#ff8c00] hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
>
<TimerOff className="w-6 h-6" />
<span>Finalizar Turno</span>
</button>
<div className="flex gap-3 mt-4">
<button 
onClick={() => setIsPaused(!isPaused)}
className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-semibold text-sm transition-all ${isPaused ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
>
{isPaused ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
<span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
</button>
<button 
onClick={() => {
if (confirm('¿Estás seguro de que quieres descartar este turno? No se guardará ningún registro.')) {
onDiscard();
}
}}
className="flex-1 flex items-center justify-center gap-2 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-all"
>
<Trash2 className="w-5 h-5" />
<span>Descartar</span>
</button>
</div>
</div>
</div>
);
};
const HistoryView = ({ records, user, onSelectRecord }: { records: Record[], user: User, onSelectRecord: (record: Record) => void }) => {
const totalDurationMs = (() => {
let total = 0;
const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
for (let i = 0; i < sorted.length; i++) {
if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
total += new Date(sorted[i+1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
i++;
}
}
return total;
})();
const hours = Math.floor(totalDurationMs / 3600000);
const minutes = Math.floor((totalDurationMs % 3600000) / 60000);
return (
<div className="flex-1 px-4 py-6 space-y-4 pb-24 font-['Quicksand']">
<div className="flex flex-col gap-4 mb-6">
<div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-orange-500/5 shadow-sm">
<div className="flex items-center gap-2 cursor-pointer group">
<span className="text-sm font-medium text-slate-400">Viendo:</span>
<div className="flex items-center gap-1 font-bold text-white group-hover:text-[#ff8c00] transition-colors capitalize">
{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} <ChevronRight className="rotate-90 w-4 h-4" />
</div>
</div>
<div className="h-8 w-px bg-slate-700"></div>
<div className="text-right">
<p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Duración Total</p>
<p className="text-lg font-bold text-[#ff8c00]">{hours}h {minutes}m</p>
</div>
</div>
</div>
<div className="space-y-4">
{records.map(record => (
<div 
key={record.id} 
onClick={() => onSelectRecord(record)}
className={`bg-slate-800 rounded-xl border-l-4 shadow-sm border border-slate-700/50 overflow-hidden cursor-pointer hover:border-orange-500/30 transition-all ${record.type === 'IN' ? 'border-l-green-500' : 'border-l-red-500'}`}
>
<div className="p-4 flex items-center gap-4">
<div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-lg w-16 h-16 border border-slate-800">
<span className="text-2xl font-black text-white">{new Date(record.timestamp).getDate()}</span>
<span className="text-[10px] font-bold uppercase text-slate-500">{new Date(record.timestamp).toLocaleDateString('es-ES', { month: 'short' })}</span>
</div>
<div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
<div>
<p className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
{record.type === 'IN' ? <LogIn className="w-3 h-3 text-green-500" /> : <LogOut className="w-3 h-3 text-red-500" />}
{record.type === 'IN' ? 'Entrada' : 'Salida'}
</p>
<p className="text-base font-semibold text-slate-200">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
</div>
<div className="text-right">
<p className="text-[10px] font-bold uppercase text-slate-500">Sede</p>
<p className="text-xs text-slate-400 truncate">{record.worksite_name}</p>
</div>
</div>
<div className="flex flex-col items-end gap-2">
<span className="inline-flex items-center px-2 py-1 rounded bg-orange-500/10 text-[#ff8c00] text-xs font-bold">
{(record.distance || 0) < 0.1 ? '<0.1m' : `${(record.distance || 0).toFixed(1)}m`}
</span>
<button 
type="button"
onClick={(e) => {
e.stopPropagation();
e.preventDefault();
generateRecordPDF(record, user);
}}
className="p-2 text-slate-500 hover:text-[#ff8c00] hover:bg-orange-500/5 rounded-lg transition-all"
>
<Printer className="w-5 h-5" />
</button>
</div>
</div>
</div>
))}
</div>
</div>
);
};
const RecordDetailView = ({ record, user, onBack }: { record: Record, user: User, onBack: () => void }) => {
return (
<div className="flex-1 bg-slate-950 font-['Quicksand'] overflow-y-auto pb-24">
<header className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
<div className="flex items-center gap-3">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h1 className="text-lg font-semibold">Detalle del Registro</h1>
</div>
<button className="text-[#ff8c00] font-semibold text-sm px-3 py-1 hover:bg-orange-500/20 rounded transition-colors">Editar</button>
</header>
<div className="p-6 space-y-6">
<div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 flex items-center justify-between">
<div className="flex gap-5 items-center">
<div className="relative">
<div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden">
<img src={`https://picsum.photos/seed/${record.user_id}/200`} alt="Profile" className="w-full h-full object-cover" />
</div>
<div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
</div>
<div>
<h2 className="text-xl font-bold">{record.user_name || user.name}</h2>
<p className="text-slate-500 text-xs">ID: {user.employee_id} • {user.department}</p>
</div>
</div>
<div className="text-right">
<p className="text-[#ff8c00] font-bold text-sm">{new Date(record.timestamp).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-900/30 text-green-400">
<Verified className="w-3 h-3 mr-1" /> Registro Verificado
</span>
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
<p className="text-slate-500 text-[10px] font-bold uppercase">Tipo de Registro</p>
<p className="text-xl font-bold text-[#ff8c00]">{record.type === 'IN' ? 'Entrada' : 'Salida'}</p>
<p className="text-slate-500 text-[10px]">{record.is_manual ? 'Registro Manual' : 'Registro Automático'}</p>
</div>
<div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
<p className="text-slate-500 text-[10px] font-bold uppercase">Distancia a Sede</p>
<p className="text-xl font-bold">{(record.distance || 0).toFixed(1)}m</p>
<p className="text-slate-500 text-[10px]">{(record.distance || 0) < 0.1 ? 'En el punto exacto' : 'Dentro del radio'}</p>
</div>
</div>
<div className="space-y-4">
<h3 className="text-white text-sm font-bold flex items-center gap-2">
<History className="w-4 h-4 text-[#ff8c00]" /> Detalles del Evento
</h3>
<div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
<div className="relative mb-8">
<div className={`absolute -left-6 top-0 w-4 h-4 rounded-full bg-slate-950 border-2 flex items-center justify-center ${record.type === 'IN' ? 'border-green-500' : 'border-red-500'}`}>
<div className={`w-1.5 h-1.5 rounded-full ${record.type === 'IN' ? 'bg-green-500' : 'bg-red-500'}`}></div>
</div>
<div className="flex justify-between items-start">
<div>
<p className="font-bold text-sm">{record.type === 'IN' ? 'Entrada Registrada' : 'Salida Registrada'}</p>
<p className="text-xs text-slate-400">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
<p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {record.worksite_name}</p>
</div>
</div>
</div>
<div className="relative">
<div className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center">
<div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
</div>
<div className="flex justify-between items-start">
<div>
<p className="font-bold text-sm text-slate-500">Coordenadas GPS</p>
<p className="text-[10px] text-slate-600 font-mono">{(record.latitude || 0).toFixed(6)}, {(record.longitude || 0).toFixed(6)}</p>
</div>
</div>
</div>
</div>
</div>
<div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
<div className="flex items-center justify-between mb-3">
<h4 className="font-bold text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-slate-500" /> Notas</h4>
<span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Empleado</span>
</div>
<p className="text-slate-300 text-xs italic leading-relaxed">
"{record.notes || 'Sin notas adicionales para este registro.'}"
</p>
</div>
{record.audit_log && (
<div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
<div className="flex items-center justify-between mb-3">
<h4 className="font-bold text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500" /> Registro de Auditoría</h4>
<span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Sistema</span>
</div>
<p className="text-slate-400 text-[10px] font-mono leading-relaxed">
{record.audit_log}
</p>
</div>
)}
</div>
<footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 p-4 flex gap-3 z-20">
<button 
type="button"
className="flex-1 bg-[#ff8c00] text-white font-bold py-3.5 rounded-lg shadow-lg flex items-center justify-center gap-2" 
onClick={(e) => {
e.preventDefault();
generateRecordPDF(record, user);
}}
>
<Printer className="w-5 h-5" /> Exportar PDF
</button>
<button className="w-14 h-14 flex items-center justify-center border border-slate-800 rounded-lg bg-slate-900">
<Share2 className="w-6 h-6 text-slate-400" />
</button>
</footer>
</div>
);
};
const WeeklySummaryView = ({ records, user, showToast, onSelectRecord }: { records: Record[], user: User, showToast: (msg: string, type: 'success' | 'error') => void, onSelectRecord: (record: Record) => void }) => {
const [currentWeekStart, setCurrentWeekStart] = useState(() => {
const now = new Date();
const day = now.getDay();
const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
const monday = new Date(now.setDate(diff));
monday.setHours(0, 0, 0, 0);
return monday;
});
const weekDays = Array.from({ length: 7 }, (_, i) => {
const d = new Date(currentWeekStart);
d.setDate(currentWeekStart.getDate() + i);
return d;
});
const weekEnd = new Date(weekDays[6]);
weekEnd.setHours(23, 59, 59, 999);
const weekRecords = records.filter(r => {
const d = new Date(r.timestamp);
return d >= currentWeekStart && d <= weekEnd;
});
const dailyHours = weekDays.map(day => {
const dayRecords = weekRecords.filter(r => {
const d = new Date(r.timestamp);
return d.toDateString() === day.toDateString();
});
// Calculate hours between IN and OUT
let totalMs = 0;
const sorted = [...dayRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
for (let i = 0; i < sorted.length; i++) {
if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
totalMs += new Date(sorted[i+1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
i++;
}
}
return totalMs / 3600000;
});
const totalWeeklyHours = dailyHours.reduce((a, b) => a + b, 0);
const maxHours = Math.max(...dailyHours, 8); // At least 8 for scale
const navigateWeek = (direction: number) => {
const newDate = new Date(currentWeekStart);
newDate.setDate(newDate.getDate() + (direction * 7));
setCurrentWeekStart(newDate);
};
const isThisWeek = currentWeekStart.toDateString() === (() => {
const now = new Date();
const day = now.getDay();
const diff = now.getDate() - day + (day === 0 ? -6 : 1);
const monday = new Date(now.setDate(diff));
monday.setHours(0, 0, 0, 0);
return monday.toDateString();
})();
const daysLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
return (
<div className="flex-1 px-4 py-4 space-y-6 pb-24 font-['Quicksand'] overflow-y-auto">
<div className="flex items-center justify-between bg-slate-900 rounded-xl p-1 border border-slate-800">
<button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
<div className="flex flex-col items-center">
<span className="text-sm font-semibold text-white">
{currentWeekStart.getDate()} {currentWeekStart.toLocaleDateString('es-ES', { month: 'short' })} - {weekEnd.getDate()} {weekEnd.toLocaleDateString('es-ES', { month: 'short' })}
</span>
<span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
{isThisWeek ? 'Esta semana' : 'Semana seleccionada'}
</span>
</div>
<button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-slate-800"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
</div>
<section className="bg-slate-900 rounded-2xl p-5 border border-slate-800">
<div className="flex justify-between items-end mb-6">
<div>
<p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Horas Diarias</p>
<p className="text-3xl font-black text-[#ff8c00]">{totalWeeklyHours.toFixed(1)}h</p>
</div>
<div className="flex items-center gap-1 text-[#ff8c00] bg-orange-500/10 px-2 py-1 rounded-full text-xs font-bold">
<TrendingUp className="w-4 h-4" /> {isThisWeek ? 'En curso' : 'Completado'}
</div>
</div>
<div className="flex items-end justify-between h-40 gap-2 px-1">
{daysLabels.map((day, i) => (
<div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
<div className="w-full bg-orange-500/10 rounded-t-lg relative h-full flex items-end">
<motion.div 
initial={{ height: 0 }}
animate={{ height: `${(dailyHours[i] / maxHours) * 100}%` }}
className="w-full bg-[#ff8c00] rounded-t-lg"
></motion.div>
</div>
<span className="text-[10px] font-bold text-slate-500">{day}</span>
</div>
))}
</div>
</section>
<div className="grid grid-cols-2 gap-4">
<div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
<Clock className="text-[#ff8c00] w-5 h-5 mb-2" />
<p className="text-xs text-slate-400 font-medium">Horas Totales</p>
<p className="text-2xl font-bold text-white">{totalWeeklyHours.toFixed(1)}h</p>
<p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Semana</p>
</div>
<div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
<Verified className="text-[#ff8c00] w-5 h-5 mb-2" />
<p className="text-xs text-slate-400 font-medium">Puntualidad</p>
<p className="text-2xl font-bold text-white">--%</p>
<p className="text-[10px] text-[#ff8c00] mt-1 font-bold">Sin datos</p>
</div>
</div>
<section className="space-y-3">
<h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">Registros de la semana</h3>
{weekRecords.length === 0 ? (
<div className="text-center py-8 text-slate-500 italic text-sm">No hay registros esta semana</div>
) : (
weekRecords.map((record) => (
<div 
key={record.id} 
onClick={() => onSelectRecord(record)}
className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between cursor-pointer hover:border-orange-500/30 transition-all"
>
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-[#ff8c00]">
<span className="text-xs font-bold">{new Date(record.timestamp).getDate()}</span>
</div>
<div>
<p className="text-sm font-bold text-white">
{new Date(record.timestamp).toLocaleDateString('es-ES', { weekday: 'long' })}
</p>
<p className="text-xs text-slate-400">
{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {record.type === 'IN' ? 'Entrada' : 'Salida'}
</p>
</div>
</div>
<div className="text-right">
<span className={`inline-block px-2 py-1 text-[10px] font-black uppercase rounded ${record.type === 'IN' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
{record.type === 'IN' ? 'Entrada' : 'Salida'}
</span>
</div>
</div>
))
)}
</section>
<button 
type="button"
onClick={(e) => {
e.preventDefault();
if (weekRecords.length > 0) {
try {
const periodLabel = `${currentWeekStart.toLocaleDateString('es-ES')} - ${weekEnd.toLocaleDateString('es-ES')}`;
generateFullReportPDF(weekRecords, user, periodLabel);
showToast('Informe generado correctamente', 'success');
} catch (err) {
showToast('Error al generar el PDF', 'error');
}
} else {
showToast('No hay registros para exportar en esta semana', 'error');
}
}}
className="w-full flex items-center justify-center gap-2 bg-[#ff8c00] hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
>
<FileText className="w-5 h-5" />
<span>Descargar PDF</span>
</button>
</div>
);
};
const EditProfileView = ({ user, onSave, onBack }: { user: User, onSave: (updatedUser: User) => void, onBack: () => void }) => {
const [name, setName] = useState(user.name);
const [department, setDepartment] = useState(user.department);
const [loading, setLoading] = useState(false);
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
const res = await fetch('/api/users/update', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ id: user.id, name, department })
});
if (res.ok) {
const updatedUser = await res.json();
onSave(updatedUser);
}
setLoading(false);
};
return (
<div className="p-8 space-y-8 font-['Quicksand']">
<div className="flex items-center gap-4">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Editar Perfil</h2>
</div>
<form onSubmit={handleSubmit} className="space-y-6">
<div className="flex flex-col items-center space-y-4 mb-8">
<div className="relative">
<div className="w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-900 shadow-xl overflow-hidden">
<img src={`https://picsum.photos/seed/${user.id}/200`} alt="Profile" className="w-full h-full object-cover" />
</div>
<div className="absolute bottom-0 right-0 w-8 h-8 bg-[#ff8c00] rounded-full flex items-center justify-center border-2 border-slate-900 cursor-pointer">
<Edit3 className="w-4 h-4 text-white" />
</div>
</div>
</div>
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo</label>
<input 
type="text" 
value={name}
onChange={(e) => setName(e.target.value)}
className="block w-full px-4 py-2.5 border border-slate-700 rounded-lg bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-[#ff8c00] transition-all" 
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Departamento</label>
<input 
type="text" 
value={department}
onChange={(e) => setDepartment(e.target.value)}
className="block w-full px-4 py-2.5 border border-slate-700 rounded-lg bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-[#ff8c00] transition-all" 
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">ID de Empleado (No editable)</label>
<input 
type="text" 
value={user.employee_id}
disabled
className="block w-full px-4 py-2.5 border border-slate-700 rounded-lg bg-slate-900 text-slate-500 cursor-not-allowed" 
/>
</div>
<button 
type="submit" 
disabled={loading}
className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#ff8c00] hover:bg-[#ff8c00]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff8c00] transition-all uppercase tracking-wide disabled:opacity-50"
>
{loading ? 'Guardando...' : 'Guardar Cambios'}
</button>
</form>
</div>
);
};
const ChangePasswordView = ({ user, onBack }: { user: User, onBack: () => void }) => {
const [oldPassword, setOldPassword] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState(false);
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
if (newPassword !== confirmPassword) {
setError('Las contraseñas no coinciden');
return;
}
setLoading(true);
setError('');
const res = await fetch('/api/users/change-password', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ id: user.id, oldPassword, newPassword })
});
if (res.ok) {
setSuccess(true);
setOldPassword('');
setNewPassword('');
setConfirmPassword('');
} else {
const data = await res.json();
setError(data.error || 'Error al cambiar la contraseña');
}
setLoading(false);
};
return (
<div className="p-8 space-y-8 font-['Quicksand']">
<div className="flex items-center gap-4">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Cambiar Contraseña</h2>
</div>
<form onSubmit={handleSubmit} className="space-y-6">
{success && (
<div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-green-500 text-sm flex items-center gap-2">
<Check className="w-4 h-4" />
Contraseña actualizada correctamente
</div>
)}
{error && (
<div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-500 text-sm flex items-center gap-2">
<X className="w-4 h-4" />
{error}
</div>
)}
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Contraseña Actual</label>
<input 
type="password" 
value={oldPassword}
onChange={(e) => setOldPassword(e.target.value)}
className="block w-full px-4 py-2.5 border border-slate-700 rounded-lg bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-[#ff8c00] transition-all" 
required
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Nueva Contraseña</label>
<input 
type="password" 
value={newPassword}
onChange={(e) => setNewPassword(e.target.value)}
className="block w-full px-4 py-2.5 border border-slate-700 rounded-lg bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-[#ff8c00] transition-all" 
required
/>
</div>
<div>
<label className="block text-sm font-medium text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
<input 
type="password" 
value={confirmPassword}
onChange={(e) => setConfirmPassword(e.target.value)}
className="block w-full px-4 py-2.5 border border-slate-700 rounded-lg bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-[#ff8c00] transition-all" 
required
/>
</div>
<button 
type="submit" 
disabled={loading}
className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#ff8c00] hover:bg-[#ff8c00]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff8c00] transition-all uppercase tracking-wide disabled:opacity-50"
>
{loading ? 'Cambiando...' : 'Cambiar Contraseña'}
</button>
</form>
</div>
);
};
const NotificationsView = ({ onBack }: { onBack: () => void }) => {
const [settings, setSettings] = useState({
push: true,
email: false,
system: true
});
const toggle = (key: keyof typeof settings) => {
setSettings(s => ({ ...s, [key]: !s[key] }));
};
return (
<div className="p-8 space-y-8 font-['Quicksand']">
<div className="flex items-center gap-4">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Notificaciones</h2>
</div>
<div className="space-y-4">
{[
{ key: 'push', label: 'Notificaciones Push', sub: 'Recibe alertas en tiempo real en tu dispositivo' },
{ key: 'email', label: 'Correo Electrónico', sub: 'Resúmenes semanales y alertas críticas' },
{ key: 'system', label: 'Alertas de Sistema', sub: 'Notificaciones sobre actualizaciones y mantenimiento' }
].map(item => (
<div key={item.key} className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800">
<div>
<p className="font-bold text-sm">{item.label}</p>
<p className="text-xs text-slate-500">{item.sub}</p>
</div>
<button 
onClick={() => toggle(item.key as keyof typeof settings)}
className={`w-12 h-6 rounded-full transition-colors relative ${settings[item.key as keyof typeof settings] ? 'bg-[#ff8c00]' : 'bg-slate-700'}`}
>
<div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings[item.key as keyof typeof settings] ? 'right-1' : 'left-1'}`}></div>
</button>
</div>
))}
</div>
</div>
);
};
requests.map(req => (
          <div key={req.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-start cursor-pointer" onClick={() => onSelectRecord(req)}>
              <div>
                <p className="font-bold text-white text-lg">{req.user_name}</p>
                <p className="text-xs text-slate-500">{req.worksite_name} • {new Date(req.timestamp).toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <div className="flex flex-col gap-1 items-end">
  {/* Cambiamos distancia_metros por distance */}
  {req.distance > 100 && <span className="text-red-500 font-black text-[10px] bg-red-500/10 px-2 py-1 rounded">FUERA RANGO</span>}
  
  {req.estado_extra === 'PENDIENTE' && <span className="text-orange-500 font-black text-[10px] bg-orange-500/10 px-2 py-1 rounded">+{req.minutos_extra} MIN EXTRAS</span>}
</div>
                {req.estado_extra === 'PENDIENTE' && <span className="text-orange-500 font-black text-[10px] bg-orange-500/10 px-2 py-1 rounded">+{req.minutos_extra} MIN EXTRAS</span>}
              </div>
            </div>
            
            {req.estado_extra === 'PENDIENTE' && (
              <p className="text-xs text-slate-400 italic bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                El empleado ha finalizado su jornada después de su horario teórico ({req.minutos_extra} min de exceso).
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => handleAction(req.id, 'APPROVED')} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold text-xs hover:bg-green-600 transition-colors">APROBAR</button>
              <button onClick={() => handleAction(req.id, 'REJECTED')} className="flex-1 bg-red-500/10 text-red-500 py-3 rounded-xl font-bold text-xs hover:bg-red-500/20 transition-colors">RECHAZAR</button>
            </div>
          </div>
        ))
useEffect(() => {
fetchRequests();
}, []);
const handleAction = async (id: number, status: 'APPROVED' | 'REJECTED') => {
try {
await fetch('/api/admin/records/approve', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ id, status, audit_log: `Acción realizada por administrador el ${new Date().toLocaleString()}` })
});
fetchRequests();
onActionComplete();
} catch (err) {
console.error(err);
}
};
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<div className="flex items-center gap-4">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Solicitudes Pendientes</h2>
</div>
{loading ? (
<div className="flex justify-center py-12">
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff8c00]"></div>
</div>
) : requests.length === 0 ? (
<div className="text-center py-12 bg-slate-900 rounded-3xl border border-slate-800">
<CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-20" />
<p className="text-slate-500 font-bold">No hay solicitudes pendientes</p>
</div>
) : (
<div className="space-y-4">
{requests.map(req => (
<div key={req.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
<div className="flex items-start justify-between cursor-pointer" onClick={() => onSelectRecord(req)}>
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
<UserIcon className="w-6 h-6 text-slate-400" />
</div>
<div>
<p className="font-bold text-white">{req.user_name}</p>
<p className="text-xs text-slate-500">{req.worksite_name}</p>
</div>
</div>
<span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.type === 'IN' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
{req.type === 'IN' ? 'Entrada' : 'Salida'}
</span>
</div>
<div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-800">
<div>
<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Fecha y Hora</p>
<p className="text-sm font-bold">{new Date(req.timestamp).toLocaleString()}</p>
</div>
<div>
<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tipo</p>
<p className="text-sm font-bold">{req.is_manual ? 'Manual' : 'Automático'}</p>
</div>
</div>
{req.notes && (
<div>
<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Motivo/Notas</p>
<p className="text-sm text-slate-300 italic">"{req.notes}"</p>
</div>
)}
<div className="flex gap-3">
<button 
onClick={() => handleAction(req.id, 'APPROVED')}
className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
>
<Check className="w-4 h-4" /> Aprobar
</button>
<button 
onClick={() => handleAction(req.id, 'REJECTED')}
className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
>
<X className="w-4 h-4" /> Rechazar
</button>
</div>
</div>
))}
</div>
)}
</div>
);
};
const ReportsView = ({ records, users, onBack }: { records: Record[], users: User[], onBack: () => void }) => {
const trendsData = useMemo(() => {
const days = [...Array(7)].map((_, i) => {
const d = new Date();
d.setDate(d.getDate() - (6 - i));
return d.toISOString().split('T')[0];
});
return days.map(day => {
const dayRecords = records.filter(r => r.timestamp.startsWith(day));
const ins = dayRecords.filter(r => r.type === 'IN').length;
return { day: day.split('-').slice(1).join('/'), fichajes: ins };
});
}, [records]);
const distributionData = useMemo(() => {
const depts: { [key: string]: number } = {};
users.forEach(u => {
const dept = u.department || 'Sin Dept';
depts[dept] = (depts[dept] || 0) + 1;
});
return Object.entries(depts).map(([name, value]) => ({ name, value }));
}, [users]);
const COLORS = ['#ff8c00', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<div className="flex items-center gap-4">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Informes y Análisis</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
<h3 className="text-lg font-bold mb-6">Tendencias de Asistencia</h3>
<div className="h-64 w-full">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={trendsData}>
<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
<XAxis 
dataKey="day" 
stroke="#94a3b8" 
fontSize={10} 
tickLine={false} 
axisLine={false}
/>
<YAxis 
stroke="#94a3b8" 
fontSize={10} 
tickLine={false} 
axisLine={false}
/>
<Tooltip 
contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
itemStyle={{ color: '#ff8c00' }}
/>
<Bar dataKey="fichajes" fill="#ff8c00" radius={[4, 4, 0, 0]} />
</BarChart>
</ResponsiveContainer>
</div>
</div>
<div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
<h3 className="text-lg font-bold mb-6">Distribución por Departamento</h3>
<div className="h-64 w-full">
<ResponsiveContainer width="100%" height="100%">
<PieChart>
<Pie
data={distributionData}
cx="50%"
cy="50%"
innerRadius={60}
outerRadius={80}
paddingAngle={5}
dataKey="value"
>
{distributionData.map((entry, index) => (
<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
))}
</Pie>
<Tooltip 
contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
/>
<Legend verticalAlign="bottom" height={36}/>
</PieChart>
</ResponsiveContainer>
</div>
</div>
</div>
<div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
<h3 className="text-lg font-bold mb-6">Actividad por Sede</h3>
<div className="h-64 w-full">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={trendsData}>
<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
<XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
<YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
<Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
<Line type="monotone" dataKey="fichajes" stroke="#ff8c00" strokeWidth={3} dot={{ fill: '#ff8c00', r: 4 }} activeDot={{ r: 6 }} />
</LineChart>
</ResponsiveContainer>
</div>
</div>
</div>
);
};
const AdminRecordsListView = ({ records, users, onSelectRecord, onBack }: { records: Record[], users: User[], onSelectRecord: (record: Record) => void, onBack: () => void }) => {
const [startDate, setStartDate] = useState(() => {
const d = new Date();
d.setHours(0, 0, 0, 0);
return d.toISOString().split('T')[0];
});
const [endDate, setEndDate] = useState(() => {
const d = new Date();
d.setHours(23, 59, 59, 999);
return d.toISOString().split('T')[0];
});
const [selectedUserId, setSelectedUserId] = useState<string>('all');
const filteredRecords = useMemo(() => {
return records.filter(r => {
const recordDate = r.timestamp.split('T')[0];
const matchesDate = recordDate >= startDate && recordDate <= endDate;
const matchesUser = selectedUserId === 'all' || r.user_id.toString() === selectedUserId;
return matchesDate && matchesUser;
});
}, [records, startDate, endDate, selectedUserId]);
const summary = useMemo(() => {
const recordsByUser: { [key: number]: Record[] } = {};
filteredRecords.forEach(r => {
if (!recordsByUser[r.user_id]) recordsByUser[r.user_id] = [];
recordsByUser[r.user_id].push(r);
});
let totalMs = 0;
Object.values(recordsByUser).forEach(userRecs => {
const sorted = [...userRecs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
for (let i = 0; i < sorted.length; i++) {
if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
totalMs += new Date(sorted[i+1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
i++;
}
}
});
const hours = Math.floor(totalMs / 3600000);
const minutes = Math.floor((totalMs % 3600000) / 60000);
return { hours, minutes, totalMs };
}, [filteredRecords]);
const dailyStats = useMemo(() => {
const days: { [key: string]: number } = {};
const start = new Date(startDate);
const end = new Date(endDate);
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
days[d.toDateString()] = 0;
}
const recordsByUser: { [key: string]: Record[] } = {};
filteredRecords.forEach(r => {
if (!recordsByUser[r.user_id]) recordsByUser[r.user_id] = [];
recordsByUser[r.user_id].push(r);
});
Object.values(recordsByUser).forEach(userRecs => {
const sorted = [...userRecs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
for (let i = 0; i < sorted.length; i++) {
if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
const inTime = new Date(sorted[i].timestamp);
const outTime = new Date(sorted[i+1].timestamp);
const dayStr = inTime.toDateString();
if (days[dayStr] !== undefined) {
days[dayStr] += (outTime.getTime() - inTime.getTime()) / 3600000;
}
i++;
}
}
});
return Object.entries(days).map(([date, hours]) => ({
date: new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
hours
}));
}, [filteredRecords, startDate, endDate]);
const maxHours = Math.max(...dailyStats.map(d => d.hours), 8);
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<header className="flex items-center justify-between">
<div className="flex items-center gap-3">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Registros de Empleados</h2>
</div>
<button 
disabled={filteredRecords.length === 0}
onClick={() => {
const periodLabel = `Periodo: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
generateFullReportPDF(filteredRecords, { name: 'Informe de Registros', employee_id: 'ADMIN', department: 'Administración', email: '' } as any, periodLabel);
}}
className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-orange-500/20"
>
<Download className="w-4 h-4" /> Exportar PDF
</button>
</header>
<section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Desde</label>
<input 
type="date" 
value={startDate}
onChange={(e) => setStartDate(e.target.value)}
className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
<input 
type="date" 
value={endDate}
onChange={(e) => setEndDate(e.target.value)}
className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Empleado</label>
<select 
value={selectedUserId}
onChange={(e) => setSelectedUserId(e.target.value)}
className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
>
<option value="all">Todos los empleados</option>
{users.map(u => (
<option key={u.id} value={u.id}>{u.name}</option>
))}
</select>
</div>
</div>
</section>
<section className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-8">
<div className="flex justify-between items-start">
<div>
<p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Resumen del Periodo</p>
<div className="flex items-baseline gap-2">
<span className="text-5xl font-black text-white">{summary.hours}h</span>
<span className="text-2xl font-bold text-slate-500">{summary.minutes}m</span>
</div>
</div>
<div className="flex flex-col items-end gap-2">
<div className="px-3 py-1 bg-orange-500/10 rounded-full text-[10px] font-bold text-[#ff8c00] uppercase tracking-wider">
{filteredRecords.length} Fichajes
</div>
<div className="flex items-center gap-4 text-xs font-bold text-slate-400">
<div className="flex items-center gap-1"><LogIn className="w-3 h-3 text-green-500" /> {filteredRecords.filter(r => r.type === 'IN').length}</div>
<div className="flex items-center gap-1"><LogOut className="w-3 h-3 text-red-500" /> {filteredRecords.filter(r => r.type === 'OUT').length}</div>
</div>
</div>
</div>
{/* Daily Chart */}
<div className="space-y-4">
<p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Distribución de Horas Diarias</p>
<div className="flex items-end justify-between h-32 gap-1 px-1">
{dailyStats.map((day, i) => (
<div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
<div className="w-full bg-orange-500/5 rounded-t-lg relative h-full flex items-end">
<motion.div 
initial={{ height: 0 }}
animate={{ height: `${(day.hours / maxHours) * 100}%` }}
className="w-full bg-[#ff8c00] rounded-t-lg opacity-80"
></motion.div>
</div>
<span className="text-[8px] font-bold text-slate-600 truncate w-full text-center">{day.date}</span>
</div>
))}
</div>
</div>
</section>
<section className="space-y-3">
<div className="flex items-center justify-between px-1">
<h3 className="font-bold text-slate-300">Listado de Registros</h3>
<span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{filteredRecords.length} RESULTADOS</span>
</div>
<div className="space-y-3">
{filteredRecords.length === 0 ? (
<div className="text-center py-12 bg-slate-900 rounded-3xl border border-slate-800">
<p className="text-slate-500 font-bold italic">No hay registros para este filtro</p>
</div>
) : (
filteredRecords.map(record => (
<div 
key={record.id} 
onClick={() => onSelectRecord(record)}
className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 hover:border-orange-500/20 transition-all cursor-pointer group"
>
<div className="flex items-center gap-4">
<div className={`w-12 h-12 rounded-xl flex items-center justify-center ${record.type === 'IN' ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
{record.type === 'IN' ? <LogIn className="text-green-500 w-6 h-6" /> : <LogOut className="text-[#ff8c00] w-6 h-6" />}
</div>
<div>
<div className="flex items-center gap-2">
<p className="font-bold text-sm text-white">{record.user_name || 'Empleado'}</p>
<span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${record.type === 'IN' ? 'bg-green-500/20 text-green-500' : 'bg-orange-500/20 text-orange-500'}`}>
{record.type === 'IN' ? 'Entrada' : 'Salida'}
</span>
</div>
<p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
{new Date(record.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
</p>
<p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
<MapPin className="w-3 h-3" /> {record.worksite_name}
</p>
</div>
</div>
<ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-orange-500 transition-colors" />
</div>
))
)}
</div>
</section>
</div>
);
};
const ExportView = ({ onBack, records, showToast }: { onBack: () => void, records: Record[], showToast: (msg: string, type: 'success' | 'error') => void }) => {
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [format, setFormat] = useState<'CSV' | 'PDF' | 'JSON'>('PDF');
const filteredRecords = useMemo(() => {
return records.filter(r => {
const date = new Date(r.timestamp).toISOString().split('T')[0];
if (startDate && date < startDate) return false;
if (endDate && date > endDate) return false;
return true;
});
}, [records, startDate, endDate]);
const handleExport = (e: React.MouseEvent) => {
e.preventDefault();
if (filteredRecords.length === 0) {
showToast('No hay registros en el rango seleccionado', 'error');
return;
}
try {
if (format === 'PDF') {
generateFullReportPDF(filteredRecords, { name: 'Informe Consolidado', employee_id: 'ADMIN', department: 'Sistemas', email: 'admin@empresa.com' } as any);
} else if (format === 'CSV') {
const headers = ['Fecha', 'Hora', 'Tipo', 'Usuario', 'Sede', 'Distancia', 'Metodo'];
const csvData = filteredRecords.map(r => [
new Date(r.timestamp).toLocaleDateString(),
new Date(r.timestamp).toLocaleTimeString(),
r.type,
r.user_name || 'N/A',
r.worksite_name,
r.distance,
r.is_manual ? 'Manual' : 'GPS'
]);
const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
const link = document.createElement("a");
const url = URL.createObjectURL(blob);
link.setAttribute("href", url);
link.setAttribute("download", `Export_${new Date().toISOString().split('T')[0]}.csv`);
link.setAttribute("target", "_blank");
link.style.visibility = 'hidden';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
} else if (format === 'JSON') {
const blob = new Blob([JSON.stringify(filteredRecords, null, 2)], { type: 'application/json' });
const link = document.createElement("a");
const url = URL.createObjectURL(blob);
link.setAttribute("href", url);
link.setAttribute("download", `Export_${new Date().toISOString().split('T')[0]}.json`);
link.setAttribute("target", "_blank");
link.style.visibility = 'hidden';
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}
showToast('Exportación iniciada correctamente', 'success');
} catch (err) {
showToast('Error al generar la exportación', 'error');
}
};
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<div className="flex items-center gap-4">
<button type="button" onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Centro de Exportación</h2>
</div>
<div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-6">
<div className="space-y-2">
<label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Rango de Fechas</label>
<div className="grid grid-cols-2 gap-4">
<input 
type="date" 
value={startDate}
onChange={(e) => setStartDate(e.target.value)}
className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-orange-500/20" 
/>
<input 
type="date" 
value={endDate}
onChange={(e) => setEndDate(e.target.value)}
className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-orange-500/20" 
/>
</div>
</div>
<div className="space-y-4">
<label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Formato de Archivo</label>
<div className="grid grid-cols-3 gap-4">
<button 
type="button"
onClick={() => setFormat('CSV')}
className={`p-4 bg-slate-800 border rounded-2xl transition-all text-center ${format === 'CSV' ? 'border-[#ff8c00] bg-orange-500/5' : 'border-slate-700 hover:border-orange-500/50'}`}
>
<p className="font-bold">CSV</p>
<p className="text-[10px] text-slate-500">Excel / Google Sheets</p>
</button>
<button 
type="button"
onClick={() => setFormat('PDF')}
className={`p-4 bg-slate-800 border rounded-2xl transition-all text-center ${format === 'PDF' ? 'border-[#ff8c00] bg-orange-500/5' : 'border-slate-700 hover:border-orange-500/50'}`}
>
<p className="font-bold">PDF</p>
<p className="text-[10px] text-slate-500">Documento de lectura</p>
</button>
<button 
type="button"
onClick={() => setFormat('JSON')}
className={`p-4 bg-slate-800 border rounded-2xl transition-all text-center ${format === 'JSON' ? 'border-[#ff8c00] bg-orange-500/5' : 'border-slate-700 hover:border-orange-500/50'}`}
>
<p className="font-bold">JSON</p>
<p className="text-[10px] text-slate-500">Integración de datos</p>
</button>
</div>
</div>
<button 
type="button"
onClick={handleExport}
className="w-full bg-[#ff8c00] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all"
>
<Download className="w-6 h-6" /> Generar y Descargar Informe ({filteredRecords.length})
</button>
</div>
</div>
);
};
const AdminDashboard = ({ records, users, stats, onViewRequests, onNavigate }: { records: Record[], users: User[], stats: any, onViewRequests: () => void, onNavigate: (tab: string) => void }) => {
const trendsData = useMemo(() => {
const days = [...Array(7)].map((_, i) => {
const d = new Date();
d.setDate(d.getDate() - (6 - i));
return d.toISOString().split('T')[0];
});
return days.map(day => {
const dayRecords = records.filter(r => r.timestamp.startsWith(day));
const ins = dayRecords.filter(r => r.type === 'IN').length;
return { day: day.split('-').slice(1).join('/'), fichajes: ins };
});
}, [records]);
const distributionData = useMemo(() => {
const depts: { [key: string]: number } = {};
users.forEach(u => {
const dept = u.department || 'Sin Dept';
depts[dept] = (depts[dept] || 0) + 1;
});
return Object.entries(depts).map(([name, value]) => ({ name, value }));
}, [users]);
const COLORS = ['#ff8c00', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<section className="space-y-4">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resumen de la Empresa</h3>
<div 
onClick={() => onNavigate('admin-records')}
className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-3xl shadow-xl shadow-orange-500/20 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all"
>
<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
<Clock className="w-32 h-32" />
</div>
<div className="relative z-10">
<div className="flex items-center justify-between mb-8">
<div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
<Clock className="w-6 h-6 text-white" />
</div>
<span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-md uppercase tracking-wider">En Vivo</span>
</div>
<p className="text-5xl font-black text-white mb-1">{stats.activeEmployees}</p>
<p className="text-white/80 font-bold text-sm">Empleados Registrados</p>
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div 
onClick={() => onNavigate('admin-records')}
className="bg-slate-900 p-6 rounded-3xl border border-slate-800 relative overflow-hidden group cursor-pointer hover:border-orange-500/30 transition-all"
>
<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
<BarChart3 className="w-16 h-16" />
</div>
<div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
<BarChart3 className="w-5 h-5 text-[#ff8c00]" />
</div>
<div className="flex items-center justify-between mb-1">
<p className="text-3xl font-black text-white">{stats.totalHoursToday}</p>
<span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">+12%</span>
</div>
<p className="text-slate-500 font-bold text-xs">Total de Horas Hoy</p>
</div>
<div 
onClick={onViewRequests}
className="bg-slate-900 p-6 rounded-3xl border border-slate-800 relative overflow-hidden group cursor-pointer hover:border-orange-500/30 transition-all"
>
<div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
<AlertTriangle className="w-16 h-16" />
</div>
<div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
<AlertTriangle className="w-5 h-5 text-[#ff8c00]" />
</div>
<div className="flex items-center justify-between mb-1">
<p className="text-3xl font-black text-white">{stats.pendingAlerts}</p>
<span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">Acción Requerida</span>
</div>
<p className="text-slate-500 font-bold text-xs">Alertas Pendientes</p>
</div>
</div>
{stats.pendingAlerts > 0 && (
<div 
onClick={onViewRequests}
className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-red-500/20 transition-all"
>
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
<AlertTriangle className="w-5 h-5 text-red-500" />
</div>
<div>
<p className="text-sm font-bold text-white">Prioridad alta: {stats.pendingAlerts} solicitudes pendientes...</p>
<p className="text-xs text-slate-500">Requieren revisión manual para validación de jornada.</p>
</div>
</div>
<button className="text-red-500 font-bold text-xs uppercase tracking-widest group-hover:underline">Ver</button>
</div>
)}
</section>
<section className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Tendencias de Asistencia</h3>
<div className="h-48 w-full">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={trendsData}>
<CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
<XAxis dataKey="day" stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
<YAxis stroke="#94a3b8" fontSize={8} tickLine={false} axisLine={false} />
<Tooltip 
contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
itemStyle={{ color: '#ff8c00' }}
/>
<Bar dataKey="fichajes" fill="#ff8c00" radius={[2, 2, 0, 0]} />
</BarChart>
</ResponsiveContainer>
</div>
</div>
<div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Distribución por Dpto</h3>
<div className="h-48 w-full">
<ResponsiveContainer width="100%" height="100%">
<PieChart>
<Pie
data={distributionData}
cx="50%"
cy="50%"
innerRadius={40}
outerRadius={60}
paddingAngle={5}
dataKey="value"
>
{distributionData.map((entry, index) => (
<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
))}
</Pie>
<Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
</PieChart>
</ResponsiveContainer>
</div>
</div>
</section>
<section className="space-y-4">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Acceso Rápido</h3>
<div className="space-y-3">
{[
{ icon: Users, label: 'Gestión de Usuarios', sub: 'Gestionar perfiles, permisos y roles', action: 'admin-users' },
{ icon: BarChart3, label: 'Informes', sub: 'Análisis, tendencias y mapas de calor', action: 'admin-reports' },
{ icon: Download, label: 'Centro de Exportación', sub: 'Descargar registros CSV/PDF para nómina', action: 'admin-export' }
].map(item => (
<button 
key={item.label} 
type="button"
onClick={() => onNavigate(item.action)}
className="w-full flex items-center justify-between p-5 bg-slate-900 rounded-3xl border border-slate-800 hover:border-orange-500/20 transition-all group"
>
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
<item.icon className="w-6 h-6 text-slate-400 group-hover:text-[#ff8c00]" />
</div>
<div className="text-left">
<p className="font-bold text-sm">{item.label}</p>
<p className="text-xs text-slate-500">{item.sub}</p>
</div>
</div>
<ChevronRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-all" />
</button>
))}
</div>
</section>
<div className="fixed bottom-24 right-6">
<button 
onClick={() => onNavigate('admin-users')}
className="w-16 h-16 rounded-full bg-[#ff8c00] shadow-xl shadow-orange-500/30 flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all"
>
<UserPlus className="w-8 h-8" />
</button>
</div>
</div>
);
};
const UserModal = ({ user, onSave, onClose }: { user?: User, onSave: (u: any) => Promise<void>, onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: user?.password || '123456',
    employee_id: user?.employee_id || '',
    department: user?.department || '',
    role: (user?.role || 'USER') as 'USER' | 'ADMIN',
    // Nuevos campos de horario
    horario_manana_inicio: user?.horario_manana_inicio || '08:00',
    horario_manana_fin: user?.horario_manana_fin || '14:00',
    horario_tarde_inicio: user?.horario_tarde_inicio || '15:00',
    horario_tarde_fin: user?.horario_tarde_fin || '18:00',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-3xl p-8 space-y-6 overflow-y-auto max-h-[90vh]">
        <h3 className="text-2xl font-bold text-white">{user ? 'Editar' : 'Añadir'} Empleado</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 text-white outline-none" placeholder="Nombre completo" />
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 text-white outline-none" placeholder="Email" />
            <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 text-white outline-none" placeholder="Contraseña" />
            
            <div className="grid grid-cols-2 gap-3">
               <input type="text" value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-white outline-none" placeholder="ID Empleado" />
               <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-white outline-none">
                <option value="USER">Usuario</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <p className="text-[10px] font-bold text-orange-500 uppercase mb-3">Horario Laboral (Cálculo Extras)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Mañana</label>
                <div className="flex gap-2">
                  <input type="time" value={formData.horario_manana_inicio} onChange={e => setFormData({...formData, horario_manana_inicio: e.target.value})} className="bg-slate-900 p-2 text-xs rounded-lg border border-slate-800 text-white w-full" />
                  <input type="time" value={formData.horario_manana_fin} onChange={e => setFormData({...formData, horario_manana_fin: e.target.value})} className="bg-slate-900 p-2 text-xs rounded-lg border border-slate-800 text-white w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Tarde</label>
                <div className="flex gap-2">
                  <input type="time" value={formData.horario_tarde_inicio} onChange={e => setFormData({...formData, horario_tarde_inicio: e.target.value})} className="bg-slate-900 p-2 text-xs rounded-lg border border-slate-800 text-white w-full" />
                  <input type="time" value={formData.horario_tarde_fin} onChange={e => setFormData({...formData, horario_tarde_fin: e.target.value})} className="bg-slate-900 p-2 text-xs rounded-lg border border-slate-800 text-white w-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold transition-colors">GUARDAR</button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-bold transition-colors">CANCELAR</button>
          </div>
        </form>
      </div>
    </div>
  );
};
// Auto-generate employee ID for new users
useEffect(() => {
if (!user) {
const prefix = formData.role === 'ADMIN' ? 'ADM' : 'EMP';
const roleUsers = existingUsers.filter(u => u.role === formData.role);
let nextNum = 1;
if (roleUsers.length > 0) {
const ids = roleUsers.map(u => {
const match = u.employee_id?.match(/\d+$/);
return match ? parseInt(match[0], 10) : 0;
});
nextNum = Math.max(...ids) + 1;
}
const id = `${prefix}-${String(nextNum).padStart(3, '0')}`;
if (formData.employee_id !== id) {
setFormData(prev => ({ ...prev, employee_id: id }));
}
}
}, [formData.role, user, existingUsers, formData.employee_id]);
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
await onSave(formData);
setLoading(false);
onClose();
};
return (
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
<motion.div 
initial={{ opacity: 0, scale: 0.9 }}
animate={{ opacity: 1, scale: 1 }}
className="bg-slate-950 border border-slate-800 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl"
>
<div className="p-8 space-y-6">
<div className="flex items-center justify-between">
<h3 className="text-2xl font-bold">{user ? 'Editar Usuario' : 'Añadir Usuario'}</h3>
<button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full transition-colors">
<X className="w-6 h-6 text-slate-500" />
</button>
</div>
<form onSubmit={handleSubmit} className="space-y-4">
<div className="grid grid-cols-2 gap-4">
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
<input 
type="text" 
required
value={formData.name}
onChange={e => setFormData({...formData, name: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
<input 
type="email" 
required
value={formData.email}
onChange={e => setFormData({...formData, email: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
</div>
{/* --- CAMPO DE CONTRASEÑA --- */}
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
<input 
type="text"
required
value={formData.password}
onChange={e => setFormData({...formData, password: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
placeholder="Introduce la contraseña"
/>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">ID Empleado {!user && '(Automático)'}</label>
<input 
type="text" 
required
readOnly={!user}
value={formData.employee_id}
onChange={e => setFormData({...formData, employee_id: e.target.value})}
className={`w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20 ${!user ? 'opacity-70 cursor-not-allowed' : ''}`}
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Departamento</label>
<input 
type="text" 
required
value={formData.department}
onChange={e => setFormData({...formData, department: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Cargo / Posición</label>
<input 
type="text" 
required
value={formData.position}
onChange={e => setFormData({...formData, position: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rol</label>
<select 
value={formData.role}
onChange={e => setFormData({...formData, role: e.target.value as 'USER' | 'ADMIN'})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
>
<option value="USER">Usuario Estándar</option>
<option value="ADMIN">Administrador</option>
</select>
</div>
</div>
<div className="pt-4">
<button 
type="submit" 
disabled={loading}
className="w-full bg-[#ff8c00] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
>
{loading ? 'Guardando...' : user ? 'Guardar Cambios' : 'Crear Usuario'}
</button>
</div>
</form>
</div>
</motion.div>
</div>
);
};
const UserManagementView = ({ users, onUpdateStatus, onAdd, onUpdate, onDelete, onBack }: { users: User[], onUpdateStatus: (id: number, status: string) => void, onAdd: (user: any) => Promise<void>, onUpdate: (id: number, user: any) => Promise<void>, onDelete: (id: number) => Promise<void>, onBack: () => void }) => {
const [search, setSearch] = useState('');
const [showModal, setShowModal] = useState(false);
const [editingUser, setEditingUser] = useState<User | undefined>();
const filtered = users.filter(u => 
(u.name?.toLowerCase() || '').includes(search.toLowerCase()) || 
(u.department?.toLowerCase() || '').includes(search.toLowerCase())
);
const handleEdit = (u: User) => {
setEditingUser(u);
setShowModal(true);
};
const handleAdd = () => {
setEditingUser(undefined);
setShowModal(true);
};
const handleSave = async (data: any) => {
if (editingUser) {
await onUpdate(editingUser.id, data);
} else {
await onAdd(data);
}
};
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<header className="flex items-center justify-between">
<div className="flex items-center gap-3">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
<Users className="w-6 h-6 text-[#ff8c00]" />
</div>
<h2 className="text-2xl font-bold">Usuarios</h2>
</div>
<button 
onClick={handleAdd}
className="bg-[#ff8c00] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2"
>
<Plus className="w-4 h-4" /> Añadir
</button>
</header>
{showModal && <UserModal user={editingUser} onSave={handleSave} onClose={() => setShowModal(false)} existingUsers={users} />}
<div className="flex gap-2">
<div className="flex-1 relative">
<Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
<input 
type="text" 
placeholder="Buscar por nombre o departamento..."
value={search}
onChange={(e) => setSearch(e.target.value)}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500/20 outline-none"
/>
</div>
<button className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
<Filter className="w-6 h-6" />
</button>
</div>
<div className="space-y-3">
{filtered.length === 0 ? (
<div className="text-center py-12 bg-slate-900 rounded-3xl border border-slate-800">
<p className="text-slate-500 font-bold italic">No se encontraron usuarios</p>
</div>
) : (
filtered.map(u => (
<div key={u.id} className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex items-center justify-between group hover:border-orange-500/20 transition-all">
<div className="flex items-center gap-4">
<div className="relative">
<div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden">
<img src={`https://picsum.photos/seed/${u.id}/200`} alt={u.name} className="w-full h-full object-cover" />
</div>
<div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${u.status === 'ACTIVE' ? 'bg-green-500' : u.status === 'OFF' ? 'bg-orange-500' : 'bg-slate-500'}`}></div>
</div>
<div>
<p className="font-bold text-sm">{u.name}</p>
<p className="text-xs text-slate-500">{u.department}</p>
</div>
</div>
<div className="flex items-center gap-3">
<button 
onClick={() => onUpdateStatus(u.id, u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : u.status === 'OFF' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-500/10 text-slate-500'}`}
>
{u.status === 'ACTIVE' ? 'Activo' : u.status === 'OFF' ? 'De Baja' : 'Inactivo'}
</button>
<div className="flex gap-1">
<button onClick={() => handleEdit(u)} className="p-2 text-slate-500 hover:text-white transition-colors">
<Edit3 className="w-4 h-4" />
</button>
<button onClick={() => onDelete(u.id)} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
<Trash className="w-4 h-4" />
</button>
</div>
</div>
</div>
))
)}
</div>
</div>
);
};
const WorksiteModal = ({ worksite, onSave, onClose }: { worksite?: Worksite, onSave: (w: any) => Promise<void>, onClose: () => void }) => {
const [formData, setFormData] = useState({
name: worksite?.name || '',
address: worksite?.address || '',
latitude: worksite?.latitude || 40.4168,
longitude: worksite?.longitude || -3.7038,
radius: worksite?.radius || 100
});
const [loading, setLoading] = useState(false);
const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setLoading(true);
await onSave(formData);
setLoading(false);
onClose();
};
return (
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
<motion.div 
initial={{ opacity: 0, scale: 0.9 }}
animate={{ opacity: 1, scale: 1 }}
className="bg-slate-950 border border-slate-800 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl"
>
<div className="p-8 space-y-6">
<div className="flex items-center justify-between">
<h3 className="text-2xl font-bold">{worksite ? 'Editar Sede' : 'Nueva Sede'}</h3>
<button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full transition-colors">
<X className="w-6 h-6 text-slate-500" />
</button>
</div>
<form onSubmit={handleSubmit} className="space-y-4">
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Sede</label>
<input 
type="text" 
required
value={formData.name}
onChange={e => setFormData({...formData, name: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
placeholder="Ej: Oficina Central Madrid"
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Dirección</label>
<input 
type="text" 
required
value={formData.address}
onChange={e => setFormData({...formData, address: e.target.value})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
placeholder="Calle, Número, Ciudad"
/>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Latitud</label>
<input 
type="number" 
step="any"
required
value={formData.latitude}
onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Longitud</label>
<input 
type="number" 
step="any"
required
value={formData.longitude}
onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})}
className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 px-4 text-white outline-none focus:ring-2 focus:ring-orange-500/20"
/>
</div>
</div>
<div className="space-y-1">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Radio de Geocerca (metros)</label>
<div className="flex items-center gap-4">
<input 
type="range" 
min="1"
max="1000"
step="1"
value={formData.radius}
onChange={e => {
const val = parseInt(e.target.value);
let finalVal = val;
if (val > 10) {
finalVal = Math.round(val / 10) * 10;
}
setFormData({...formData, radius: finalVal});
}}
className="flex-1 accent-orange-500"
/>
<span className="w-16 text-right font-bold text-orange-500">{formData.radius}m</span>
</div>
</div>
<div className="pt-4">
<button 
type="submit" 
disabled={loading}
className="w-full bg-[#ff8c00] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
>
{loading ? 'Guardando...' : (worksite ? 'Actualizar Sede' : 'Crear Sede')}
</button>
</div>
</form>
</div>
</motion.div>
</div>
);
};
const WorksiteManagementView = ({ worksites, onAdd, onUpdate, onDelete, onBack }: { worksites: Worksite[], onAdd: (w: any) => Promise<void>, onUpdate: (id: number, w: any) => Promise<void>, onDelete: (id: number) => Promise<void>, onBack: () => void }) => {
const [showModal, setShowModal] = useState(false);
const [editingWorksite, setEditingWorksite] = useState<Worksite | undefined>();
const handleEdit = (w: Worksite) => {
setEditingWorksite(w);
setShowModal(true);
};
const handleAdd = () => {
setEditingWorksite(undefined);
setShowModal(true);
};
const handleSave = async (data: any) => {
if (editingWorksite) {
await onUpdate(editingWorksite.id, data);
} else {
await onAdd(data);
}
};
return (
<div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
<header className="flex items-center justify-between">
<div className="flex items-center gap-3">
<button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
<ArrowLeft className="w-6 h-6" />
</button>
<h2 className="text-2xl font-bold">Gestión de Sedes</h2>
</div>
<button onClick={handleAdd} className="bg-[#ff8c00] text-white p-2 rounded-xl shadow-lg">
<Plus className="w-6 h-6" />
</button>
</header>
{showModal && <WorksiteModal worksite={editingWorksite} onSave={handleSave} onClose={() => setShowModal(false)} />}
<div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
<div className="h-48 bg-slate-800 relative">
<div className="absolute inset-0 flex items-center justify-center">
<div className="relative">
<div className="w-32 h-32 rounded-full bg-orange-500/20 border-2 border-orange-500 animate-pulse"></div>
<MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-[#ff8c00]" />
</div>
</div>
<div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800 flex items-center gap-2">
<div className="w-2 h-2 rounded-full bg-green-500"></div>
<span className="text-[10px] font-bold uppercase text-white">Vista en Vivo</span>
</div>
</div>
<div className="p-6 flex items-center justify-between">
<div>
<p className="text-xs text-slate-500 font-bold uppercase mb-1">Sede Seleccionada</p>
<p className="text-lg font-bold">Oficina Central Madrid</p>
</div>
<button className="bg-orange-500/10 text-[#ff8c00] px-4 py-2 rounded-xl font-bold text-sm">Actualizar</button>
</div>
</div>
<div className="space-y-4">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sedes Configuradas ({worksites.length})</h3>
{worksites.map(w => (
<div key={w.id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-4">
<div className="flex items-center justify-between">
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
<Building2 className="w-6 h-6 text-slate-400" />
</div>
<div>
<p className="font-bold">{w.name}</p>
<p className="text-xs text-slate-500">{w.address}</p>
</div>
</div>
<div className="flex gap-2">
<button onClick={() => handleEdit(w)} className="p-2 text-slate-500 hover:text-white"><Edit3 className="w-5 h-5" /></button>
<button onClick={() => onDelete(w.id)} className="p-2 text-slate-500 hover:text-red-500"><Trash className="w-5 h-5" /></button>
</div>
</div>
<div className="flex gap-3">
<span className="px-3 py-1 bg-orange-500/10 text-[#ff8c00] rounded-full text-[10px] font-bold flex items-center gap-1">
<div className="w-2 h-2 rounded-full bg-[#ff8c00]"></div> Radio: {w.radius}m
</span>
<span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-bold flex items-center gap-1">
<Check className="w-3 h-3" /> Activa
</span>
</div>
</div>
))}
</div>
</div>
);
};
// --- Main App ---
export default function App() {
const [user, setUser] = useState<User | null>(null);
const [activeTab, setActiveTab] = useState<string>('home');
const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
const showToast = (message: string, type: 'success' | 'error') => {
setToast({ message, type });
};
const [isClockedIn, setIsClockedIn] = useState(false);
const [profileView, setProfileView] = useState<'main' | 'edit' | 'password' | 'notifications'>('main');
const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
const [startTime, setStartTime] = useState<Date | null>(null);
const [userRecords, setUserRecords] = useState<Record[]>([]);
const [allRecords, setAllRecords] = useState<Record[]>([]);
const [adminStats, setAdminStats] = useState<any>(null);
const [adminUsers, setAdminUsers] = useState<User[]>([]);
const [adminWorksites, setAdminWorksites] = useState<Worksite[]>([]);
const { location } = useGeolocation();
useEffect(() => {
if (user) {
// Always fetch current user's records and status
fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
fetch(`/api/status/${user.id}`)
.then(res => res.json())
.then(status => {
if (status.isClockedIn) {
setIsClockedIn(true);
setStartTime(new Date(status.startTime));
} else {
setIsClockedIn(false);
setStartTime(null);
}
});
if (user.role === 'ADMIN') {
// Only set default tab if we're not already in an admin tab
if (!activeTab.startsWith('admin-')) {
setActiveTab('admin-dashboard');
}
fetchAdminData();
}
}
}, [user]);
const fetchAdminData = async () => {
const [stats, users, worksites, records] = await Promise.all([
fetch('/api/admin/stats').then(res => res.json()),
fetch('/api/admin/users').then(res => res.json()),
fetch('/api/admin/worksites').then(res => res.json()),
fetch('/api/admin/records').then(res => res.json())
]);
setAdminStats(stats);
setAdminUsers(users);
setAdminWorksites(worksites);
setAllRecords(records);
};
const handleAddUser = async (userData: any) => {
const res = await fetch('/api/admin/users', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(userData)
});
if (res.ok) {
fetchAdminData();
}
};
const handleAddWorksite = async (worksiteData: any) => {
const res = await fetch('/api/admin/worksites', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(worksiteData)
});
if (res.ok) {
fetchAdminData();
}
};
const handleUpdateWorksite = async (id: number, worksiteData: any) => {
const res = await fetch(`/api/admin/worksites/${id}`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(worksiteData)
});
if (res.ok) {
fetchAdminData();
}
};
const handleDeleteWorksite = async (id: number) => {
const res = await fetch(`/api/admin/worksites/${id}`, {
method: 'DELETE'
});
if (res.ok) {
fetchAdminData();
}
};
const handleUpdateUser = async (id: number, userData: any) => {
const res = await fetch(`/api/admin/users/${id}`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(userData)
});
if (res.ok) {
fetchAdminData();
}
};
const handleDeleteUser = async (id: number) => {
if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) return;
const res = await fetch(`/api/admin/users/${id}`, {
method: 'DELETE'
});
if (res.ok) {
fetchAdminData();
}
};
const handleUpdateUserStatus = async (id: number, status: string) => {
const res = await fetch('/api/admin/users/status', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ id, status })
});
if (res.ok) {
fetchAdminData();
}
};
const handleClockIn = async (worksiteId: number) => {
if (!user || !location) return;
// In a real app we'd fetch the worksite to get its lat/lng
const worksites = await fetch('/api/worksites').then(res => res.json());
const site = worksites.find((w: any) => w.id === worksiteId);
const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
const res = await fetch('/api/clock', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
user_id: user.id,
worksite_id: worksiteId,
type: 'IN',
latitude: location.latitude,
longitude: location.longitude,
distance: dist,
notes: ''
})
});
if (res.ok) {
setIsClockedIn(true);
setStartTime(new Date());
// Refresh records
fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
if (user.role === 'ADMIN') fetchAdminData();
}
};
const handleClockOut = async (notes: string) => {
    if (!user || !location) return;
    const lastRecord = userRecords[0];
    const worksites = await fetch('/api/worksites').then(res => res.json());
    const site = worksites.find((w: any) => w.id === lastRecord.worksite_id);
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    
    // --- LÓGICA DE HORAS EXTRA ---
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Miramos qué salida le toca (si es antes de las 14:30 suele ser turno de mañana)
    const esManana = now.getHours() < 14 || (now.getHours() === 14 && now.getMinutes() < 30);
    const horaSalidaPrevista = esManana ? (user.horario_manana_fin || "14:00") : (user.horario_tarde_fin || "18:00");
    
    const [hP, mP] = horaSalidaPrevista.split(':').map(Number);
    const previstoMs = (hP * 60 + mP) * 60000;
    const actualMs = (now.getHours() * 60 + now.getMinutes()) * 60000;
    
    let minutosExtra = 0;
    let estadoExtra = 'N/A';
    
    // Si ha salido al menos 5 minutos tarde, lo contamos como extra
    if (actualMs > previstoMs + 300000) {
      minutosExtra = Math.floor((actualMs - previstoMs) / 60000);
      estadoExtra = 'PENDIENTE';
    }
    // ----------------------------

    const res = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_id: user.id, 
        worksite_id: lastRecord.worksite_id, 
        type: 'OUT', 
        latitude: location.latitude, 
        longitude: location.longitude, 
        distance: dist, 
        notes,
        minutos_extra: minutosExtra,
        estado_extra: estadoExtra
      })
    });

    if (res.ok) { 
      setIsClockedIn(false); 
      setStartTime(null); 
      fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); 
      if (user.role === 'ADMIN') fetchAdminData(); 
    }
  };
});
if (res.ok) {
setIsClockedIn(false);
setStartTime(null);
// Refresh records
fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
if (user.role === 'ADMIN') fetchAdminData();
}
};
if (!user) return <Login onLogin={setUser} />;
return (
<div className="min-h-screen bg-slate-950 text-white flex flex-col font-['Quicksand']">
<header className="flex items-center justify-between p-4 bg-slate-900/50 border-b border-orange-500/10">
<div className="flex items-center gap-2">
<Clock className="text-[#ff8c00] w-6 h-6" />
<h2 className="text-lg font-bold tracking-tight">GeoClock</h2>
</div>
<div className="flex items-center gap-2">
<button className="p-2 rounded-full hover:bg-orange-500/5">
<Bell className="text-slate-500 w-6 h-6" />
</button>
<button 
onClick={() => setUser(null)}
className="p-2 rounded-full hover:bg-red-500/10 text-red-500 transition-colors"
title="Cerrar Sesión"
>
<LogOut className="w-6 h-6" />
</button>
</div>
</header>
<main className="flex-1 flex flex-col overflow-y-auto">
<AnimatePresence mode="wait">
{selectedRecord ? (
<motion.div 
key="detail"
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.95 }}
className="flex-1 flex flex-col"
>
<RecordDetailView record={selectedRecord} user={user!} onBack={() => setSelectedRecord(null)} />
</motion.div>
) : (
<motion.div 
key={activeTab}
initial={{ opacity: 0, x: 20 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -20 }}
className="flex-1 flex flex-col"
>
{user?.role === 'ADMIN' ? (
<>
{activeTab === 'admin-dashboard' && <AdminDashboard records={allRecords} users={adminUsers} stats={adminStats || { activeEmployees: 0, totalHoursToday: 0, pendingAlerts: 0 }} onViewRequests={() => setActiveTab('admin-requests')} onNavigate={setActiveTab} />}
{activeTab === 'admin-records' && <AdminRecordsListView records={allRecords} users={adminUsers} onSelectRecord={setSelectedRecord} onBack={() => setActiveTab('admin-dashboard')} />}
{activeTab === 'admin-users' && <UserManagementView users={adminUsers} onUpdateStatus={handleUpdateUserStatus} onAdd={handleAddUser} onUpdate={handleUpdateUser} onDelete={handleDeleteUser} onBack={() => setActiveTab('admin-dashboard')} />}
{activeTab === 'admin-worksites' && <WorksiteManagementView worksites={adminWorksites} onAdd={handleAddWorksite} onUpdate={handleUpdateWorksite} onDelete={handleDeleteWorksite} onBack={() => setActiveTab('admin-dashboard')} />}
{activeTab === 'admin-requests' && <PendingRequestsView onBack={() => setActiveTab('admin-dashboard')} onActionComplete={fetchAdminData} onSelectRecord={setSelectedRecord} />}
{activeTab === 'admin-reports' && <ReportsView records={allRecords} users={adminUsers} onBack={() => setActiveTab('admin-dashboard')} />}
{activeTab === 'admin-export' && <ExportView records={allRecords} showToast={showToast} onBack={() => setActiveTab('admin-dashboard')} />}
{activeTab === 'admin-clockin' && (
isClockedIn ? (
<ActiveSession 
user={user} 
startTime={startTime!} 
onFinish={handleClockOut} 
onDiscard={async () => {
if (user) {
const res = await fetch(`/api/records/discard/${user.id}`, { method: 'POST' });
if (res.ok) {
setIsClockedIn(false);
setStartTime(null);
// Refresh records
fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
}
}
}}
/>
) : (
<Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />
)
)}
{activeTab === 'profile' && (
<div className="p-8 space-y-8">
<div className="flex flex-col items-center space-y-4">
<div className="relative">
<div className="w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-900 shadow-xl overflow-hidden">
<img src={`https://picsum.photos/seed/${user.id}/200`} alt="Profile" className="w-full h-full object-cover" />
</div>
</div>
<div className="text-center">
<h2 className="text-2xl font-bold">{user.name}</h2>
<p className="text-[#ff8c00] font-medium">Administrador</p>
</div>
</div>
<div className="pt-8">
<button onClick={() => setUser(null)} className="w-full flex items-center gap-4 p-4 bg-red-500/5 rounded-xl border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all">
<div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
<LogOut className="w-5 h-5" />
</div>
<span className="font-bold">Cerrar Sesión</span>
</button>
</div>
</div>
)}
</>
) : (
<>
{activeTab === 'home' && (
isClockedIn ? (
<ActiveSession 
user={user} 
startTime={startTime!} 
onFinish={handleClockOut} 
onDiscard={async () => {
if (user) {
const res = await fetch(`/api/records/discard/${user.id}`, { method: 'POST' });
if (res.ok) {
setIsClockedIn(false);
setStartTime(null);
// Refresh records
fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
}
}
}}
/>
) : (
<Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />
)
)}
{activeTab === 'history' && <HistoryView records={userRecords} user={user!} onSelectRecord={setSelectedRecord} />}
{activeTab === 'summary' && <WeeklySummaryView records={userRecords} user={user!} showToast={showToast} onSelectRecord={setSelectedRecord} />}
{activeTab === 'profile' && (
profileView === 'edit' ? (
<EditProfileView 
user={user} 
onBack={() => setProfileView('main')} 
onSave={(updated) => {
setUser(updated);
setProfileView('main');
}} 
/>
) : profileView === 'password' ? (
<ChangePasswordView 
user={user} 
onBack={() => setProfileView('main')} 
/>
) : profileView === 'notifications' ? (
<NotificationsView 
onBack={() => setProfileView('main')} 
/>
) : (
<div className="p-8 space-y-8">
<div className="flex flex-col items-center space-y-4">
<div className="relative">
<div className="w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-900 shadow-xl overflow-hidden">
<img src={`https://picsum.photos/seed/${user.id}/200`} alt="Profile" className="w-full h-full object-cover" />
</div>
<div className="absolute bottom-0 right-0 w-8 h-8 bg-[#ff8c00] rounded-full flex items-center justify-center border-2 border-slate-900 cursor-pointer" onClick={() => setProfileView('edit')}>
<Edit3 className="w-4 h-4 text-white" />
</div>
</div>
<div className="text-center">
<h2 className="text-2xl font-bold">{user.name}</h2>
<p className="text-[#ff8c00] font-medium">{user.department}</p>
<span className="inline-block mt-2 px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-500">ID: {user.employee_id}</span>
</div>
</div>
<div className="space-y-4">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ajustes de Cuenta</h3>
{[
{ icon: UserIcon, label: 'Editar Perfil', sub: 'Detalles personales y preferencias', action: () => setProfileView('edit') },
{ icon: Lock, label: 'Cambiar Contraseña', sub: 'Seguridad y credenciales', action: () => setProfileView('password') },
{ icon: Bell, label: 'Notificaciones', sub: 'Alertas push, email y de sistema', action: () => setProfileView('notifications') }
].map(item => (
<button key={item.label} onClick={item.action} className="w-full flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-orange-500/20 transition-all group">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
<item.icon className="w-5 h-5 text-slate-400 group-hover:text-[#ff8c00]" />
</div>
<div className="text-left">
<p className="font-bold text-sm">{item.label}</p>
<p className="text-xs text-slate-500">{item.sub}</p>
</div>
</div>
<ChevronRight className="w-5 h-5 text-slate-600" />
</button>
))}
</div>
<div className="pt-8">
<button onClick={() => setUser(null)} className="w-full flex items-center gap-4 p-4 bg-red-500/5 rounded-xl border border-red-500/10 text-red-400 hover:bg-red-500/10 transition-all">
<div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
<LogOut className="w-5 h-5" />
</div>
<span className="font-bold">Cerrar Sesión</span>
</button>
</div>
</div>
)
)}
</>
)}
</motion.div>
)}
</AnimatePresence>
</main>
{!selectedRecord && (
<nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-6 pb-6 pt-3 flex justify-between items-center z-50">
{user?.role === 'ADMIN' ? (
<>
{[
{ id: 'admin-dashboard', icon: LayoutDashboard, label: 'Panel' },
{ id: 'admin-records', icon: FileText, label: 'Registros' },
{ id: 'admin-clockin', icon: Fingerprint, label: 'Fichar' },
{ id: 'admin-users', icon: Users, label: 'Usuarios' },
{ id: 'admin-worksites', icon: Building2, label: 'Sedes' },
{ id: 'profile', icon: Settings2, label: 'Ajustes' }
].map(tab => (
<button 
key={tab.id}
onClick={() => { setActiveTab(tab.id); setProfileView('main'); }}
className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-[#ff8c00] scale-110' : 'text-slate-600 hover:text-slate-400'}`}
>
<tab.icon className="w-6 h-6" />
<span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
</button>
))}
</>
) : (
<>
<button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-[#ff8c00]' : 'text-slate-500'}`}>
<Home className={`w-6 h-6 ${activeTab === 'home' ? 'fill-current' : ''}`} />
<span className="text-[10px] font-bold uppercase">Inicio</span>
</button>
<button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-[#ff8c00]' : 'text-slate-500'}`}>
<FileText className={`w-6 h-6 ${activeTab === 'history' ? 'fill-current' : ''}`} />
<span className="text-[10px] font-bold uppercase">Registros</span>
</button>
<button onClick={() => setActiveTab('summary')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'summary' ? 'text-[#ff8c00]' : 'text-slate-500'}`}>
<BarChart3 className={`w-6 h-6 ${activeTab === 'summary' ? 'fill-current' : ''}`} />
<span className="text-[10px] font-bold uppercase">Resumen</span>
</button>
<button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-[#ff8c00]' : 'text-slate-500'}`}>
<UserIcon className={`w-6 h-6 ${activeTab === 'profile' ? 'fill-current' : ''}`} />
<span className="text-[10px] font-bold uppercase">Perfil</span>
</button>
</>
)}
</nav>
)}
<AnimatePresence>
{toast && (
<Toast 
message={toast.message} 
type={toast.type} 
onClose={() => setToast(null)} 
/>
)}
</AnimatePresence>
</div>
);
}
