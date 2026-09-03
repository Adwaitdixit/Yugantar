import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User as UserIcon, Shield, LogOut, CheckCircle2, FileText, ChevronRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCulturalRecords } from '../data/culturalStore';
import type { AppRole } from '../services/supabaseClient';
import './styles/AuthModal.css';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, role, signOut, isReviewer, isExpert, isAdmin } = useAuth();
  const navigate = useNavigate();
  const allRecords = useCulturalRecords();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  // Compute user contributions & drafts
  const userRecords = allRecords.filter(r => {
    if (r.id.startsWith('ICH0') || r.id.startsWith('ICH-')) return false;
    return r.contributor === user.email || (r as any).user_id === user.id || (r as any).contributor_email === user.email;
  });

  const draftsCount = userRecords.filter(r => r.lifecycleStatus === 'draft').length;
  const submissionsCount = userRecords.filter(r => r.lifecycleStatus !== 'draft').length;

  const roleLabels: Record<AppRole, string> = {
    normal_user: 'Normal Contributor',
    contributor: 'Community Contributor',
    reviewer: 'Reviewer Council Member',
    expert: 'Expert Verifier',
    admin: 'National Registry Administrator',
  };

  const handleOpenMyContributions = () => {
    onClose();
    navigate('/contribute');
    setTimeout(() => {
      const queueEl = document.getElementById('pending-queue');
      if (queueEl) {
        queueEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  const handleLogout = async () => {
    onClose();
    await signOut();
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} id="profile-modal-overlay">
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: '520px', padding: '32px' }}
      >
        <button
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close profile modal"
        >
          <X size={20} />
        </button>

        <div className="auth-modal-header" style={{ marginBottom: '24px' }}>
          <div className="auth-motif">🏛️</div>
          <div className="auth-brand-sub text-devanagari">धरोहर सेतु · राष्ट्रीय सांस्कृतिक अभिलेखागार</div>
          <h2 className="auth-modal-title" style={{ fontSize: '1.45rem' }}>
            Contributor Identity &amp; Profile
          </h2>
          <p className="auth-modal-desc">
            Authenticated profile safeguarded under Supabase National Cultural Infrastructure.
          </p>
        </div>

        {/* User Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(229, 195, 101, 0.25)',
          borderRadius: '12px',
          padding: '18px 20px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #E06D44 0%, #D4AF37 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#090D16',
              fontWeight: 800,
              fontSize: '1.1rem',
              flexShrink: 0,
            }}>
              <UserIcon size={22} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                color: '#FAF8F5',
                fontWeight: 700,
                fontSize: '1.05rem',
                fontFamily: 'var(--font-mono)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '2px 8px', textTransform: 'uppercase' }}>
                  {roleLabels[role] || role}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#5EEAD4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> Verified
                </span>
              </div>
            </div>
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: '#B4BDD4',
            fontFamily: 'var(--font-mono)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8E9BB5' }}>Contributor UID:</span>
              <span style={{ color: '#FAF8F5', letterSpacing: '0.5px' }}>
                {user.id.substring(0, 16)}...
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8E9BB5' }}>Account Active Since:</span>
              <span style={{ color: '#FAF8F5' }}>
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Session'}
              </span>
            </div>
          </div>
        </div>

        {/* Contributions Summary Card */}
        <div style={{
          background: 'rgba(224, 109, 68, 0.06)',
          border: '1px solid rgba(224, 109, 68, 0.2)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#E06D44', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              My Living Lore Registry
            </div>
            <div style={{ fontSize: '0.9rem', color: '#FAF8F5', marginTop: '4px', fontWeight: 600 }}>
              {submissionsCount} Submitted · {draftsCount} Drafts
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleOpenMyContributions}
            style={{ fontSize: '0.74rem', padding: '6px 12px', gap: '4px' }}
          >
            <span>My Contributions</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isReviewer && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { onClose(); navigate('/reviewer'); }}
              style={{ justifyContent: 'center', gap: '8px' }}
            >
              <FileText size={15} /> Open Reviewer Console
            </button>
          )}

          {isExpert && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { onClose(); navigate('/verification'); }}
              style={{ justifyContent: 'center', gap: '8px' }}
            >
              <ShieldCheck size={15} /> Open Expert Verification Workbench
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { onClose(); navigate('/admin'); }}
              style={{ justifyContent: 'center', gap: '8px' }}
            >
              <Shield size={15} /> Open Administrative Dashboard
            </button>
          )}

          <button
            type="button"
            className="btn btn-lg"
            onClick={handleLogout}
            id="profile-logout-btn"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#FCA5A5',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              fontWeight: 600,
            }}
          >
            <LogOut size={16} /> Log Out of Dharohar Setu
          </button>
        </div>
      </div>
    </div>
  );
}
