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
const generateRecordPDF = (record: Record, user: User) => {
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

const PendingRequestsView = ({ onBack, onActionComplete, onSelectRecord }: { onBack: () => void, onActionComplete: () => void, onSelectRecord: (record: Record) => void }) => {
  const [requests, setRequests] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/admin/pending-records');
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
              
              {/* LÓGICA HORAS EXTRA VISUAL */}
              <div className="flex flex-col gap-1">
                {req.distance > 100 && <span className="text-red-500 font-black text-[10px] bg-red-500/10 px-2 py-1 rounded w-max">FUERA RANGO</span>}
                {req.estado_extra === 'PENDIENTE' && <span className="text-orange-500 font-black text-[10px] bg-orange-500/10 px-2 py-1 rounded w-max">+{req.minutos_extra} MIN EXTRAS</span>}
              </div>
              
              {req.notes && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Motivo/
