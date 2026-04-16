import React, { useState, useEffect, useMemo } from 'react';
import { User, Worksite, Record, useGeolocation, calculateDistance } from './types';
import { 
  LogIn, 
  LogOut, 
  Clock, 
  History, 
  User as UserIcon, 
  MapPin, 
  ChevronRight, 
  ArrowLeft, 
  MoreVertical, 
  Edit3, 
  PauseCircle, 
  PlayCircle, 
  Trash2, 
  TimerOff,
  TrendingUp,
  Coffee,
  Verified,
  Share2,
  Printer,
  Calendar,
  ChevronLeft,
  BarChart3,
  Home,
  FileText,
  Settings,
  Fingerprint,
  Bell,
  Mail,
  Lock,
  Eye,
  Check,
  X,
  Shield,
  Users,
  Map,
  Settings2,
  Download,
  AlertTriangle,
  LayoutDashboard,
  UserPlus,
  Building2,
  Search,
  Filter,
  Plus,
  Trash,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';

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
    const sortedRecords = [...userData.records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Guardamos los totales diarios en Milisegundos para no perder precisión
    const dailyTotals: { [key: string]: number } = {};
    const recordsByDate: { [key: string]: Record[] } = {};

    sortedRecords.forEach(r => {
      const dateStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      if (!recordsByDate[dateStr]) recordsByDate[dateStr] = [];
      recordsByDate[dateStr].push(r);
    });

    let totalUserMs = 0;
    Object.entries(recordsByDate).forEach(([dateStr, dayRecords]) => {
      let totalMs = 0;
      const sorted = [...dayRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].type === 'IN' && sorted[i+1]?.type === 'OUT') {
          const diff = new Date(sorted[i+1].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
          totalMs += diff;
          totalUserMs += diff;
          i++;
        }
      }
      dailyTotals[dateStr] = totalMs; // Milisegundos exactos
    });

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
      const dayTotalMs = dailyTotals[dateStr];
      
      // Transformamos a Horas y Minutos reales
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
    
    // Total final del empleado en Horas y Minutos
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
            {mode === 'USER' ? '¿Eres administrador? Acceder al Panel' : '¿No eres administrador? Volver al Inicio'}
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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
          <p className="text-2xl font-black text-white">{stats.todayStr}</p>
          <div className="flex items-center gap-1 text-green-400 text-[10px] font-bold mt-1">
            <TrendingUp className="w-3 h-3" /> Turno actual
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl border border-orange-500/5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Puntualidad</p>
          <p className="text-2xl font-black text-white">100%</p>
          <div className="flex items-center gap-1 text-[#ff8c00] text-[10px] font-bold mt-1">
            <Check className="w-3 h-3" /> Excelente
          </div>
        </div>
      </section>

      <section className="bg-slate-900 rounded-xl p-5 border border-orange-500/5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-300">Esta semana</h3>
          <span className="text-[#ff8c00] font-bold text-lg">{stats.weekStr}</span>
        </div>
        <div className="w-full bg-orange-500/10 rounded-full h-2.5 mb-2">
          <div className="bg-[#ff8c00] h-2.5 rounded-full" style={{ width: `${stats.weekPct}%` }}></div>
        </div>
        <p className="text-xs text-slate-500">Objetivo: 40h 0m</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-slate-300">Actividad reciente</h3>
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

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date().getTime() - startTime.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed({ h, m, s });
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 font-['Quicksand']">
      <div className="flex justify-center mb-8">
        <div className="bg-orange-500/10 text-[#ff8c00] border border-orange-500/20 px-4 py-1.5 rounded-full flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8c00] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff8c00]"></span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider">TRABAJANDO ACTUALMENTE</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <div className="flex justify-center items-baseline gap-2">
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold tabular-nums text-white">{elapsed.h.toString().padStart(2, '0')}</span>
            <span className="text-[10px] font-bold text-slate-500 mt-1">HORAS</span>
          </div>
          <span className="text-5xl font-light text-slate-700 mb-6">:</span>
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold tabular-nums text-white">{elapsed.m.toString().padStart(2, '0')}</span>
            <span className="text-[10px] font-bold text-slate-500 mt-1">MINUTOS</span>
          </div>
          <span className="text-5xl font-light text-slate-700 mb-6">:</span>
          <div className="flex flex-col items-center">
            <span className="text-6xl font-bold tabular-nums text-white">{elapsed.s.toString().padStart(2, '0')}</span>
            <span className="text-[10px] font-bold text-slate-500 mt-1">SEGUNDOS</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-bold text-slate-300">¿Qué estás haciendo hoy?</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full min-h-[120px] p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:border-[#ff8c00] transition-all resize-none" 
          placeholder="Añade notas de tu turno..."
        />
      </div>

      <div className="mt-12">
        <button 
          onClick={() => onFinish(notes)}
          className="w-full h-14 bg-[#ff8c00] hover:bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-3"
        >
          <TimerOff className="w-6 h-6" />
          Finalizar Turno
        </button>
      </div>
    </div>
  );
};

const HistoryView = ({ records, user, onSelectRecord }: { records: Record[], user: User, onSelectRecord: (record: Record) => void }) => {
  return (
    <div className="flex-1 px-4 py-6 space-y-4 pb-24 font-['Quicksand']">
      <h2 className="text-xl font-bold px-1">Historial de Registros</h2>
      <div className="space-y-4">
        {records.map(record => (
          <div 
            key={record.id} 
            onClick={() => onSelectRecord(record)}
            className={`bg-slate-800 rounded-xl border-l-4 p-4 flex items-center justify-between cursor-pointer border border-slate-700/50 hover:border-orange-500/30 transition-all ${record.type === 'IN' ? 'border-l-green-500' : 'border-l-red-500'}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center bg-slate-900/50 rounded-lg w-14 h-14">
                <span className="text-xl font-black text-white">{new Date(record.timestamp).getDate()}</span>
                <span className="text-[10px] font-bold uppercase text-slate-500">{new Date(record.timestamp).toLocaleDateString('es-ES', { month: 'short' })}</span>
              </div>
              <div>
                <p className="font-bold text-slate-200">{record.type === 'IN' ? 'Entrada' : 'Salida'}</p>
                <p className="text-xs text-slate-400">{new Date(record.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} • {record.worksite_name}</p>
              </div>
            </div>
            <Printer className="w-5 h-5 text-slate-500" />
          </div>
        ))}
      </div>
    </div>
  );
};

const RecordDetailView = ({ record, user, onBack }: { record: Record, user: User, onBack: () => void }) => {
  return (
    <div className="flex-1 bg-slate-950 font-['Quicksand'] overflow-y-auto pb-24">
      <header className="flex items-center gap-4 p-4 border-b border-slate-800">
        <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft /></button>
        <h1 className="text-lg font-semibold">Detalle del Registro</h1>
      </header>
      <div className="p-6 space-y-6">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <p className="text-slate-500 text-xs font-bold uppercase mb-2">Resumen</p>
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold text-[#ff8c00]">{record.type === 'IN' ? 'Entrada' : 'Salida'}</h2>
              <p className="text-slate-400">{new Date(record.timestamp).toLocaleString('es-ES')}</p>
            </div>
            <Verified className="text-green-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase">Sede</p>
            <p className="font-bold">{record.worksite_name}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <p className="text-slate-500 text-[10px] font-bold uppercase">Distancia</p>
            <p className="font-bold">{record.distance.toFixed(1)}m</p>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <p className="text-slate-500 text-[10px] font-bold uppercase mb-2">Notas</p>
          <p className="text-slate-300 italic">"{record.notes || 'Sin notas'}"</p>
        </div>

        <button 
          onClick={() => generateRecordPDF(record, user)}
          className="w-full bg-[#ff8c00] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
        >
          <Printer /> Descargar Comprobante
        </button>
      </div>
    </div>
  );
};

const WeeklySummaryView = ({ records, user, showToast, onSelectRecord }: { records: Record[], user: User, showToast: (msg: string, type: 'success' | 'error') => void, onSelectRecord: (record: Record) => void }) => {
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
        <button type="submit" className="w-full bg-[#ff8c00] py-4 rounded-xl font-bold">Cambiar Contraseña</button>
      </form>
    </div>
  );
};

const NotificationsView = ({ onBack }: { onBack: () => void }) => (
  <div className="p-8 space-y-8 font-['Quicksand'] text-center">
    <button onClick={onBack} className="flex items-center gap-2 text-slate-500"><ArrowLeft /> Volver</button>
    <Bell className="w-16 h-16 mx-auto text-slate-700 opacity-20" />
    <p className="text-slate-500">Ajustes de notificaciones próximamente.</p>
  </div>
);

const PendingRequestsView = ({ onBack, onActionComplete, onSelectRecord }: { onBack: () => void, onActionComplete: () => void, onSelectRecord: (record: Record) => void }) => {
  const [requests, setRequests] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    const res = await fetch('/api/admin/pending-records');
    const data = await res.json();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id: number, status: string) => {
    await fetch('/api/admin/records/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    fetchRequests();
    onActionComplete();
  };

  return (
    <div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
      <div className="flex items-center gap-4">
        <button onClick={onBack}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Alertas Pendientes</h2>
      </div>
      {requests.length === 0 ? (
        <div className="text-center py-12 text-slate-500 italic">No hay alertas</div>
      ) : (
        requests.map(req => (
          <div key={req.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex justify-between items-start cursor-pointer" onClick={() => onSelectRecord(req)}>
              <div>
                <p className="font-bold">{req.user_name}</p>
                <p className="text-xs text-slate-500">{req.worksite_name} • {new Date(req.timestamp).toLocaleString()}</p>
              </div>
              <span className="text-red-500 font-black text-[10px] bg-red-500/10 px-2 py-1 rounded">FUERA RANGO</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleAction(req.id, 'APPROVED')} className="flex-1 bg-green-500 py-3 rounded-xl font-bold text-xs">APROBAR</button>
              <button onClick={() => handleAction(req.id, 'REJECTED')} className="flex-1 bg-red-500/10 text-red-500 py-3 rounded-xl font-bold text-xs">RECHAZAR</button>
            </div>
          </div>
        ))
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
    return days.map(day => ({ 
      day: day.split('-').slice(1).join('/'), 
      fichajes: records.filter(r => r.timestamp.startsWith(day) && r.type === 'IN').length 
    }));
  }, [records]);

  return (
    <div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
      <header className="flex items-center gap-4">
        <button onClick={onBack}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Informes</h2>
      </header>
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 h-64">
        <h3 className="text-sm font-bold text-slate-500 mb-4">ASISTENCIA SEMANAL</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
            <YAxis stroke="#94a3b8" fontSize={10} />
            <Bar dataKey="fichajes" fill="#ff8c00" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AdminRecordsListView = ({ records, users, onSelectRecord, onBack }: { records: Record[], users: User[], onSelectRecord: (record: Record) => void, onBack: () => void }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedU, setSelectedU] = useState('all');

  const filtered = records.filter(r => {
    const isDay = r.timestamp.startsWith(startDate);
    const isUser = selectedU === 'all' || r.user_id.toString() === selectedU;
    return isDay && isUser;
  });

  return (
    <div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack}><ArrowLeft /></button>
          <h2 className="text-2xl font-bold">Registros</h2>
        </div>
      </header>
      <div className="flex gap-2">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-xl outline-none" />
        <select value={selectedU} onChange={e => setSelectedU(e.target.value)} className="flex-1 bg-slate-900 border border-slate-800 p-3 rounded-xl outline-none">
          <option value="all">Todos</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} onClick={() => onSelectRecord(r)} className="bg-slate-900 p-4 rounded-xl flex justify-between items-center cursor-pointer border border-slate-800">
            <div>
              <p className="font-bold text-sm">{r.user_name}</p>
              <p className="text-[10px] text-slate-500">{new Date(r.timestamp).toLocaleTimeString()}</p>
            </div>
            <span className={`text-[10px] font-black ${r.type === 'IN' ? 'text-green-500' : 'text-red-500'}`}>{r.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExportView = ({ onBack, records, showToast }: { onBack: () => void, records: Record[], showToast: (msg: string, type: 'success' | 'error') => void }) => {
  const handleExport = (format: 'CSV' | 'PDF') => {
    if (format === 'PDF') generateFullReportPDF(records, { name: 'Exportación', employee_id: 'ADMIN' } as any);
    else {
      const csv = "Fecha,Hora,Tipo,Usuario,Sede\n" + records.map(r => `${new Date(r.timestamp).toLocaleDateString()},${new Date(r.timestamp).toLocaleTimeString()},${r.type},${r.user_name},${r.worksite_name}`).join("\n");
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "registros.csv";
      a.click();
    }
    showToast('Archivo generado', 'success');
  };

  return (
    <div className="flex-1 p-6 space-y-8 font-['Quicksand'] text-center">
      <button onClick={onBack} className="flex items-center gap-2"><ArrowLeft /> Volver</button>
      <Download className="w-16 h-16 mx-auto text-slate-700 opacity-20" />
      <div className="space-y-4">
        <button onClick={() => handleExport('PDF')} className="w-full bg-[#ff8c00] py-4 rounded-2xl font-bold">DESCARGAR INFORME PDF</button>
        <button onClick={() => handleExport('CSV')} className="w-full bg-slate-800 py-4 rounded-2xl font-bold">DESCARGAR EXCEL (CSV)</button>
      </div>
    </div>
  );
};

const AdminDashboard = ({ records, users, stats, onViewRequests, onNavigate }: { records: Record[], users: User[], stats: any, onViewRequests: () => void, onNavigate: (tab: string) => void }) => {
  return (
    <div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-3xl shadow-xl">
        <div className="flex justify-between mb-8">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Clock className="text-white" /></div>
          <span className="text-[10px] font-bold text-white uppercase bg-white/10 px-3 py-1 rounded-full">En Tiempo Real</span>
        </div>
        <p className="text-5xl font-black text-white">{stats.activeEmployees}</p>
        <p className="text-white/80 font-bold">Empleados Activos</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
          <p className="text-3xl font-black">{stats.totalHoursToday}</p>
          <p className="text-slate-500 font-bold text-xs uppercase">Horas Totales Hoy</p>
        </div>
        <div onClick={onViewRequests} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 cursor-pointer">
          <p className="text-3xl font-black text-orange-500">{stats.pendingAlerts}</p>
          <p className="text-slate-500 font-bold text-xs uppercase">Alertas</p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { icon: Users, label: 'Gestión de Usuarios', id: 'admin-users' },
          { icon: BarChart3, label: 'Informes Detallados', id: 'admin-reports' },
          { icon: Download, label: 'Exportación de Datos', id: 'admin-export' }
        ].map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)} className="w-full flex items-center justify-between p-5 bg-slate-900 rounded-3xl border border-slate-800 hover:border-orange-500/20 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center"><item.icon className="w-5 h-5 text-[#ff8c00]" /></div>
              <p className="font-bold text-sm">{item.label}</p>
            </div>
            <ChevronRight />
          </button>
        ))}
      </div>
    </div>
  );
};

const UserModal = ({ user, onSave, onClose, existingUsers }: { user?: User, onSave: (u: any) => Promise<void>, onClose: () => void, existingUsers: User[] }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: user?.password || 'password123',
    employee_id: user?.employee_id || '',
    department: user?.department || '',
    role: (user?.role || 'USER') as 'USER' | 'ADMIN'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-3xl p-8 space-y-6">
        <h3 className="text-2xl font-bold">{user ? 'Editar' : 'Añadir'} Usuario</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Nombre" />
          <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Email" />
          <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Contraseña" />
          <input type="text" value={formData.employee_id} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="ID Empleado" />
          <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none">
            <option value="USER">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <div className="flex gap-2 pt-4">
            <button type="submit" className="flex-1 bg-[#ff8c00] py-3 rounded-xl font-bold">GUARDAR</button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 py-3 rounded-xl font-bold">CANCELAR</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagementView = ({ users, onUpdateStatus, onAdd, onUpdate, onDelete, onBack }: { users: User[], onUpdateStatus: (id: number, status: string) => void, onAdd: (user: any) => Promise<void>, onUpdate: (id: number, user: any) => Promise<void>, onDelete: (id: number) => Promise<void>, onBack: () => void }) => {
  const [showModal, setShowModal] = useState(false);
  const [editU, setEditU] = useState<User | undefined>();

  return (
    <div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
      <header className="flex items-center justify-between">
        <button onClick={onBack}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <button onClick={() => { setEditU(undefined); setShowModal(true); }} className="bg-[#ff8c00] p-2 rounded-xl"><Plus /></button>
      </header>
      {showModal && <UserModal user={editU} onClose={() => setShowModal(false)} existingUsers={users} onSave={editU ? (d) => onUpdate(editU.id, d) : onAdd} />}
      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="bg-slate-900 p-4 rounded-2xl flex justify-between items-center border border-slate-800">
            <div>
              <p className="font-bold text-sm">{u.name}</p>
              <p className="text-[10px] text-slate-500">{u.department || 'Sin Dpto'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditU(u); setShowModal(true); }} className="p-2 text-slate-500"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => onDelete(u.id)} className="p-2 text-red-500"><Trash className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WorksiteModal = ({ worksite, onSave, onClose }: { worksite?: Worksite, onSave: (w: any) => Promise<void>, onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: worksite?.name || '',
    latitude: worksite?.latitude || 40.4168,
    longitude: worksite?.longitude || -3.7038,
    radius: worksite?.radius || 100,
    address: worksite?.address || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-md rounded-3xl p-8 space-y-6">
        <h3 className="text-2xl font-bold">{worksite ? 'Editar' : 'Nueva'} Sede</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Nombre Sede" />
          <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Dirección" />
          <div className="flex gap-2">
            <input type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} className="flex-1 bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Lat" />
            <input type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} className="flex-1 bg-slate-900 p-3 rounded-xl border border-slate-800 outline-none" placeholder="Long" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Radio: {formData.radius}m</label>
            <input type="range" min="1" max="1000" value={formData.radius} onChange={e => setFormData({...formData, radius: parseInt(e.target.value)})} className="w-full accent-orange-500" />
          </div>
          <div className="flex gap-2 pt-4">
            <button type="submit" className="flex-1 bg-[#ff8c00] py-3 rounded-xl font-bold">GUARDAR</button>
            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 py-3 rounded-xl font-bold">CANCELAR</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WorksiteManagementView = ({ worksites, onAdd, onUpdate, onDelete, onBack }: { worksites: Worksite[], onAdd: (w: any) => Promise<void>, onUpdate: (id: number, w: any) => Promise<void>, onDelete: (id: number) => Promise<void>, onBack: () => void }) => {
  const [showModal, setShowModal] = useState(false);
  const [editW, setEditW] = useState<Worksite | undefined>();

  return (
    <div className="flex-1 p-6 space-y-6 font-['Quicksand'] overflow-y-auto pb-24">
      <header className="flex items-center justify-between">
        <button onClick={onBack}><ArrowLeft /></button>
        <h2 className="text-2xl font-bold">Sedes</h2>
        <button onClick={() => { setEditW(undefined); setShowModal(true); }} className="bg-[#ff8c00] p-2 rounded-xl"><Plus /></button>
      </header>
      {showModal && <WorksiteModal worksite={editW} onClose={() => setShowModal(false)} onSave={editW ? (d) => onUpdate(editW.id, d) : onAdd} />}
      <div className="space-y-4">
        {worksites.map(w => (
          <div key={w.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-bold text-lg">{w.name}</p>
                <p className="text-xs text-slate-500 italic">{w.address}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditW(w); setShowModal(true); }} className="p-2 text-slate-500"><Edit3 /></button>
                <button onClick={() => onDelete(w.id)} className="p-2 text-red-500"><Trash /></button>
              </div>
            </div>
            <div className="bg-orange-500/10 text-[#ff8c00] text-[10px] font-bold px-3 py-1 rounded-full inline-block">Radio de Validación: {w.radius}m</div>
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

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (user) {
      fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
      fetch(`/api/status/${user.id}`).then(res => res.json()).then(s => {
        if (s.isClockedIn) {
          setIsClockedIn(true);
          setStartTime(new Date(s.startTime));
        }
      });
      if (user.role === 'ADMIN') fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    const [s, u, w, r] = await Promise.all([
      fetch('/api/admin/stats').then(res => res.json()),
      fetch('/api/admin/users').then(res => res.json()),
      fetch('/api/admin/worksites').then(res => res.json()),
      fetch('/api/admin/records').then(res => res.json())
    ]);
    setAdminStats(s); setAdminUsers(u); setAdminWorksites(w); setAllRecords(r);
  };

  const handleClockIn = async (worksiteId: number) => {
    if (!user || !location) return;
    const worksites = await fetch('/api/worksites').then(res => res.json());
    const site = worksites.find((w: any) => w.id === worksiteId);
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    const res = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, worksite_id: worksiteId, type: 'IN', latitude: location.latitude, longitude: location.longitude, distance: dist, notes: '' })
    });
    if (res.ok) { setIsClockedIn(true); setStartTime(new Date()); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); }
  };

  const handleClockOut = async (notes: string) => {
    if (!user || !location) return;
    const lastRecord = userRecords[0];
    const worksites = await fetch('/api/worksites').then(res => res.json());
    const site = worksites.find((w: any) => w.id === lastRecord.worksite_id);
    const dist = calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude);
    const res = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, worksite_id: lastRecord.worksite_id, type: 'OUT', latitude: location.latitude, longitude: location.longitude, distance: dist, notes })
    });
    if (res.ok) { setIsClockedIn(false); setStartTime(null); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); if (user.role === 'ADMIN') fetchAdminData(); }
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-['Quicksand']">
      <header className="flex items-center justify-between p-4 bg-slate-900/50 border-b border-orange-500/10">
        <div className="flex items-center gap-2"><Clock className="text-[#ff8c00]" /> <h2 className="text-lg font-bold">GeoClock</h2></div>
        <button onClick={() => setUser(null)} className="p-2 text-red-500"><LogOut /></button>
      </header>
      <main className="flex-1 flex flex-col overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedRecord ? (
            <RecordDetailView record={selectedRecord} user={user} onBack={() => setSelectedRecord(null)} />
          ) : (
            <div className="flex-1 flex flex-col">
              {user.role === 'ADMIN' ? (
                <>
                  {activeTab === 'admin-dashboard' && <AdminDashboard records={allRecords} users={adminUsers} stats={adminStats || { activeEmployees: 0, totalHoursToday: 0, pendingAlerts: 0 }} onViewRequests={() => setActiveTab('admin-requests')} onNavigate={setActiveTab} />}
                  {activeTab === 'admin-records' && <AdminRecordsListView records={allRecords} users={adminUsers} onSelectRecord={setSelectedRecord} onBack={() => setActiveTab('admin-dashboard')} />}
                  {activeTab === 'admin-users' && <UserManagementView users={adminUsers} onBack={() => setActiveTab('admin-dashboard')} onUpdateStatus={()=>{}} onAdd={async(d)=> { await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); fetchAdminData(); }} onUpdate={async(id,d)=> { await fetch(`/api/admin/users/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); fetchAdminData(); }} onDelete={async(id)=> { if(confirm('¿Borrar?')){ await fetch(`/api/admin/users/${id}`,{method:'DELETE'}); fetchAdminData(); } }} />}
                  {activeTab === 'admin-worksites' && <WorksiteManagementView worksites={adminWorksites} onBack={() => setActiveTab('admin-dashboard')} onAdd={async(d)=> { await fetch('/api/admin/worksites', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); fetchAdminData(); }} onUpdate={async(id,d)=> { await fetch(`/api/admin/worksites/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); fetchAdminData(); }} onDelete={async(id)=>{ if(confirm('¿Borrar?')){ await fetch(`/api/admin/worksites/${id}`, {method:'DELETE'}); fetchAdminData(); } }} />}
                  {activeTab === 'admin-requests' && <PendingRequestsView onBack={() => setActiveTab('admin-dashboard')} onActionComplete={fetchAdminData} onSelectRecord={setSelectedRecord} />}
                  {activeTab === 'admin-reports' && <ReportsView records={allRecords} users={adminUsers} onBack={() => setActiveTab('admin-dashboard')} />}
                  {activeTab === 'admin-export' && <ExportView records={allRecords} showToast={showToast} onBack={() => setActiveTab('admin-dashboard')} />}
                  {activeTab === 'admin-clockin' && (isClockedIn ? <ActiveSession user={user} startTime={startTime!} onFinish={handleClockOut} onDiscard={()=>setIsClockedIn(false)} /> : <Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />)}
                  {activeTab === 'profile' && (
                    <div className="p-8 space-y-8 flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-orange-500 overflow-hidden flex items-center justify-center"><UserIcon className="w-12 h-12 text-slate-600" /></div>
                      <h2 className="text-2xl font-bold">{user.name}</h2>
                      <button onClick={()=>setUser(null)} className="w-full bg-red-500/10 text-red-500 py-4 rounded-xl font-bold">CERRAR SESIÓN</button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {activeTab === 'home' && (isClockedIn ? <ActiveSession user={user} startTime={startTime!} onFinish={handleClockOut} onDiscard={()=>setIsClockedIn(false)} /> : <Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />)}
                  {activeTab === 'history' && <HistoryView records={userRecords} user={user} onSelectRecord={setSelectedRecord} />}
                  {activeTab === 'summary' && <WeeklySummaryView records={userRecords} user={user} showToast={showToast} onSelectRecord={setSelectedRecord} />}
                  {activeTab === 'profile' && (
                    profileView === 'edit' ? <EditProfileView user={user} onBack={()=>setProfileView('main')} onSave={u=>{setUser(u);setProfileView('main');}} /> :
                    profileView === 'password' ? <ChangePasswordView user={user} onBack={()=>setProfileView('main')} /> :
                    <div className="p-8 space-y-6 flex flex-col items-center">
                       <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-orange-500 flex items-center justify-center"><UserIcon className="w-10 h-10 text-slate-600" /></div>
                       <div className="text-center"><h2 className="text-2xl font-bold">{user.name}</h2><p className="text-orange-500 font-bold">{user.department}</p></div>
                       <div className="w-full space-y-3 pt-6">
                         <button onClick={()=>setProfileView('edit')} className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 text-left flex justify-between">Editar Perfil <ChevronRight /></button>
                         <button onClick={()=>setProfileView('password')} className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 text-left flex justify-between">Seguridad <ChevronRight /></button>
                         <button onClick={()=>setUser(null)} className="w-full bg-red-500/5 text-red-500 p-4 rounded-xl font-bold">CERRAR SESIÓN</button>
                       </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </AnimatePresence>
      </main>
      {!selectedRecord && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800 px-6 pb-6 pt-3 flex justify-between items-center z-50">
          {user.role === 'ADMIN' ? (
            <>
              <button onClick={()=>setActiveTab('admin-dashboard')} className={activeTab === 'admin-dashboard' ? 'text-orange-500' : 'text-slate-600'}><LayoutDashboard /></button>
              <button onClick={()=>setActiveTab('admin-records')} className={activeTab === 'admin-records' ? 'text-orange-500' : 'text-slate-600'}><FileText /></button>
              <button onClick={()=>setActiveTab('admin-clockin')} className={activeTab === 'admin-clockin' ? 'text-orange-500' : 'text-slate-600'}><Fingerprint /></button>
              <button onClick={()=>setActiveTab('admin-users')} className={activeTab === 'admin-users' ? 'text-orange-500' : 'text-slate-600'}><Users /></button>
              <button onClick={()=>setActiveTab('admin-worksites')} className={activeTab === 'admin-worksites' ? 'text-orange-500' : 'text-slate-600'}><Building2 /></button>
              <button onClick={()=>setActiveTab('profile')} className={activeTab === 'profile' ? 'text-orange-500' : 'text-slate-600'}><Settings /></button>
            </>
          ) : (
            <>
              <button onClick={()=>setActiveTab('home')} className={activeTab === 'home' ? 'text-orange-500' : 'text-slate-600'}><Home /><span className="text-[10px] font-bold">INICIO</span></button>
              <button onClick={()=>setActiveTab('history')} className={activeTab === 'history' ? 'text-orange-500' : 'text-slate-600'}><FileText /><span className="text-[10px] font-bold">LOGS</span></button>
              <button onClick={()=>setActiveTab('summary')} className={activeTab === 'summary' ? 'text-orange-500' : 'text-slate-600'}><BarChart3 /><span className="text-[10px] font-bold">RESUMEN</span></button>
              <button onClick={()=>setActiveTab('profile')} className={activeTab === 'profile' ? 'text-orange-500' : 'text-slate-600'}><UserIcon /><span className="text-[10px] font-bold">PERFIL</span></button>
            </>
          )}
        </nav>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
    </div>
  );
}
