import { useState, useEffect, type FormEvent } from 'react';
import { X, Mail, Lock, Sparkles, AlertCircle, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { resetUserPasswordDirect } from '../services/supabaseClient';
import './styles/AuthModal.css';

export type AuthIntent = 'record' | 'view_data' | 'general';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  intent?: AuthIntent;
  customMessage?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  intent = 'general',
  customMessage,
}: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithOtp } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'magic_link' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getHeading = () => {
    if (intent === 'record') return 'Sign In to Record Living Lore';
    if (intent === 'view_data') return 'Sign In to Access Cultural Archives';
    if (mode === 'signup') return 'Create Contributor Account';
    if (mode === 'reset') return 'Set or Reset Account Password';
    return 'Sign In to Dharohar Setu';
  };

  const getSubheading = () => {
    if (customMessage) return customMessage;
    if (intent === 'record') {
      return 'Voice lore preservation and digital provenance require an authenticated contributor email address.';
    }
    if (intent === 'view_data') {
      return 'Please sign in with your email to view complete living lore, oral dialect transcripts, and field evidence.';
    }
    if (mode === 'reset') {
      return 'Update your account password instantly without waiting for rate-limited email links.';
    }
    return 'Preserve and access India’s unbroken cultural knowledge graph.';
  };

  const isRateLimitError = (errText?: string | null) => {
    if (!errText) return false;
    const lower = errText.toLowerCase();
    return lower.includes('rate limit') || lower.includes('over_email_send_rate_limit');
  };

  const formatAuthError = (errText: string) => {
    if (isRateLimitError(errText)) {
      return 'Supabase email dispatch limit reached. Please sign in directly using your email and password — password logins are instant and never hit email limits!';
    }
    return errText;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (!email.trim()) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'magic_link') {
        const { error } = await signInWithOtp(email);
        if (error) {
          setErrorMsg(formatAuthError(error));
        } else {
          setSuccessNotice(`A magic sign-in link has been dispatched to ${email}. Click the link in your email to instantly log in!`);
        }
      } else if (mode === 'reset') {
        if (!password || password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        const res = await resetUserPasswordDirect(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to update password.');
        } else {
          setSuccessNotice(`Password updated successfully for ${email}! You can now sign in.`);
          setMode('signin');
        }
      } else if (mode === 'signin') {
        if (!password) {
          setErrorMsg('Please enter your password.');
          setIsSubmitting(false);
          return;
        }
        const { error } = await signInWithEmail(email, password);
        if (error) {
          setErrorMsg(formatAuthError(error));
        } else {
          onSuccess?.();
          onClose();
        }
      } else {
        // signup
        if (!password || password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        const { error, needsConfirmation } = await signUpWithEmail(email, password);
        if (error) {
          setErrorMsg(formatAuthError(error));
        } else if (needsConfirmation) {
          setSuccessNotice(`Registration received! A confirmation link was sent to ${email}. Please confirm to complete login, or sign in if confirmation is not required.`);
        } else {
          onSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err.message || 'An unexpected authentication error occurred.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="auth-modal-header">
          <div className="auth-motif">🏛️</div>
          <div className="auth-brand-sub text-devanagari">धरोहर सेतु · राष्ट्रीय सांस्कृतिक अभिलेखागार</div>
          <h2 className="auth-modal-title">{getHeading()}</h2>
          <p className="auth-modal-desc">{getSubheading()}</p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setErrorMsg(null); setSuccessNotice(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setErrorMsg(null); setSuccessNotice(null); }}
          >
            Register
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'magic_link' ? 'active' : ''}`}
            onClick={() => { setMode('magic_link'); setErrorMsg(null); setSuccessNotice(null); }}
          >
            Magic Link
          </button>
          {mode === 'reset' && (
            <button
              type="button"
              className="auth-tab active"
            >
              Reset Password
            </button>
          )}
        </div>

        {/* Magic Link Advisory Banner */}
        {mode === 'magic_link' && (
          <div style={{
            fontSize: '0.78rem',
            color: '#E5C365',
            background: 'rgba(229, 195, 101, 0.08)',
            border: '1px solid rgba(229, 195, 101, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            lineHeight: 1.5,
          }}>
            ⚡ <strong>Instant Login Recommendation:</strong> If you already created an account with a password, switch to <strong>Sign In</strong> to log in immediately without waiting for emails or hitting Supabase mail limits.
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="auth-alert error" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
            {isRateLimitError(errorMsg) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                  }}
                  style={{
                    background: '#E06D44',
                    color: '#FAF8F5',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  👉 Switch to Sign In with Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setErrorMsg(null);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#FAF8F5',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  Set / Reset Password
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success Alert */}
        {successNotice && (
          <div className="auth-alert success">
            <CheckCircle2 size={16} />
            <span>{successNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="auth-email">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="auth-email"
                type="email"
                required
                placeholder="your.email@heritage.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {mode !== 'magic_link' && (
            <div className="auth-field">
              <div className="auth-field-header">
                <label htmlFor="auth-password">
                  {mode === 'reset' ? 'New Password (min 6 chars)' : 'Password'}
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => { setMode('reset'); setErrorMsg(null); }}
                  >
                    Forgot or need password?
                  </button>
                )}
              </div>
              <div className="auth-input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={
                    mode === 'signup' ? 'Create a secure password (min 6 chars)' :
                    mode === 'reset' ? 'Enter your new password (min 6 chars)' :
                    'Enter your password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowPassword(p => !p)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <KeyRound size={14} />
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-loading-spinner" />
            ) : (
              <>
                <span>
                  {mode === 'signin' ? 'Sign In with Email' :
                   mode === 'signup' ? 'Create Contributor Account' :
                   mode === 'reset' ? 'Update & Set Password' :
                   'Send Magic Sign-In Link'}
                </span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-modal-footer">
          <div className="auth-footer-badge">
            <Sparkles size={13} style={{ color: 'var(--accent, #E5C365)' }} />
            <span>Encrypted &amp; Safeguarded by Supabase Cloud Authentication</span>
          </div>
          <p className="auth-guest-note">
            Guest visitors can freely view maps, summaries, and telemetry. Authentication is required only for field recordings and full archival documentation.
          </p>
        </div>
      </div>
    </div>
  );
}
