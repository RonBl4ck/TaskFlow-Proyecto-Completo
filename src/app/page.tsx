'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthSession, User, Task, Category, TaskWithDetails } from '@/lib/types';
import Image from 'next/image';


type Page = 'login' | 'my-tasks' | 'assign-tasks' | 'task-detail' | 'statistics' | 'admin';

export default function HomePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setSession(data.user);
          setCurrentPage('my-tasks');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.user) {
      setSession(data.user);
      setCurrentPage('my-tasks');
      return true;
    }
    throw new Error(data.error || 'Error al iniciar sesión');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession(null);
    setCurrentPage('login');
  };

  const navigateTo = (page: Page, taskId?: string) => {
    if (taskId) setSelectedTaskId(taskId);
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-600 font-medium text-lg">Cargando TaskFlow...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar
        session={session}
        currentPage={currentPage}
        collapsed={sidebarCollapsed}
        onNavigate={navigateTo}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
        refreshKey={refreshKey}
      />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-60'}`}>
        <TopBar session={session} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div className="p-6">
          {currentPage === 'my-tasks' && <MyTasksPage session={session} onViewTask={(id) => navigateTo('task-detail', id)} refreshKey={refreshKey} />}
          {currentPage === 'assign-tasks' && <AssignTasksPage session={session} onViewTask={(id) => navigateTo('task-detail', id)} refreshKey={refreshKey} />}
          {currentPage === 'task-detail' && selectedTaskId && <TaskDetailPage taskId={selectedTaskId} session={session} onBack={() => navigateTo(session.role === 'executor' ? 'my-tasks' : 'assign-tasks')} refresh={refresh} />}
          {currentPage === 'statistics' && <StatisticsPage session={session} />}
          {currentPage === 'admin' && <AdminPage session={session} refresh={refresh} />}
        </div>
      </main>
    </div>
  );
}

// =================== LOGIN PAGE ===================
function LoginPage({ onLogin }: { onLogin: (u: string, p: string) => Promise<boolean> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-lg inline-block">
              <Image src="/logo.png" alt="Banco Mundial Logo" width={180} height={60} className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mt-2">TaskFlow</h1>
          <p className="text-blue-200 mt-2">Sistema Integrado de Gestión</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Iniciar Sesión</h2>
            <p className="text-gray-500 text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                placeholder="Ingresa tu usuario"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

        </form>
      </div>
    </div>
  );
}

// =================== SIDEBAR ===================
function Sidebar({ session, currentPage, collapsed, onNavigate, onToggle, onLogout, refreshKey }: {
  session: AuthSession;
  currentPage: Page;
  collapsed: boolean;
  onNavigate: (page: Page) => void;
  onToggle: () => void;
  onLogout: () => void;
  refreshKey: number;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (session.role === 'executor') {
      fetch('/api/tasks?myTasks=true')
        .then(r => r.json())
        .then(data => {
          const tasksWithUpdates = data.tasks?.filter((t: Task) =>
            t.status !== 'closed' && t.status !== 'rejected'
          );
          setUnreadCount(tasksWithUpdates?.length || 0);
        })
        .catch(() => {});
    }
  }, [session.role, refreshKey]);

  const menuItems: { page: Page; label: string; icon: string; show: boolean; badge?: number }[] = [
    { page: 'my-tasks', label: 'Mis Tareas', icon: '📋', show: true, badge: session.role === 'executor' ? unreadCount : undefined },
    { page: 'assign-tasks', label: 'Asignar Tareas', icon: '📤', show: session.role === 'admin' || session.role === 'assigner' || (session.assignableUserIds && session.assignableUserIds.length > 0) },
    { page: 'statistics', label: 'Estadísticas', icon: '📊', show: session.role === 'admin' || session.canViewStats },
    { page: 'admin', label: 'Administración', icon: '⚙️', show: session.role === 'admin' },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-30 flex flex-col ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <span className="font-bold text-lg">TaskFlow</span>
          </div>
        )}
        <button onClick={onToggle} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {menuItems.filter(i => i.show).map(item => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
              currentPage === item.page
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {!collapsed && (
              <span className="flex-1 font-medium">{item.label}</span>
            )}
            {!collapsed && item.badge !== undefined && item.badge > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-gray-700 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center font-bold text-sm">
              {session.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{session.fullName}</p>
              <p className="text-xs text-gray-400 capitalize">{session.role === 'assigner' ? 'Asignador' : session.role === 'admin' ? 'Administrador' : 'Ejecutor'}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-3">
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center font-bold text-sm">
              {session.fullName.charAt(0)}
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-xl transition-colors text-sm"
        >
          <span>🚪</span>
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}

// =================== TOP BAR ===================
function TopBar({ session, sidebarCollapsed, onToggleSidebar }: { session: AuthSession; sidebarCollapsed: boolean; onToggleSidebar: () => void }) {
  return (
    <div className={`sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : 'ml-0'}`}>
      <button onClick={onToggleSidebar} className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Bienvenido,</span>
        <span className="font-semibold text-gray-800">{session.fullName}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          session.role === 'admin' ? 'bg-red-100 text-red-700' :
          session.role === 'assigner' ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>
          {session.role === 'assigner' ? 'Asignador' : session.role === 'admin' ? 'Admin' : 'Ejecutor'}
        </span>
      </div>
    </div>
  );
}

// =================== MY TASKS PAGE (EXECUTOR) ===================
function MyTasksPage({ session, onViewTask, refreshKey }: { session: AuthSession; onViewTask: (id: string) => void; refreshKey: number }) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = session.role === 'executor' ? '/api/tasks?myTasks=true' : '/api/tasks';
    fetch(url)
      .then(r => r.json())
      .then(data => setTasks(data.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.role, refreshKey]);

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    waiting_approval: tasks.filter(t => t.status === 'waiting_approval').length,
    closed: tasks.filter(t => t.status === 'closed').length,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mis Tareas</h1>
        <p className="text-gray-500 mt-1">Gestiona y da seguimiento a tus tareas asignadas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'pending', label: 'Pendientes', color: 'yellow' },
          { key: 'in_progress', label: 'En Progreso', color: 'blue' },
          { key: 'waiting_approval', label: 'Espera Conf.', color: 'orange' },
          { key: 'closed', label: 'Cerradas', color: 'green' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f.label} ({statusCounts[f.key as keyof typeof statusCounts]})
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-gray-500 text-lg">No hay tareas para mostrar</p>
          <p className="text-gray-400 text-sm mt-1">Las tareas asignadas aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} expanded={expandedId === task.id} onToggle={() => setExpandedId(expandedId === task.id ? null : task.id)} onView={() => onViewTask(task.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// =================== TASK CARD ===================
function TaskCard({ task, expanded, onToggle, onView }: { task: TaskWithDetails; expanded: boolean; onToggle: () => void; onView: () => void }) {
  const statusInfo = getStatusInfo(task.status);
  const priorityInfo = getPriorityInfo(task.priority);
  const deadlineInfo = getDeadlineDisplay(task.deadline);
  const daysSince = Math.floor((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className={`bg-white rounded-xl border transition-all shadow-sm hover:shadow-md ${expanded ? 'border-blue-300 shadow-md' : 'border-gray-200'}`}>
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-start gap-4">
          <span className="text-xl mt-0.5">{priorityInfo.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-800">{task.title}</h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${statusInfo.classes}`}>{statusInfo.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priorityInfo.classes}`}>{priorityInfo.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              <span>{task.categories?.map(c => c.name).join(' → ') || 'Sin categoría'}</span>
              <span>•</span>
              <span>{daysSince} días</span>
              {deadlineInfo && <span className={deadlineInfo.color}>{deadlineInfo.text}</span>}
            </div>
          </div>
          <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {task.description && (
            <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{task.description}</p>
          )}
          {task.categories && task.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {task.categories.map(c => (
                <span key={c.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">🏷️ {c.name}</span>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={onView} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Ver Detalle Completo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusInfo(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    pending: { label: 'Pendiente', classes: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    in_progress: { label: 'En Progreso', classes: 'bg-blue-100 text-blue-800 border-blue-300' },
    waiting_approval: { label: 'Espera Conf.', classes: 'bg-orange-100 text-orange-800 border-orange-300' },
    closed: { label: 'Cerrada', classes: 'bg-green-100 text-green-800 border-green-300' },
    rejected: { label: 'Rechazada', classes: 'bg-red-100 text-red-800 border-red-300' },
  };
  return map[status] || { label: status, classes: 'bg-gray-100 text-gray-800 border-gray-300' };
}

function getPriorityInfo(priority: string) {
  const map: Record<string, { label: string; icon: string; classes: string }> = {
    urgent: { label: 'Urgente', icon: '🔴', classes: 'bg-red-100 text-red-700 border-red-300' },
    high: { label: 'Alta', icon: '🟡', classes: 'bg-amber-100 text-amber-700 border-amber-300' },
    normal: { label: 'Normal', icon: '🟢', classes: 'bg-green-100 text-green-600 border-green-300' },
    low: { label: 'Baja', icon: '⚪', classes: 'bg-gray-100 text-gray-600 border-gray-300' },
  };
  return map[priority] || map.normal;
}

function getDeadlineDisplay(deadline: string | null) {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: `${Math.abs(diff)}d vencida`, color: 'text-red-600 font-semibold' };
  if (diff === 0) return { text: 'Vence hoy', color: 'text-orange-600 font-semibold' };
  if (diff <= 3) return { text: `${diff}d restantes`, color: 'text-orange-500' };
  return { text: `${diff}d restantes`, color: 'text-green-600' };
}

// =================== ASSIGN TASKS PAGE ===================
function AssignTasksPage({ session, onViewTask, refreshKey }: { session: AuthSession; onViewTask: (id: string) => void; refreshKey: number }) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([tasksData, usersData]) => {
      setTasks(tasksData.tasks || []);
      setUsers(usersData.users || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [refreshKey]);

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Tareas</h1>
          <p className="text-gray-500 mt-1">Crea, asigna y gestiona las tareas del equipo</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 flex items-center gap-2">
          <span>+</span> Nueva Tarea
        </button>
      </div>

      {showCreate && (
        <CreateTaskModal 
          users={users.filter(u => u.role === 'executor').filter(u => session.role !== 'executor' || (session.assignableUserIds && session.assignableUserIds.includes(u.id)))} 
          onClose={() => setShowCreate(false)} 
          onCreated={() => { setShowCreate(false); setTasks([]); fetch('/api/tasks').then(r => r.json()).then(d => setTasks(d.tasks || [])); }} 
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'pending', label: 'Pendientes' },
          { key: 'in_progress', label: 'En Progreso' },
          { key: 'waiting_approval', label: 'Espera Conf.' },
          { key: 'closed', label: 'Cerradas' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.key ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
            {f.label} ({filter === 'all' ? tasks.length : tasks.filter(t => t.status === f.key).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-gray-500">No hay tareas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <span className="text-xl mt-0.5">{getPriorityInfo(task.priority).icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800">{task.title}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getStatusInfo(task.status).classes}`}>{getStatusInfo(task.status).label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                    <span>👤 {task.assigned_user_id}</span>
                    {(task.categories?.length ?? 0) > 0 && <span>🏷️ {task.categories!.map(c => c.name).join(', ')}</span>}
                    {task.deadline && <span className={getDeadlineDisplay(task.deadline)?.color}>📅 {new Date(task.deadline).toLocaleDateString('es')}</span>}
                  </div>
                </div>
                <button onClick={() => onViewTask(task.id)} className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Ver →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =================== CREATE TASK MODAL ===================
function CreateTaskModal({ users, onClose, onCreated }: { users: User[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [deadline, setDeadline] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !assignedUserId) { setError('Título y usuario asignado son requeridos'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, assigned_user_id: assignedUserId, priority, deadline: deadline || null, category_ids: categoryIds }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); } else { setError(data.error || 'Error al crear tarea'); }
    } catch { setError('Error de conexión'); } finally { setLoading(false); }
  };

  const parentCategories = categories.filter(c => !c.parent_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Nueva Tarea</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder="Título de la tarea" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" rows={3} placeholder="Describe la tarea..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a *</label>
            <select value={assignedUserId} onChange={e => setAssignedUserId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" required>
              <option value="">Seleccionar usuario...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                <option value="urgent">🔴 Urgente</option>
                <option value="high">🟡 Alta</option>
                <option value="normal">🟢 Normal</option>
                <option value="low">⚪ Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categorías</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {parentCategories.map(parent => (
                <div key={parent.id}>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={categoryIds.includes(parent.id)} onChange={e => setCategoryIds(e.target.checked ? [...categoryIds, parent.id] : categoryIds.filter(id => id !== parent.id))} className="rounded" />
                    <span className="font-medium">{parent.name}</span>
                  </label>
                  {categories.filter(c => c.parent_id === parent.id).map(child => (
                    <label key={child.id} className="flex items-center gap-2 text-sm text-gray-500 ml-6">
                      <input type="checkbox" checked={categoryIds.includes(child.id)} onChange={e => setCategoryIds(e.target.checked ? [...categoryIds, child.id] : categoryIds.filter(id => id !== child.id))} className="rounded" />
                      <span>{child.name}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">{loading ? 'Creando...' : 'Crear Tarea'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =================== TASK DETAIL PAGE ===================
function TaskDetailPage({ taskId, session, onBack, refresh }: { taskId: string; session: AuthSession; onBack: () => void; refresh: () => void }) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [hours, setHours] = useState('');
  const [timeType, setTimeType] = useState<'office' | 'outside'>('office');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/tasks/${taskId}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([taskData, usersData]) => {
      setTask(taskData.task);
      setUsers(usersData.users || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [taskId]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning) {
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    const saved = localStorage.getItem('timer');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.taskId === taskId) {
        setTimerSeconds(Math.floor((Date.now() - data.startedAt) / 1000));
        setTimerRunning(true);
        setTimerTaskId(taskId);
      }
    }
  }, [taskId]);

  const startTimer = () => {
    setTimerSeconds(0);
    setTimerRunning(true);
    setTimerTaskId(taskId);
    localStorage.setItem('timer', JSON.stringify({ taskId, startedAt: Date.now() }));
  };

  const stopTimer = () => {
    setTimerRunning(false);
    const hrs = timerSeconds / 3600;
    setHours(hrs.toFixed(2));
    localStorage.removeItem('timer');
  };

  const submitUpdate = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment,
          hours_spent: parseFloat(hours) || 0,
          time_type: parseFloat(hours) > 0 ? timeType : null,
          attachment_url: attachmentUrl || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComment('');
        setHours('');
        setAttachmentUrl('');
        refresh();
        fetch(`/api/tasks/${taskId}`).then(r => r.json()).then(d => setTask(d.task));
      } else {
        setError(data.error || 'Error');
      }
    } catch { setError('Error de conexión'); } finally { setSubmitting(false); }
  };

  const handleStatusAction = async (action: string) => {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.success) {
      refresh();
      fetch(`/api/tasks/${taskId}`).then(r => r.json()).then(d => setTask(d.task));
    }
  };

  const handleReassign = async () => {
    if (!reassignTo) return;
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassign_to: reassignTo }),
    });
    const data = await res.json();
    if (data.success) {
      setShowReassign(false);
      refresh();
      fetch(`/api/tasks/${taskId}`).then(r => r.json()).then(d => setTask(d.task));
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (!confirm('¿Eliminar esta actualización?')) return;
    await fetch(`/api/tasks/${taskId}/updates?updateId=${updateId}`, { method: 'DELETE' });
    refresh();
    fetch(`/api/tasks/${taskId}`).then(r => r.json()).then(d => setTask(d.task));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!task) return <div className="text-center py-20 text-gray-500">Tarea no encontrada</div>;

  const totalHours = task.updates?.filter((u: any) => !u.is_system).reduce((sum: number, u: any) => sum + (u.hours_spent || 0), 0) || 0;
  const formatTime = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        ← Volver a la lista
      </button>

      {/* Task Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl">{getPriorityInfo(task.priority).icon}</span>
              <h1 className="text-xl font-bold text-gray-800">{task.title}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${getStatusInfo(task.status).classes}`}>{getStatusInfo(task.status).label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getPriorityInfo(task.priority).classes}`}>{getPriorityInfo(task.priority).label}</span>
            </div>
            {task.description && <p className="text-gray-600 mt-3 whitespace-pre-wrap">{task.description}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
              <span>👤 Asignado a: <strong className="text-gray-700">{task.assigned_user?.full_name || 'N/A'}</strong></span>
              <span>📝 Creado por: <strong className="text-gray-700">{task.created_by_user?.full_name || 'N/A'}</strong></span>
              <span>📅 {new Date(task.created_at).toLocaleDateString('es')}</span>
              {task.deadline && <span className={getDeadlineDisplay(task.deadline)?.color}>⏰ {getDeadlineDisplay(task.deadline)?.text}</span>}
              <span>⏱️ {totalHours.toFixed(1)}h totales</span>
            </div>
            {task.categories?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {task.categories.map((c: Category) => <span key={c.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">🏷️ {c.name}</span>)}
              </div>
            )}
          </div>
          {(session.role === 'admin' || session.role === 'assigner' || task.created_by_user_id === session.userId) && (
            <div className="flex flex-col gap-2">
              {task.status === 'waiting_approval' && (
                <>
                  <button onClick={() => handleStatusAction('approve')} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">✅ Aprobar</button>
                  <button onClick={() => handleStatusAction('reject')} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">❌ Rechazar</button>
                </>
              )}
              <button onClick={() => setShowReassign(true)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors">🔄 Reasignar</button>
            </div>
          )}
        </div>
      </div>

      {/* Reassign Modal */}
      {showReassign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Reasignar Tarea</h3>
            <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl mb-4">
              <option value="">Seleccionar...</option>
              {users.filter(u => u.role === 'executor').map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowReassign(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl">Cancelar</button>
              <button onClick={handleReassign} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl">Reasignar</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Update */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-800 mb-4">Nueva Actualización</h2>

            {/* Timer */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-center">
                <p className="text-3xl font-mono font-bold text-gray-800">{formatTime(timerSeconds)}</p>
                <div className="flex justify-center gap-2 mt-2">
                  {!timerRunning ? (
                    <button onClick={startTimer} className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">▶ Iniciar</button>
                  ) : (
                    <button onClick={stopTimer} className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">⏹ Detener</button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comentario</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" rows={3} placeholder="Escribe un comentario..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
                  <input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={timeType} onChange={e => setTimeType(e.target.value as 'office' | 'outside')} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                    <option value="office">🏢 Oficina</option>
                    <option value="outside">🏠 Fuera</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link (WeTransfer, Drive, etc.)</label>
                <input type="url" value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder="https://..." />
              </div>

              {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

              <button onClick={submitUpdate} disabled={submitting || (!comment && !hours && !attachmentUrl)} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
                {submitting ? 'Enviando...' : 'Enviar Actualización'}
              </button>

              {session.role === 'executor' && (task.status === 'in_progress' || task.status === 'pending') && (
                <button onClick={() => handleStatusAction('request_closure')} className="w-full px-4 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium">
                  📋 Solicitar Cierre
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Updates History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-800 mb-4">Historial de Actualizaciones</h2>
            {!task.updates || task.updates.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Sin actualizaciones aún</p>
            ) : (
              <div className="space-y-4">
                {task.updates.map((update: any) => (
                  <div key={update.id} className={`p-4 rounded-xl ${update.is_system ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-800">{update.user?.full_name || 'Sistema'}</span>
                          {update.is_system && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Sistema</span>}
                          <span className="text-xs text-gray-400">{new Date(update.timestamp).toLocaleString('es')}</span>
                        </div>
                        <p className="text-sm text-gray-600">{update.comment}</p>
                        {update.hours_spent > 0 && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>⏱️ {update.hours_spent}h</span>
                            <span>{update.time_type === 'office' ? '🏢 Oficina' : '🏠 Fuera'}</span>
                          </div>
                        )}
                        {update.attachment_url && (
                          <div className="mt-2">
                            <a href={update.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              📎 {update.attachment_url.length > 50 ? update.attachment_url.substring(0, 50) + '...' : update.attachment_url}
                            </a>
                            {update.attachment_expires_at && (
                              <WeTransferWarning expiresAt={update.attachment_expires_at} />
                            )}
                          </div>
                        )}
                      </div>
                      {(session.role === 'admin' || session.role === 'assigner') && !update.is_system && (
                        <button onClick={() => handleDeleteUpdate(update.id)} className="text-red-400 hover:text-red-600 text-xs p-1" title="Eliminar">🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeTransferWarning({ expiresAt }: { expiresAt: string }) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffMs < 0) return <span className="text-xs text-gray-400 ml-2">⏰ Link expirado</span>;
  if (diffHours < 24) return <span className="text-xs text-red-600 font-semibold ml-2">⏰ Expira en {diffHours}h</span>;
  const days = Math.floor(diffHours / 24);
  return <span className="text-xs text-orange-500 ml-2">⏰ Expira en {days}d {diffHours % 24}h (máx. 3 días)</span>;
}

// =================== STATISTICS PAGE ===================
function StatisticsPage({ session }: { session: AuthSession }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([statsData, usersData]) => {
      setStats(statsData);
      setUsers(usersData.users?.filter((u: User) => u.role === 'executor') || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetch(`/api/stats?userId=${selectedUserId}`).then(r => r.json()).then(d => setStats((prev: any) => prev ? { ...prev, individualStats: d.individualStats } : null)).catch(() => {});
    } else {
      setStats((prev: any) => prev ? { ...prev, individualStats: null } : null);
    }
  }, [selectedUserId]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return <div className="text-center py-20 text-gray-500">No se pudieron cargar las estadísticas</div>;

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estadísticas</h1>
          <p className="text-gray-500 mt-1">Resumen general y por usuario</p>
        </div>
        <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-xl bg-white">
          <option value="">Vista General</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Tareas', value: stats.overview.totalTasks, icon: '📋', color: 'bg-blue-50 text-blue-700' },
          { label: 'En Progreso', value: stats.overview.inProgressTasks, icon: '🔄', color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Cerradas', value: stats.overview.closedTasks, icon: '✅', color: 'bg-green-50 text-green-700' },
          { label: 'Horas Totales', value: `${stats.overview.totalHours}h`, icon: '⏱️', color: 'bg-purple-50 text-purple-700' },
        ].map((card, i) => (
          <div key={i} className={`${card.color} rounded-xl p-4`}>
            <span className="text-2xl">{card.icon}</span>
            <p className="text-2xl font-bold mt-2">{card.value}</p>
            <p className="text-sm opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      {!selectedUserId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hours by Category */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Horas por Categoría</h3>
            {stats.categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.categoryStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="hours_spent" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Horas" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>

          {/* Hours per User */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Horas por Usuario</h3>
            {stats.userStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.userStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="full_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total_hours" fill="#10B981" radius={[4, 4, 0, 0]} name="Horas Totales" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>

          {/* Office vs Outside */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Oficina vs Fuera de Oficina</h3>
            {(stats.overview.officeHours > 0 || stats.overview.outsideHours > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={[
                    { name: 'Oficina', value: stats.overview.officeHours },
                    { name: 'Fuera', value: stats.overview.outsideHours },
                  ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, value }) => `${name}: ${value}h`}>
                    <Cell fill="#3B82F6" />
                    <Cell fill="#F59E0B" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>

          {/* Tasks closed by category */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Tareas Cerradas por Categoría</h3>
            {stats.categoryStats.filter((c: any) => c.tasks_closed > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.categoryStats.filter((c: any) => c.tasks_closed > 0)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="tasks_closed" fill="#10B981" radius={[4, 4, 0, 0]} name="Tareas Cerradas" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>
        </div>
      ) : stats.individualStats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Hours */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Horas por Día</h3>
            {stats.individualStats.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.individualStats.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="hours" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} name="Horas" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>

          {/* Weekly Hours */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Horas por Semana</h3>
            {stats.individualStats.weekly.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.individualStats.weekly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Horas" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>

          {/* By Category */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Horas por Categoría</h3>
            {stats.individualStats.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={stats.individualStats.byCategory} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="hours" nameKey="category_name" label={({ category_name, hours }) => `${category_name}: ${hours}h`}>
                    {stats.individualStats.byCategory.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-8">Sin datos</p>}
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Resumen del Usuario</h3>
            {(() => {
              const uStats = stats.userStats.find((u: any) => u.user_id === selectedUserId);
              if (!uStats) return <p className="text-gray-400">Sin datos</p>;
              return (
                <div className="space-y-4">
                  {[
                    { label: 'Tareas Completadas', value: uStats.tasks_completed },
                    { label: 'Horas Totales', value: `${uStats.total_hours}h` },
                    { label: 'Horas Oficina', value: `${uStats.office_hours}h` },
                    { label: 'Horas Fuera', value: `${uStats.outside_hours}h` },
                    { label: 'Promedio por Tarea', value: `${uStats.avg_hours_per_task}h` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-bold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <span className="text-5xl mb-4 block">📊</span>
          <p className="text-gray-500">Selecciona un usuario para ver sus estadísticas</p>
        </div>
      )}
    </div>
  );
}

// Import Recharts components
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// =================== ADMIN PAGE ===================
function AdminPage({ session, refresh }: { session: AuthSession; refresh: () => void }) {
  const [tab, setTab] = useState<'users' | 'categories'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const loadData = () => {
    Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([usersData, catsData]) => {
      setUsers(usersData.users || []);
      setCategories(catsData.categories || []);
    }).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateUser = () => { setShowCreateUser(false); loadData(); refresh(); };
  const handleCreateCat = () => { setShowCreateCat(false); loadData(); };

  const handleToggleUserStats = async (userId: string, value: boolean) => {
    await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, can_view_stats: value }) });
    loadData();
  };

  const handleToggleUserCats = async (userId: string, value: boolean) => {
    await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId, can_manage_categories: value }) });
    loadData();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
    loadData(); refresh();
  };

  const handleDeleteCat = async (catId: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await fetch(`/api/categories?id=${catId}`, { method: 'DELETE' });
    loadData();
  };

  const parentCats = categories.filter(c => !c.parent_id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Panel de Administración</h1>
        <p className="text-gray-500 mt-1">Gestiona usuarios, roles y categorías</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('users')} className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${tab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}>
          👥 Usuarios ({users.length})
        </button>
        <button onClick={() => setTab('categories')} className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${tab === 'categories' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'}`}>
          🏷️ Categorías ({categories.length})
        </button>
      </div>

      {tab === 'users' && (
        <div>
          <button onClick={() => setShowCreateUser(true)} className="mb-4 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors">+ Nuevo Usuario</button>
          {showCreateUser && <CreateUserModal users={users} onClose={() => setShowCreateUser(false)} onCreated={handleCreateUser} />}
          {editUser && <EditUserModal users={users} user={editUser} onClose={() => setEditUser(null)} onUpdated={() => { setEditUser(null); loadData(); refresh(); }} />}


          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ver Stats</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gest. Categorías</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white ${user.role === 'admin' ? 'bg-red-500' : user.role === 'assigner' ? 'bg-blue-500' : 'bg-green-500'}`}>
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.full_name}</p>
                          <p className="text-xs text-gray-400">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${user.role === 'admin' ? 'bg-red-100 text-red-700' : user.role === 'assigner' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {user.role === 'assigner' ? 'Asignador' : user.role === 'admin' ? 'Admin' : 'Ejecutor'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={user.can_view_stats} onChange={e => handleToggleUserStats(user.id, e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={user.can_manage_categories} onChange={e => handleToggleUserCats(user.id, e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditUser(user)} className="text-blue-600 hover:text-blue-800 text-sm mr-3 font-medium">Editar</button>
                      <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-600 text-sm">Desactivar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div>
          <button onClick={() => setShowCreateCat(true)} className="mb-4 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors">+ Nueva Categoría</button>
          {showCreateCat && <CreateCategoryModal categories={categories} onClose={() => setShowCreateCat(false)} onCreated={handleCreateCat} />}

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="space-y-3">
              {parentCats.map(parent => (
                <div key={parent.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">📁 {parent.name}</span>
                      <span className="text-xs text-gray-400">({categories.filter(c => c.parent_id === parent.id).length} subcategorías)</span>
                    </div>
                    <button onClick={() => handleDeleteCat(parent.id)} className="text-red-400 hover:text-red-600 text-sm">Eliminar</button>
                  </div>
                  {categories.filter(c => c.parent_id === parent.id).map(child => (
                    <div key={child.id} className="flex items-center justify-between ml-6 mt-2 py-1.5 px-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">📂 {child.name}</span>
                      <button onClick={() => handleDeleteCat(child.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =================== CREATE USER MODAL ===================
function CreateUserModal({ users, onClose, onCreated }: { users: User[]; onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('executor');
  const [canViewStats, setCanViewStats] = useState(false);
  const [canManageCats, setCanManageCats] = useState(false);
  const [canViewAllTasks, setCanViewAllTasks] = useState(false);
  const [assignableUserIds, setAssignableUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, full_name: fullName, role, can_view_stats: canViewStats, can_manage_categories: canManageCats, can_view_all_tasks: canViewAllTasks, assignable_user_ids: assignableUserIds }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); } else { setError(data.error || 'Error'); }
    } catch { setError('Error de conexión'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100"><h2 className="text-xl font-bold">Nuevo Usuario</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label><input value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl" required /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
            <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'assigner' | 'executor')} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl">
              <option value="admin">Administrador</option>
              <option value="assigner">Asignador</option>
              <option value="executor">Ejecutor</option>
            </select>
          </div>
          {role === 'assigner' && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Permisos Opcionales</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canViewStats} onChange={e => setCanViewStats(e.target.checked)} className="rounded" /> Puede ver estadísticas</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canManageCats} onChange={e => setCanManageCats(e.target.checked)} className="rounded" /> Puede gestionar categorías</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canViewAllTasks} onChange={e => setCanViewAllTasks(e.target.checked)} className="rounded text-blue-600" /> <span className="font-medium text-blue-700">Supervisión Global (Ver todas)</span></label>
            </div>
          )}
          {role === 'executor' && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">Delegación (Líder de Equipo)</p>
              <p className="text-xs text-gray-500 mb-2">Selecciona a quién puede asignar tareas este ejecutor:</p>
              <div className="max-h-32 overflow-y-auto space-y-1 bg-white border border-gray-200 rounded-lg p-2">
                {users.length === 0 && <p className="text-xs text-gray-400">No hay otros usuarios</p>}
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={assignableUserIds.includes(u.id)} onChange={e => {
                      if (e.target.checked) setAssignableUserIds([...assignableUserIds, u.id]);
                      else setAssignableUserIds(assignableUserIds.filter(id => id !== u.id));
                    }} className="rounded" />
                    {u.full_name} <span className="text-xs text-gray-400">({u.role})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl disabled:opacity-50">{loading ? 'Creando...' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =================== EDIT USER MODAL ===================
function EditUserModal({ users, user, onClose, onUpdated }: { users: User[]; user: User; onClose: () => void; onUpdated: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState('');
  const [canViewStats, setCanViewStats] = useState(user.can_view_stats || false);
  const [canManageCats, setCanManageCats] = useState(user.can_manage_categories || false);
  const [canViewAllTasks, setCanViewAllTasks] = useState(user.can_view_all_tasks || false);
  const [assignableUserIds, setAssignableUserIds] = useState<string[]>(user.assignable_user_ids || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const payload: any = { id: user.id, full_name: fullName, role, can_view_stats: canViewStats, can_manage_categories: canManageCats, can_view_all_tasks: canViewAllTasks, assignable_user_ids: assignableUserIds };
      if (password.trim() !== '') {
        payload.password = password; // Only send password if user typed a new one
      }
      
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { onUpdated(); } else { setError(data.error || 'Error'); }
    } catch { setError('Error al actualizar'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">Editar Usuario</h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">@{user.username}</span>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label><input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl" required /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
            <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'assigner' | 'executor')} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl">
              <option value="admin">Administrador</option>
              <option value="assigner">Asignador</option>
              <option value="executor">Ejecutor</option>
            </select>
          </div>
          {role === 'assigner' && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Permisos Opcionales</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canViewStats} onChange={e => setCanViewStats(e.target.checked)} className="rounded" /> Puede ver estadísticas</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canManageCats} onChange={e => setCanManageCats(e.target.checked)} className="rounded" /> Puede gestionar categorías</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={canViewAllTasks} onChange={e => setCanViewAllTasks(e.target.checked)} className="rounded text-blue-600" /> <span className="font-medium text-blue-700">Supervisión Global (Ver todas)</span></label>
            </div>
          )}
          {role === 'executor' && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">Delegación (Líder de Equipo)</p>
              <p className="text-xs text-gray-500 mb-2">Selecciona a quién puede asignar tareas este ejecutor:</p>
              <div className="max-h-32 overflow-y-auto space-y-1 bg-white border border-gray-200 rounded-lg p-2">
                {users.filter(u => u.id !== user.id).length === 0 && <p className="text-xs text-gray-400">No hay otros usuarios</p>}
                {users.filter(u => u.id !== user.id).map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm p-1 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" checked={assignableUserIds.includes(u.id)} onChange={e => {
                      if (e.target.checked) setAssignableUserIds([...assignableUserIds, u.id]);
                      else setAssignableUserIds(assignableUserIds.filter(id => id !== u.id));
                    }} className="rounded" />
                    {u.full_name} <span className="text-xs text-gray-400">({u.role})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña <span className="text-gray-400 font-normal">(Opcional)</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Dejar en blanco para no cambiar" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl place" />
            <p className="text-xs text-gray-500 mt-1">Si escribes algo aquí, la contraseña de este usuario cambiará.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl disabled:opacity-50 font-medium">{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


// =================== CREATE CATEGORY MODAL ===================
function CreateCategoryModal({ categories, onClose, onCreated }: { categories: Category[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: parentId || null }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); } else { setError(data.error || 'Error'); }
    } catch { setError('Error'); } finally { setLoading(false); }
  };

  const parentCats = categories.filter(c => !c.parent_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 border-b border-gray-100"><h2 className="text-xl font-bold">Nueva Categoría</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl" required /></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Padre (opcional)</label>
            <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl">
              <option value="">Ninguna (categoría raíz)</option>
              {parentCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl disabled:opacity-50">{loading ? 'Creando...' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
