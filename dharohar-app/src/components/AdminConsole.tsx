import { useState, useEffect } from 'react';
import { Users, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllUsersWithRoles, updateUserRole, type AppRole } from '../services/supabaseClient';
import { useCulturalRecords } from '../data/culturalStore';
import './styles/ReviewerConsole.css';

export default function AdminConsole() {
  const { user, role, switchRoleForTesting } = useAuth();
  const allRecords = useCulturalRecords();
  const [usersList, setUsersList] = useState<{ userId: string; role: AppRole; createdAt: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const data = await fetchAllUsersWithRoles();
    setUsersList(data);
    setLoadingUsers(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (targetUserId: string, newRole: AppRole) => {
    setUpdatingUserId(targetUserId);
    setStatusMessage(null);
    const ok = await updateUserRole(targetUserId, newRole);
    if (ok) {
      setStatusMessage(`Successfully updated user permissions to "${newRole}".`);
      setUsersList(prev => prev.map(u => u.userId === targetUserId ? { ...u, role: newRole } : u));
    } else {
      setStatusMessage('Failed to update role in database.');
    }
    setUpdatingUserId(null);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const roleLabels: Record<AppRole, string> = {
    normal_user: 'Normal User',
    contributor: 'Contributor',
    reviewer: 'Reviewer',
    expert: 'Expert Verifier',
    admin: 'National Administrator',
  };

  return (
    <div className="reviewer-page page-enter" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div className="reviewer-header" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ornament" style={{ fontSize: '1.8rem' }}>🛡️</div>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.8rem' }}>
              National Heritage Registry — Administrative Console
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              Institutional Governance, Role-Based Access Control (RBAC) &amp; Security Auditing
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-gold" style={{ fontFamily: 'var(--font-mono)' }}>
            Admin Session: {user?.email}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 8,
          background: 'rgba(45, 212, 191, 0.12)',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          color: '#5EEAD4',
          fontSize: '0.84rem',
          fontFamily: 'var(--font-mono)',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Check size={16} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid of System Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Total Catalogued Records
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            {allRecords.length}
          </div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Published Traditions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--sage-dark)', marginTop: 4 }}>
            {allRecords.filter(r => (r.lifecycleStatus || 'published') === 'published').length}
          </div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Awaiting Review
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', marginTop: 4 }}>
            {allRecords.filter(r => r.lifecycleStatus === 'submitted' || r.lifecycleStatus === 'under_review').length}
          </div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            Registered Users
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
            {usersList.length || 1}
          </div>
        </div>
      </div>

      {/* Role Management Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 14,
        padding: 24,
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Role-Based Access Control (RBAC) Management</h3>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={loadUsers} disabled={loadingUsers}>
            {loadingUsers ? 'Refreshing...' : 'Refresh Users'}
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Manage clearance levels across institutional reviewers, expert scholars, and community contributors. Roles are enforced via Supabase PostgreSQL Row Level Security (RLS).
        </p>

        {usersList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            No registered users found in the database yet. New accounts automatically receive <code>normal_user</code> clearance.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <th style={{ padding: '12px 16px' }}>User ID</th>
                  <th style={{ padding: '12px 16px' }}>Current Role</th>
                  <th style={{ padding: '12px 16px' }}>Registered At</th>
                  <th style={{ padding: '12px 16px' }}>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {u.userId === user?.id ? `${u.userId} (You)` : u.userId}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${u.role === 'admin' ? 'badge-terracotta' : u.role === 'reviewer' || u.role === 'expert' ? 'badge-gold' : 'badge-sage'}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={u.role}
                        disabled={updatingUserId === u.userId}
                        onChange={(e) => handleRoleChange(u.userId, e.target.value as AppRole)}
                        style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid var(--border-light)',
                          color: '#FAF8F5',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <option value="normal_user">Normal User</option>
                        <option value="contributor">Contributor</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="expert">Expert</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Testing Console for Test Scenarios A, B, C */}
      <div style={{
        background: 'rgba(224, 109, 68, 0.08)',
        border: '1px dashed rgba(224, 109, 68, 0.4)',
        borderRadius: 14,
        padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>
            Authorization Test Switcher (Evaluation Mode)
          </h4>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Quickly switch the current session role to execute and demonstrate <strong>Test A (Normal User)</strong>, <strong>Test B (Reviewer)</strong>, and <strong>Test C (Admin)</strong>:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(['normal_user', 'contributor', 'reviewer', 'expert', 'admin'] as AppRole[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => switchRoleForTesting(r)}
              className={`btn btn-sm ${role === r ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}
            >
              {roleLabels[r]} {role === r ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
