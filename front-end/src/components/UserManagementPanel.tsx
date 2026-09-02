import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { API_URL, safeJson } from '../config';
import { Users, UserPlus, Shield, Key, Trash2, Edit2, Check, X, Lock, Mail, User as UserIcon, Calendar, AlertTriangle } from 'lucide-react';

interface SystemUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export const UserManagementPanel: React.FC = () => {
  const { token, user: currentUser, isAdmin } = useAuth();
  const { success, error, notify } = useNotification();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4 opacity-50" />
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-slate-400 max-w-md mx-auto">
          Apenas administradores podem gerenciar usuários e permissões do sistema.
        </p>
      </div>
    );
  }

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('USER');

  // Edit states
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('USER');
  const [editPassword, setEditPassword] = useState('');

  // Reset password state
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const activeToken = token || localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const data = await safeJson(res);
      if (res.ok && data.users) {
        setUsers(data.users);
      } else {
        error(data.error || 'Erro ao carregar usuários');
      }
    } catch (err: any) {
      error('Falha de conexão ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      error('Preencha o e-mail e a senha do novo usuário.');
      return;
    }

    try {
      const activeToken = token || localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          password: newPassword,
          role: newRole
        })
      });

      const data = await safeJson(res);
      if (res.ok) {
        success('Usuário criado com sucesso!');
        setShowCreateModal(false);
        setNewEmail('');
        setNewName('');
        setNewPassword('');
        setNewRole('USER');
        fetchUsers();
      } else {
        error(data.error || 'Erro ao criar usuário');
      }
    } catch {
      error('Erro de conexão ao criar usuário');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const payload: any = {
        name: editName,
        role: editRole
      };
      if (editPassword.trim().length > 0) {
        payload.password = editPassword;
      }

      const activeToken = token || localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_URL}/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(res);
      if (res.ok) {
        success('Usuário atualizado com sucesso!');
        setEditingUser(null);
        setEditPassword('');
        fetchUsers();
      } else {
        error(data.error || 'Erro ao atualizar usuário');
      }
    } catch {
      error('Erro de conexão ao atualizar usuário');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!resetPasswordVal || resetPasswordVal.length < 4) {
      error('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    try {
      const activeToken = token || localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_URL}/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ newPassword: resetPasswordVal })
      });

      const data = await safeJson(res);
      if (res.ok) {
        success(data.message || 'Senha redefinida com sucesso!');
        setResettingPasswordId(null);
        setResetPasswordVal('');
      } else {
        error(data.error || 'Erro ao redefinir senha');
      }
    } catch {
      error('Erro de conexão');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const activeToken = token || localStorage.getItem('auth_token') || '';
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const data = await safeJson(res);
      if (res.ok) {
        success('Usuário excluído com sucesso!');
        fetchUsers();
      } else {
        error(data.error || 'Erro ao excluir usuário');
      }
    } catch {
      error('Erro de conexão');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'EDITOR':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'SUPPORT':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'VIEWER':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-all shadow-md cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* Users List Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Membros Registrados ({users.length})</span>
          <button
            onClick={fetchUsers}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
          >
            Atualizar lista
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-secondary)]">Carregando usuários...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-secondary)]">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] bg-[var(--bg-surface)]">
                  <th className="py-3.5 px-4 font-semibold">Nome / E-mail</th>
                  <th className="py-3.5 px-4 font-semibold">Tipo / Função</th>
                  <th className="py-3.5 px-4 font-semibold">Data de Criação</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {users.map((u) => {
                  const isMe = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-[var(--bg-surface)]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-400 flex items-center justify-center font-bold text-xs uppercase border border-purple-500/20">
                            {u.name ? u.name.substring(0, 2) : u.email.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                              {u.name || 'Sem nome'}
                              {isMe && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-normal">Você</span>}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)]">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeColor(u.role)}`}>
                          <Shield className="w-3 h-3" />
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--text-secondary)]">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditName(u.name || '');
                              setEditRole(u.role || 'USER');
                              setEditPassword('');
                            }}
                            className="p-2 rounded-lg hover:bg-purple-600/10 text-[var(--text-secondary)] hover:text-purple-400 transition-colors cursor-pointer"
                            title="Editar dados e permissão"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setResettingPasswordId(u.id);
                              setResetPasswordVal('');
                            }}
                            className="p-2 rounded-lg hover:bg-amber-500/10 text-[var(--text-secondary)] hover:text-amber-400 transition-colors cursor-pointer"
                            title="Redefinir senha"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          {!isMe && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name || u.email)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
                              title="Excluir usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Criar Usuário */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-purple-500" />
                Criar Novo Usuário
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Ana Souza"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">E-mail Profissional *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ana@empresa.com"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Senha de Acesso *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tipo / Função (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                >
                  <option value="USER">USER (Padrão)</option>
                  <option value="EDITOR">EDITOR (Pode criar e editar projetos)</option>
                  <option value="SUPPORT">SUPPORT (Atendimento e CRM)</option>
                  <option value="VIEWER">VIEWER (Apenas visualização)</option>
                  <option value="ADMIN">ADMIN (Administrador completo)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  Criar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuário */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-500" />
                Editar Usuário: {editingUser.email}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tipo / Função (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                >
                  <option value="USER">USER (Padrão)</option>
                  <option value="EDITOR">EDITOR (Pode criar e editar projetos)</option>
                  <option value="SUPPORT">SUPPORT (Atendimento e CRM)</option>
                  <option value="VIEWER">VIEWER (Apenas visualização)</option>
                  <option value="ADMIN">ADMIN (Administrador completo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nova Senha (Opcional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redefinir Senha */}
      {resettingPasswordId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                Redefinir Senha
              </h3>
              <button onClick={() => setResettingPasswordId(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nova Senha</label>
                <input
                  type="text"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setResettingPasswordId(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleResetPassword(resettingPasswordId)}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                >
                  Confirmar Nova Senha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
