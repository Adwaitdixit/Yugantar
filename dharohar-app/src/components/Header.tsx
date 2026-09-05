import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Compass, Map, Mic, Cpu, ShieldCheck, ClipboardCheck,
  Menu, X, Wifi, WifiOff, LogIn, LogOut, User as UserIcon,
  Shield, ChevronDown, BookOpen, UserCheck, Camera, Sun, Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/I18nContext';
import { languageNames, type LanguageKey } from '../locales/translations';
import UserProfileModal from './UserProfileModal';
import './styles/Header.css';

interface HeaderProps {
  isOnline: boolean;
  onToggleConnectivity: () => void;
  pendingSyncCount: number;
  onOpenAuth: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Header({
  isOnline,
  onToggleConnectivity,
  pendingSyncCount,
  onOpenAuth,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const navigate = useNavigate();

  const { user, role, isReviewer, isExpert, isAdmin, signOut } = useAuth();
  const { t, language, setLanguage } = useTranslation();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { to: '/', icon: <Compass size={16} />, label: t('nav.explore'), show: true },
    { to: '/map', icon: <Map size={16} />, label: t('nav.heritageMap'), show: true },
    { to: '/contribute', icon: <Mic size={16} />, label: t('nav.contribute'), show: true },
    { to: '/lens', icon: <Camera size={16} />, label: t('nav.heritageLens'), show: true },
    { to: '/ai-pipeline', icon: <Cpu size={16} />, label: 'SATYA VERIFICATION', show: true },
    { to: '/about', icon: <BookOpen size={16} />, label: t('nav.aboutUs'), show: true },
    { to: '/verification', icon: <ShieldCheck size={16} />, label: 'Verification', show: isExpert || isAdmin },
    { to: '/reviewer', icon: <ClipboardCheck size={16} />, label: 'Reviewer', show: isReviewer },
    { to: '/admin', icon: <Shield size={16} />, label: 'Admin', show: isAdmin },
  ].filter(item => item.show);

  const formatUserEmail = (email?: string) => {
    if (!email) return 'User';
    const name = email.split('@')[0];
    return name.length > 12 ? name.substring(0, 10) + '...' : name;
  };

  const getRoleBadgeLabel = (r: string) => {
    switch (r) {
      case 'admin': return 'Admin';
      case 'expert': return 'Expert';
      case 'reviewer': return 'Reviewer';
      case 'contributor': return 'Contributor';
      default: return 'User';
    }
  };

  const handleOpenMyContributions = () => {
    setUserMenuOpen(false);
    navigate('/contribute');
    setTimeout(() => {
      const queueEl = document.getElementById('pending-queue');
      if (queueEl) {
        queueEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await signOut();
  };

  return (
    <>
      <header className="header" id="main-header">
        <div className="header-inner">
          <NavLink to="/" className="header-brand" id="brand-link">
            <div className="brand-icon">🏛️</div>
            <div className="brand-text">
              <span className="brand-english">Dharohar Setu</span>
              <span className="brand-hindi text-devanagari">धरोहर सेतु</span>
            </div>
          </NavLink>

          <nav className={`header-nav ${mobileOpen ? 'open' : ''}`} id="main-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--surface-container)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Language Selector */}
            <div ref={langMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '16px',
                  background: 'var(--surface-container)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
                aria-label="Select Language"
              >
                🌐 {language.toUpperCase()} <ChevronDown size={14} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: langMenuOpen ? 'rotate(180deg)' : 'none' }} />
              </button>

              {langMenuOpen && (
                <div className="page-enter" style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '180px',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  zIndex: 1000,
                  backdropFilter: 'blur(12px)',
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px', marginBottom: '4px' }}>
                    Choose Language
                  </div>
                  {(Object.entries(languageNames) as [LanguageKey, string][]).map(([key, name]) => (
                    <button
                      key={key}
                      onClick={() => { setLanguage(key); setLangMenuOpen(false); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 12px',
                        background: language === key ? 'var(--surface-bright)' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: language === key ? 'var(--primary)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: language === key ? 600 : 400,
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '14px', display: 'inline-block' }}>{language === key ? '✓' : ''}</span>
                      <span>🇮🇳 {name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Connectivity Status Indicator */}
            <button
              className={`connectivity-pill ${isOnline ? 'online' : 'offline'}`}
              onClick={onToggleConnectivity}
              title="Click to simulate offline/online toggle"
              id="connectivity-toggle"
            >
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="connectivity-text">{isOnline ? t('nav.online') : t('nav.offline')}</span>
              {pendingSyncCount > 0 && (
                <span className="sync-badge">{pendingSyncCount}</span>
              )}
            </button>

            {/* Authenticated User Menu or Guest Sign In */}
            {user ? (
              <div className="header-user-container" ref={userMenuRef} style={{ position: 'relative' }}>
                <div
                  className="header-user-pill"
                  id="user-profile-menu-trigger"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  title={`Click to view Profile & Menu (${user.email})`}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div className="user-avatar-circle">
                    <UserIcon size={12} />
                  </div>
                  <span className="user-email-text">{formatUserEmail(user.email)}</span>
                  <span style={{
                    fontSize: '0.62rem',
                    fontFamily: 'var(--font-mono)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isAdmin ? 'rgba(224, 109, 68, 0.25)' : isReviewer || isExpert ? 'rgba(229, 195, 101, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                    color: isAdmin ? '#E06D44' : isReviewer || isExpert ? '#E5C365' : '#B4BDD4',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {getRoleBadgeLabel(role)}
                  </span>
                  <ChevronDown size={12} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} />
                </div>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="header-user-dropdown page-enter" id="header-user-dropdown" style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '260px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '12px',
                    zIndex: 1000,
                    backdropFilter: 'blur(12px)',
                  }}>
                    {/* User Header Info */}
                    <div style={{
                      padding: '8px 10px 12px',
                      borderBottom: '1px solid var(--border-light)',
                      marginBottom: '8px',
                    }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span className="badge badge-gold" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>
                          {getRoleBadgeLabel(role)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ID: {user.id.substring(0, 8)}...
                        </span>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        type="button"
                        className="header-dropdown-item"
                        id="menu-open-profile"
                        onClick={() => { setUserMenuOpen(false); setProfileModalOpen(true); }}
                      >
                        <UserCheck size={14} style={{ color: 'var(--gold-light)' }} />
                        <span>Profile Details</span>
                      </button>

                      <button
                        type="button"
                        className="header-dropdown-item"
                        id="menu-my-contributions"
                        onClick={handleOpenMyContributions}
                      >
                        <BookOpen size={14} style={{ color: 'var(--primary)' }} />
                        <span>My Contributions</span>
                      </button>

                      {isReviewer && (
                        <button
                          type="button"
                          className="header-dropdown-item"
                          onClick={() => { setUserMenuOpen(false); navigate('/reviewer'); }}
                        >
                          <ClipboardCheck size={14} style={{ color: 'var(--gold-light)' }} />
                          <span>Reviewer Console</span>
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          className="header-dropdown-item"
                          onClick={() => { setUserMenuOpen(false); navigate('/admin'); }}
                        >
                          <Shield size={14} style={{ color: 'var(--primary)' }} />
                          <span>Admin Console</span>
                        </button>
                      )}

                      <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />

                      <button
                        type="button"
                        className="header-dropdown-item logout-item"
                        id="menu-logout-btn"
                        onClick={handleLogout}
                      >
                        <LogOut size={14} style={{ color: 'var(--error)' }} />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="header-signin-btn"
                onClick={onOpenAuth}
                id="header-signin-button"
              >
                <LogIn size={14} />
                <span>{t('nav.signIn')}</span>
              </button>
            )}

            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              id="mobile-menu-toggle"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}
