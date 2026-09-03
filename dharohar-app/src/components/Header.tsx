import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Compass, Map, Mic, Cpu, ShieldCheck, ClipboardCheck,
  Menu, X, Wifi, WifiOff, LogIn, LogOut, User as UserIcon,
  Shield, ChevronDown, BookOpen, UserCheck, Camera
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserProfileModal from './UserProfileModal';
import './styles/Header.css';

interface HeaderProps {
  isOnline: boolean;
  onToggleConnectivity: () => void;
  pendingSyncCount: number;
  onOpenAuth: () => void;
}

export default function Header({
  isOnline,
  onToggleConnectivity,
  pendingSyncCount,
  onOpenAuth,
}: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { user, role, isReviewer, isExpert, isAdmin, signOut } = useAuth();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { to: '/', icon: <Compass size={16} />, label: 'Explore', show: true },
    { to: '/map', icon: <Map size={16} />, label: 'Heritage Map', show: true },
    { to: '/contribute', icon: <Mic size={16} />, label: 'Contribute', show: true },
    { to: '/lens', icon: <Camera size={16} />, label: 'Heritage Lens', show: true },
    { to: '/ai-pipeline', icon: <Cpu size={16} />, label: 'AI Pipeline', show: true },
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
            {/* Connectivity Status Indicator */}
            <button
              className={`connectivity-pill ${isOnline ? 'online' : 'offline'}`}
              onClick={onToggleConnectivity}
              title="Click to simulate offline/online toggle"
              id="connectivity-toggle"
            >
              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="connectivity-text">{isOnline ? 'Online' : 'Offline'}</span>
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
                    background: 'linear-gradient(165deg, rgba(17, 24, 39, 0.98) 0%, rgba(9, 13, 22, 0.99) 100%)',
                    border: '1px solid rgba(229, 195, 101, 0.35)',
                    borderRadius: '12px',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7)',
                    padding: '12px',
                    zIndex: 1000,
                    backdropFilter: 'blur(12px)',
                  }}>
                    {/* User Header Info */}
                    <div style={{
                      padding: '8px 10px 12px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      marginBottom: '8px',
                    }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#FAF8F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span className="badge badge-gold" style={{ fontSize: '0.66rem', padding: '1px 6px' }}>
                          {getRoleBadgeLabel(role)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#B4BDD4', fontFamily: 'var(--font-mono)' }}>
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
                        <UserCheck size={14} style={{ color: '#E5C365' }} />
                        <span>Profile Details</span>
                      </button>

                      <button
                        type="button"
                        className="header-dropdown-item"
                        id="menu-my-contributions"
                        onClick={handleOpenMyContributions}
                      >
                        <BookOpen size={14} style={{ color: '#E06D44' }} />
                        <span>My Contributions</span>
                      </button>

                      {isReviewer && (
                        <button
                          type="button"
                          className="header-dropdown-item"
                          onClick={() => { setUserMenuOpen(false); navigate('/reviewer'); }}
                        >
                          <ClipboardCheck size={14} style={{ color: '#E5C365' }} />
                          <span>Reviewer Console</span>
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          className="header-dropdown-item"
                          onClick={() => { setUserMenuOpen(false); navigate('/admin'); }}
                        >
                          <Shield size={14} style={{ color: '#E06D44' }} />
                          <span>Admin Console</span>
                        </button>
                      )}

                      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

                      <button
                        type="button"
                        className="header-dropdown-item logout-item"
                        id="menu-logout-btn"
                        onClick={handleLogout}
                      >
                        <LogOut size={14} style={{ color: '#F87171' }} />
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
                <span>Sign In</span>
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
