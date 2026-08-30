import React, { useState, useEffect } from 'react';
import { Save, Loader2, Server, Database, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

export const MinioSettingsPanel: React.FC = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    endpoint: '',
    port: '9000',
    useSSL: false,
    accessKey: '',
    secretKey: '',
    bucket: 'builddreamer-assets',
    publicUrl: ''
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/settings/minio`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.endpoint) {
          setConfig(data);
        }
      })
      .catch(err => console.error('Error fetching minio config', err));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/settings/minio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Falha ao salvar configurações do MinIO');
      setSuccess('Configurações salvas com sucesso!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-[#121124] rounded-2xl p-6 border border-purple-500/20 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          Configurações do MinIO
        </h2>
        {success && <div className="p-3 bg-emerald-950 text-emerald-300 rounded-lg text-xs">{success}</div>}
        {error && <div className="p-3 bg-rose-950 text-rose-300 rounded-lg text-xs">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Endpoint</label>
            <input type="text" value={config.endpoint} onChange={e => setConfig({...config, endpoint: e.target.value})} className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Porta</label>
            <input type="text" value={config.port} onChange={e => setConfig({...config, port: e.target.value})} className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Access Key</label>
            <input type="text" value={config.accessKey} onChange={e => setConfig({...config, accessKey: e.target.value})} className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Secret Key</label>
            <input type="password" value={config.secretKey} onChange={e => setConfig({...config, secretKey: e.target.value})} className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Bucket</label>
            <input type="text" value={config.bucket} onChange={e => setConfig({...config, bucket: e.target.value})} className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Public URL Base</label>
            <input type="text" value={config.publicUrl} onChange={e => setConfig({...config, publicUrl: e.target.value})} className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 rounded-lg text-white text-sm font-semibold flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
          Salvar Configurações
        </button>
      </div>
    </form>
  );
};
