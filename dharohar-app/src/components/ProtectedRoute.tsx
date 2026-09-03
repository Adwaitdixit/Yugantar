import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AppRole } from '../services/supabaseClient';

interface ProtectedRouteProps {
  allowedRoles: AppRole[];
  children: ReactElement;
  onOpenAuth?: (intent?: 'record' | 'view_data' | 'general') => void;
}

export default function ProtectedRoute({
  allowedRoles,
  children,
  onOpenAuth,
}: ProtectedRouteProps) {
  const { user, role, loading, switchRoleForTesting } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        color: '#FAF8F5',
        fontFamily: 'var(--font-mono)',
      }}>
        <div className="auth-loading-spinner" style={{ width: 32, height: 32 }} />
        <span>Verifying institutional authorization credentials...</span>
      </div>
    );
  }

  // If not authenticated, require sign-in
  if (!user) {
    return (
      <div className="page-enter" style={{
        maxWidth: '560px',
        margin: '80px auto',
        padding: '36px 32px',
        background: 'linear-gradient(165deg, rgba(17, 24, 39, 0.95) 0%, rgba(9, 13, 22, 0.98) 100%)',
        border: '1px solid rgba(224, 109, 68, 0.35)',
        borderRadius: '16px',
        textAlign: 'center',
        color: '#FAF8F5',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔐</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '12px' }}>
          Authentication Required
        </h2>
        <p style={{ color: '#B4BDD4', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '24px' }}>
          This console requires institutional clearance. Please sign in with your authorized email to access review and verification workflows.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => onOpenAuth?.('general')}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Lock size={16} /> Sign In to Access
        </button>
      </div>
    );
  }

  // If authenticated but lacks role
  const isAuthorized = allowedRoles.includes(role);

  if (!isAuthorized) {
    const roleLabels: Record<AppRole, string> = {
      normal_user: 'Normal User',
      contributor: 'Contributor',
      reviewer: 'Reviewer',
      expert: 'Expert Verifier',
      admin: 'National Administrator',
    };

    return (
      <div className="page-enter" style={{
        maxWidth: '620px',
        margin: '80px auto',
        padding: '40px 32px',
        background: 'linear-gradient(165deg, rgba(23, 15, 15, 0.95) 0%, rgba(13, 9, 11, 0.98) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '16px',
        textAlign: 'center',
        color: '#FAF8F5',
        boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#F87171',
        }}>
          <ShieldAlert size={28} />
        </div>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '8px' }}>
          Access Denied: Restricted Clearance
        </h2>
        <div style={{
          fontFamily: 'var(--font-devanagari)',
          color: '#E5C365',
          fontSize: '0.85rem',
          marginBottom: '16px',
        }}>
          अनधिकृत पहुंच निषेध · केवल अधिकृत समीक्षा बोर्ड
        </div>

        <p style={{ color: '#B4BDD4', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '20px' }}>
          Your current authenticated role is <strong>{roleLabels[role] || role}</strong>.
          This console is strictly restricted to users with <strong style={{ color: '#E5C365' }}>{allowedRoles.map(r => roleLabels[r]).join(' or ')}</strong> clearance.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} /> Return to Public Cultural Atlas
          </button>

          {/* Institutional Role Tester for evaluating scenarios A, B, C */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px dashed rgba(229, 195, 101, 0.3)',
            borderRadius: '10px',
            textAlign: 'left',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: '#E5C365',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '10px',
            }}>
              <Sparkles size={13} /> Institutional Role Simulation (Dev/Eval Mode)
            </div>
            <p style={{ fontSize: '0.76rem', color: '#B4BDD4', margin: '0 0 10px' }}>
              Switch active role to verify permissions across the required evaluation scenarios:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(['normal_user', 'contributor', 'reviewer', 'expert', 'admin'] as AppRole[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => switchRoleForTesting(r)}
                  className={`btn btn-sm ${role === r ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.7rem', padding: '4px 10px', fontFamily: 'var(--font-mono)' }}
                >
                  {roleLabels[r]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
