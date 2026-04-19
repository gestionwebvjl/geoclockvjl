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

// --- PDF Generation ---
const generateFullReportPDF = (records: Record[], user: User, periodLabel?: string) => {
  if (!records || records.length === 0) return;
  const doc = new jsPDF();
  doc.setFontSize(22); doc.setTextColor(255, 140, 0); doc.text('GeoClock - Informe de Asistencia', 20, 20);
  doc.setFontSize(12); doc.setTextColor(100);
  const isConsolidated = user.employee_id === 'ADMIN';
  doc.text(isConsolidated ? `Informe Consolidado de Administración` : `Empleado: ${user.name} (${user.employee_id})`, 20, 30);
  doc.text(`Periodo: ${periodLabel || 'Reporte'}`, 20, 37);

  const recordsByUser: { [key: string]: { name: string, records: Record[] } } = {};
  if (isConsolidated) { records.forEach(r => { const name = r.user_name || `ID: ${r.user_id}`; if (!recordsByUser[name]) recordsByUser[name] = { name, records: [] }; recordsByUser[name].records.push(r); }); } else { recordsByUser[user.name] = { name: user.name, records }; }

  let currentY = 45;
  Object.values(recordsByUser).forEach((userData, idx) => {
    const sorted = [...userData.records].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const dailyTotals: { [key: string]: number } = {}; let totalUserMs = 0;
    for(let i=0; i<sorted.length; i++) {
      if(sorted[i].type === 'IN') {
        let outIdx = -1;
        for(let j=i+1; j<sorted.length; j++) { if(sorted[j].type === 'OUT') { outIdx = j; break; } else if(sorted[j].type === 'IN') break; }
        if(outIdx !== -1) {
          const diff = new Date(sorted[outIdx].timestamp).getTime() - new Date(sorted[i].timestamp).getTime();
          totalUserMs += diff;
          const dateStr = new Date(sorted[outIdx].timestamp).toLocaleDateString('es-ES');
          dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + diff;
          i = outIdx;
        }
      }
    }
    if (isConsolidated && idx > 0) { doc.addPage(); currentY = 20; }
    if (isConsolidated) { doc.setFontSize(14); doc.setTextColor(0); doc.text(`Empleado: ${userData.name}`, 20, currentY); currentY += 10; }
    const tableData = sorted.map((r) => {
      const dStr = new Date(r.timestamp).toLocaleDateString('es-ES');
      return [ dStr, new Date(r.timestamp).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}), r.type === 'IN' ? 'Entrada' : 'Salida', r.worksite_name, `${(r.distance||0).toFixed(1)}m`, r.is_manual ? 'Manual' : 'GPS', '' ];
    });
    autoTable(doc, { startY: currentY, head: [['Fecha', 'Hora', 'Tipo', 'Sede', 'Distancia', 'Método', 'Total Día']], body: tableData, foot: [['', '', '', '', '', 'TOTAL:', `${Math.floor(totalUserMs/3600000)}h ${Math.floor((totalUserMs%3600000)/60000)}m`]], headStyles: { fillColor: [255,140,0] }, margin: { top: 20 }, didDrawPage: (data) => { currentY = data.cursor?.y || currentY; } });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  });
  doc.save(`Informe_${new Date().getTime()}.pdf`);
};

// --- Sub-Components ---
const Login = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) onLogin(await res.json()); else setError('Credenciales inválidas');
  };
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-xl">
        <h1 className="text-4xl font-black text-white text-center mb-8">GeoClock</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="text-red-500 text-center font-bold">{error}</div>}
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-800 p-4 rounded-2xl text-white outline-none border border-slate-700 focus:border-orange-500" />
          <input type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-800 p-4 rounded-2xl text-white outline-none border border-slate-700 focus:border-orange-500" />
          <button type="submit" className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl">ENTRAR</button>
        </form>
      </div>
    </div>
  );
};

// --- DASHBOARD ORIGINAL ---
const Dashboard = ({ user, onClockIn, records }: any) => {
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [selectedWorksite, setSelectedWorksite] = useState<number>(0);
  const { location, error: geoError } = useGeolocation();
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => { fetch('/api/worksites').then(res => res.json()).then(data => { setWorksites(data); if (data.length > 0) setSelectedWorksite(data[0].id); }); }, []);
  useEffect(() => { if (location && selectedWorksite) { const site = worksites.find(w => w.id === selectedWorksite); if (site) setDistance(calculateDistance(location.latitude, location.longitude, site.latitude, site.longitude)); } }, [location, selectedWorksite, worksites]);

  const canClockIn = distance !== null && distance <= (worksites.find(w=>w.id===selectedWorksite)?.radius || 100);

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 max-w-md mx-auto w-full font-['Quicksand'] pb-24">
      <div className="text-center py-6">
        <h1 className="text-5xl font-bold text-white mb-2">{new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</h1>
        <p className="text-slate-400 capitalize">{new Date().toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'short'})}</p>
      </div>
      <div className="space-y-4">
        <select value={selectedWorksite} onChange={e=>setSelectedWorksite(Number(e.target.value))} className="w-full bg-slate-900 border border-orange-500/20 text-white rounded-xl p-4 outline-none">
          {worksites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className={`p-3 rounded-xl border text-center text-xs font-bold ${canClockIn ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-orange-500/5 border-orange-500/10 text-orange-400'}`}>
          <MapPin className="inline w-4 h-4 mr-2" />
          {canClockIn ? 'Ubicación válida' : `Fuera de rango (${distance?.toFixed(1)}m)`}
        </div>
        <button disabled={!canClockIn} onClick={()=>onClockIn(selectedWorksite)} className={`w-full aspect-square rounded-full flex flex-col items-center justify-center transition-all ${canClockIn ? 'bg-orange-500 shadow-xl shadow-orange-500/20' : 'bg-slate-800 text-slate-500'}`}>
          <Fingerprint className="w-16 h-16 mb-2" />
          <span className="text-xl font-bold">FICHAR</span>
        </button>
      </div>
    </div>
  );
};

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [userRecords, setUserRecords] = useState<Record[]>([]);
  const [allRecords, setAllRecords] = useState<Record[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminWorksites, setAdminWorksites] = useState<Worksite[]>([]);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const [adminStats, setAdminStats] = useState({ activeEmployees: 0, totalHoursToday: 0, pendingAlerts: 0 });
  const [toast, setToast] = useState<any>(null);
  const { location } = useGeolocation();

  useEffect(() => {
    if (user) {
      fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords);
      fetch(`/api/status/${user.id}`).then(res => res.json()).then(s => { if (s.isClockedIn) { setIsClockedIn(true); setStartTime(new Date(s.startTime)); } });
      if (user.role === 'ADMIN') fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    const [s, u, w, r, p] = await Promise.all([
      fetch('/api/admin/stats').then(res => res.json()), fetch('/api/admin/users').then(res => res.json()), fetch('/api/admin/worksites').then(res => res.json()), fetch('/api/admin/records').then(res => res.json()), fetch('/api/admin/pending-records').then(res => res.json())
    ]);
    setAdminStats(s); setAdminUsers(u); setAdminWorksites(w); setAllRecords(r); setPendingAlerts(p);
  };

  const handleClockIn = async (worksiteId: number) => {
    if (!user || !location) return;
    const res = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, worksite_id: worksiteId, type: 'IN', latitude: location.latitude, longitude: location.longitude, distance: 0, notes: '' }) });
    if (res.ok) { setIsClockedIn(true); setStartTime(new Date()); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); }
  };

  const handleClockOut = async (notes: string) => {
    if (!user || !location) return;
    const last = userRecords[0];
    
    // --- LÓGICA DE HORAS EXTRA ---
    const now = new Date();
    const esManana = now.getHours() < 14 || (now.getHours() === 14 && now.getMinutes() < 30);
    const horaPrevista = esManana ? (user.horario_manana_fin || "14:00") : (user.horario_tarde_fin || "18:00");
    const [hP, mP] = horaPrevista.split(':').map(Number);
    const previstoMs = (hP * 60 + mP) * 60000;
    const actualMs = (now.getHours() * 60 + now.getMinutes()) * 60000;
    let minE = 0; let estE = 'N/A';
    if (actualMs > previstoMs + 300000) { minE = Math.floor((actualMs - previstoMs) / 60000); estE = 'PENDIENTE'; }

    const res = await fetch('/api/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, worksite_id: last.worksite_id, type: 'OUT', latitude: location.latitude, longitude: location.longitude, distance: 0, notes, minutos_extra: minE, estado_extra: estE }) });
    if (res.ok) { setIsClockedIn(false); setStartTime(null); fetch(`/api/records/${user.id}`).then(res => res.json()).then(setUserRecords); if(user.role==='ADMIN') fetchAdminData(); }
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="p-4 border-b border-orange-500/10 flex justify-between items-center bg-slate-900/50">
        <h2 className="text-xl font-bold text-orange-500">GeoClock</h2>
        <button onClick={()=>setUser(null)}><LogOut className="text-red-500" /></button>
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto">
        {user.role === 'ADMIN' ? (
          <>
            {activeTab === 'admin-dashboard' && (
              <div className="p-6 space-y-6">
                <div className="bg-orange-500 p-8 rounded-3xl"><p className="text-5xl font-black">{adminStats.activeEmployees}</p><p className="font-bold">Activos ahora</p></div>
                <button onClick={()=>setActiveTab('admin-requests')} className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl flex justify-between items-center">Alertas Pendientes <span className="bg-orange-500 px-3 py-1 rounded-full">{adminStats.pendingAlerts}</span></button>
              </div>
            )}
            {activeTab === 'admin-clockin' && (isClockedIn ? <div className="p-8 text-center"><button onClick={()=>handleClockOut('')} className="bg-orange-500 p-6 rounded-2xl w-full font-bold">FIN DE TURNO</button></div> : <Dashboard user={user} onClockIn={handleClockIn} records={userRecords} />)}
            {activeTab === 'admin-records' && <div className="p-6"><h2>Registros Diarios</h2>{allRecords.slice(0,10).map(r=>(<div key={r.id} className="p-4 bg-slate-900 rounded mb-2">{r.user_name} - {r.type}</div>))}</div>}
            {activeTab === 'admin-users' && <div className="p-6"><h2>Usuarios</h2>{adminUsers.map(u=>(<div key={u.id} className="p-4 bg-slate-900 rounded mb-2">{u.name}</div>))}</div>}
            {activeTab === 'admin-worksites' && <div className="p-6"><h2>Sedes</h2>{adminWorksites.map(w=>(<div key={w.id} className="p-4 bg-slate-900 rounded mb-2">{w.name}</div>))}</div>}
            {activeTab === 'profile' && <div className="p-8 text-center"><UserIcon className="w-16 h-16 mx-auto mb-4" /><p className="text-xl font-bold">{user.name}</p></div>}
          </>
        ) : (
          <>
            {activeTab === 'home' && (isClockedIn ? <div className="p-8 text-center space-y-8"><div className="text-6xl font-black tabular-nums">TRABAJANDO</div><button onClick={()=>handleClockOut('')} className="w-full bg-orange-500 py-4 rounded-xl font-bold">FIN DE TURNO</button></div> : <Dashboard user={user} records={userRecords} onClockIn={handleClockIn} />)}
            {activeTab === 'history' && <div className="p-6 space-y-4">{userRecords.map(r=>(<div key={r.id} className="p-4 bg-slate-900 rounded-xl">{new Date(r.timestamp).toLocaleString()} - {r.type}</div>))}</div>}
            {activeTab === 'summary' && <div className="p-6 text-center"><button onClick={()=>generateFullReportPDF(userRecords, user)} className="w-full bg-orange-500 py-4 rounded-xl font-bold">DESCARGAR PDF</button></div>}
            {activeTab === 'profile' && <div className="p-8 text-center"><UserIcon className="w-16 h-16 mx-auto mb-4" /><p className="text-xl font-bold">{user.name}</p></div>}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-slate-950/95 border-t border-slate-800 flex justify-around p-4 z-50">
        {user.role === 'ADMIN' ? (
          <>
            <button onClick={()=>setActiveTab('admin-dashboard')} className={activeTab==='admin-dashboard'?'text-orange-500':'text-slate-500'}><LayoutDashboard /></button>
            <button onClick={()=>setActiveTab('admin-records')} className={activeTab==='admin-records'?'text-orange-500':'text-slate-500'}><FileText /></button>
            <button onClick={()=>setActiveTab('admin-clockin')} className={activeTab==='admin-clockin'?'text-orange-500':'text-slate-500'}><Fingerprint /></button>
            <button onClick={()=>setActiveTab('admin-users')} className={activeTab==='admin-users'?'text-orange-500':'text-slate-500'}><Users /></button>
            <button onClick={()=>setActiveTab('admin-worksites')} className={activeTab==='admin-worksites'?'text-orange-500':'text-slate-500'}><Building2 /></button>
            <button onClick={()=>setActiveTab('profile')} className={activeTab==='profile'?'text-orange-500':'text-slate-500'}><Settings /></button>
          </>
        ) : (
          <>
            <button onClick={()=>setActiveTab('home')} className={activeTab==='home'?'text-orange-500':'text-slate-500'}><Home /><span className="text-[10px] font-bold">INICIO</span></button>
            <button onClick={()=>setActiveTab('history')} className={activeTab==='history'?'text-orange-500':'text-slate-500'}><FileText /><span className="text-[10px] font-bold">LOGS</span></button>
            <button onClick={()=>setActiveTab('summary')} className={activeTab==='summary'?'text-orange-500':'text-slate-500'}><BarChart3 /><span className="text-[10px] font-bold">RESUMEN</span></button>
            <button onClick={()=>setActiveTab('profile')} className={activeTab==='profile'?'text-orange-500':'text-slate-500'}><UserIcon /><span className="text-[10px] font-bold">PERFIL</span></button>
          </>
        )}
      </nav>
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
    </div>
  );
}
