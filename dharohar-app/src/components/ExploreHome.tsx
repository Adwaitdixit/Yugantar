import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, ChevronDown, ArrowRight, AlertTriangle, Mic, Map, Landmark,
  Building2, Sparkles, Compass, HeartHandshake, BookOpen
} from 'lucide-react';
import { useCulturalRecords } from '../data/culturalStore';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_CONFIG, VERIFICATION_CONFIG, type RecordCategory, type CulturalRecord } from '../data/types';
import './styles/ExploreHome.css';

interface ExploreHomeProps {
  onViewRecord: (record: CulturalRecord) => void;
  onOpenAuth?: (intent: 'record' | 'view_data' | 'general') => void;
}

/* ── Curated High-Fidelity Living Chronicles from Stitch Project ── */
const CURATED_SHOWCASE_STORIES = [
  {
    id: 'warli-murals',
    title: 'Warli Wall Murals & Cosmic Tarpa',
    region: 'DAHANU • MAHARASHTRA',
    category: 'Crafts & Oral Traditions',
    description: 'Elder artisans painting with rice paste and geru earth on mud plaster in Dahanu, invoking the sacred circle where animals, ancestors, and villagers dance in cosmic synchronization.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTKGBOJAtUNXKaXvDgTkhMpujiGj15de5OMrV3XkO2Bko3mN7AtCOulXxjAhmbqFnRxLc93MIxe3paIHQMcNTtnlKBsvMxzPk5cCQCMBwf536A1NzvhAHKAP7oXAWthQSkRu5BS5lCrVCaT1GaGWQ6KTEOCyy8bBOcVlg5wycK9CpeHMJVyGut3R_LA033sQlraXcW5SjYwnO6qfWj4SPulfPpUntm_xge7-sgW2XclTYA3mCBTDEn',
    bearers: '340 Living Bearers',
    audioTag: 'Tarpa Drone (0:42)',
    matchingRecordId: 'REC-001',
  },
  {
    id: 'ajrakh-indigo',
    title: 'The 16-Stage Ajrakh Indigo Bath',
    region: 'DHAMADKA • KUTCH',
    category: 'Sacred Weaves & Dyes',
    description: 'Master dyers dipping hand-carved teak blocks into river vats in Kutch. Pomegranate rinds, camel dung, and ferric rust harmonize across sixteen exacting alchemical washes.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAIix_ZXP8FoTJvYAwSQUu_6xd4iySRL33W1MhwPOrpnxmp0HlQ26hwyM-GxyayKeEUWPpLCL5630IsqRZA_Qqlp2fv4-2ArBgsCnICyNgxfs5CM57_r8e4P0xw7o_3_0o7i8xNYQxFvLk-p-x07TLg7PFcvxGG7bjdQHrCtyZGQSOAJA9UBgYJrMrtxtkKFAEV3YfluNr5vb0q6wUEORVL_bKlgHBylN8VCbneWLMfWjf06d8iZk3',
    bearers: '12 Master Dynasties',
    audioTag: 'Loom Shuttle Rhythm',
    matchingRecordId: 'REC-007',
  },
  {
    id: 'temple-cuisine',
    title: '8-Century Flame of Temple Cuisine',
    region: 'UDUPI • KARNATAKA',
    category: 'Ancestral Foodways',
    description: 'Ancient woodsmoke and copper vessel culinary recipes unwritten, codified strictly by scent, palm salt measures, and unbroken hearth fires burning since the 13th century.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-8soYpmrWQSr0fb6kNqo1hLbE3z7mDa5P6YEqwF7_uGIvgLiyZy5A9scUlsOHcSOw8GUco5ayrvVPktrLi1NMcEZ_z-UE6fR_G2vVLEV8e2H-rtx1kHMeO-zFpZWP8_p_YAYbS24Vdu0RxhpkKS19q-aU8sKWBKvAijQZqnscMZddWGbb2hSm1mhGGOS2WFuyiINhRA3L6YKjM_sximzzC4VDu95zbJFsNGI03G-zm2F5CVccn7pe',
    bearers: 'Continuous Since 1240',
    audioTag: 'Temple Hearth Lore',
    matchingRecordId: 'REC-006',
  },
  {
    id: 'baul-chant',
    title: 'The Moner Manush Oral Chants',
    region: 'BIRBHUM • WEST BENGAL',
    category: 'UNESCO Representative ICH',
    description: 'Baul wanderers singing mystic oral philosophy in Birbhum saffron robes, carrying luminous treatises without ink or manuscripts across generations along rural red clay roads.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuf1xEkazriDIhHL3RjDE5hGq89PN1R2hWJgFU-Z5eGBd9J7Ju-Bnb7Q8ZTUACQSUfYEOC6sCfU9eK6HU9MYfUhrZGHzP2wZ9V4iBhJQn2JhvnrmLQbyqU5ILSeOqfpwTkM7A1jYyfMl90kts2jK_JR6sLj2T_9NhwUWeVzkZttKEy5NWOH9n_FoZ05OFl55rngSSmDtd0CwHZlCgR9FWEOgLGecMh3nDh8UIBonyu9vx3FrEycXav',
    bearers: 'UNESCO Inscribed (2008)',
    audioTag: 'Ektara River Hymn (1:12)',
    matchingRecordId: 'ICH-004',
  },
  {
    id: 'panchavadyam-pulse',
    title: '200-Drum Acoustic Resonance',
    region: 'THRISSUR • KERALA',
    category: 'Sacred Acoustics & Rhythm',
    description: 'Panchavadyam rhythm pyramids: five acoustic orchestral instruments (timila, maddalam, edakka, ilathalam, and kombu) vibrating ancient temple stones in complex escalating micro-beat mathematics.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD-rZGbUFLoUnbpUIx2Lc1oYtAhpLUVy9PsLU1K3u0svPJPwB7eUM-tPTWCpiWre30qursYsBIqh0QvhM0TJmNP2IgLZ2Ig0SZz6sDsIDWyvyzMxLMLo9cixP9QScCTV1MQu9kietx2pDh0F9KP4uXHbvVlxmzPBiN8Ne0qS3xYJRF8QP6iYhyT6qGwKmTJE3FZGSHKJMfNWRsLZ-num8tJJnTIuWUXf4dzEB-ByndbcF7JHC5yNJB3',
    bearers: 'Sub-harmonic: 32Hz',
    audioTag: 'Percussion Climax (0:58)',
    matchingRecordId: 'REC-004',
  },
];

/* ── 6 Epigraphic Spheres from Stitch Design System ── */
const EPIGRAPHIC_SPHERES: {
  emoji: string;
  title: string;
  count: string;
  categoryKey: RecordCategory;
  description: string;
}[] = [
  {
    emoji: '🏛',
    title: 'Architecture & Sacred Geometry',
    count: '1,240 Sites',
    categoryKey: 'heritage_site',
    description: 'Vastu Purusha mandalas, monolithic rock-cut cave temples of Ellora, stepped stepwells of Gujarat, and Himalayan wooden pagoda shrines.',
  },
  {
    emoji: '🎭',
    title: 'Performing Arts & Rhythm',
    count: '892 Ensembles',
    categoryKey: 'folk_song',
    description: 'Koodiyattam Sanskrit dramaturgical canon, Yakshagana all-night open-air epics, Sattriya monastic dances, and Kalbelia serpentine spirals.',
  },
  {
    emoji: '🧵',
    title: 'Crafts & Metallurgy',
    count: '1,150 Guilds',
    categoryKey: 'craft_weave',
    description: 'Aranmula metal mirrors, Swamimalai lost-wax bronze shilpa, Patan double-ikat looms, Bidriware silver inlays, and Bastar Dhokra castings.',
  },
  {
    emoji: '🍛',
    title: 'Cuisine & Ancestral Foodways',
    count: '430 Recipes',
    categoryKey: 'traditional_recipe',
    description: 'Microbial fermentation technologies of the Eastern Himalayas, stone-ground Chettinad spices, Wazwan culinary science, and seasonal Ayurvedic pairings.',
  },
  {
    emoji: '🪔',
    title: 'Festivals & Lunar Cycles',
    count: '429 Cycles',
    categoryKey: 'ritual_tradition',
    description: 'Kumbh celestial river confluence alignments, Ladakh Hemis Cham monastic masked circles, Bastar Dussehra chariot builds, and agrarian harvest rites.',
  },
  {
    emoji: '📖',
    title: 'Oral Lore, Epics & Dialects',
    count: '680 Voices',
    categoryKey: 'oral_story',
    description: 'Vedic chanting recitation phonetics preserved sans script, Pabuji Ki Phad scroll balladeers, Apatani genealogy chants, and endangered island dialects.',
  },
];

/* ── 6-Step Visual Contribution Journey ── */
const CONTRIBUTION_JOURNEY_STEPS = [
  { num: '01', icon: '🎙️', title: 'Record', text: 'Capture oral cadence, folk verses, song, or dialect.' },
  { num: '02', icon: '📝', title: 'Describe', text: 'Tell the lineage, memory, and cultural story behind it.' },
  { num: '03', icon: '📍', title: 'Locate', text: 'Pin community coordinates or sacred site boundaries.' },
  { num: '04', icon: '⚡', title: 'Offline Submit', text: 'Saved locally; syncs seamlessly even on 2G signals.' },
  { num: '05', icon: '🛡️', title: 'Peer Verify', text: 'Community elders and institutional scholars validate.' },
  { num: '06', icon: '🏛️', title: 'Preserve', text: 'Immutable addition to the National Living Cultural Atlas.' },
];

export default function ExploreHome({ onViewRecord, onOpenAuth }: ExploreHomeProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const culturalRecords = useCulturalRecords();

  const handleNavigateContribute = () => {
    if (!user) {
      onOpenAuth?.('record');
    } else {
      navigate('/contribute');
    }
  };
  const [activeCategory, setActiveCategory] = useState<RecordCategory | 'all' | 'ignca' | 'unesco'>('all');

  const publishedRecords = culturalRecords.filter(r => !r.lifecycleStatus || r.lifecycleStatus === 'published');
  const igncaRecords = publishedRecords.filter(r => r.id.startsWith('ICH0'));
  const unescoRecords = publishedRecords.filter(r => r.id.startsWith('ICH-'));
  const communityRecords = publishedRecords.filter(r => !r.id.startsWith('ICH0') && !r.id.startsWith('ICH-'));

  const filtered = activeCategory === 'all'
    ? publishedRecords
    : activeCategory === 'ignca'
    ? igncaRecords
    : activeCategory === 'unesco'
    ? unescoRecords
    : publishedRecords.filter(r => r.category === activeCategory);

  const endangered = publishedRecords.filter(r => r.isEndangered);

  const handleSelectSphere = (categoryKey: RecordCategory) => {
    setActiveCategory(categoryKey);
    const element = document.getElementById('cultural-stream');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenCuratedStory = (matchingRecordId: string) => {
    const record = culturalRecords.find(r => r.id === matchingRecordId);
    if (record) {
      onViewRecord(record);
    } else {
      navigate('/map');
    }
  };

  return (
    <div className="page-enter" id="explore-page">
      {/* ── 1. Hero Section with Stitch Panoramic Visual & Ambient Particles ── */}
      <section className="hero-section" id="hero">
        {/* Stitch High-Fidelity Heritage Panorama Background */}
        <div className="hero-bg-media">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMHOknZpMC-9Ylr2DweNRa_BCQsTdV-hLomBVIxfWJv21sO-veMs7yHA2BSkLuqgG3wNwQD_PiTkWcbQmInJNYMAVmOS1KidVOEH0-AWP1ilXA8TcmxH_W4dVnCmJ6x-H1Vh83UPwsFU_UCfki_YNnsvguWeUYDCh6RNFtir0HYBTc66j-sbeRpED92HZlgSGqx9CJ0jtVt7Iic2gQNj4t5wZHOOAcevmQg8Np-0ZumFnD-7mD0QAQ"
            alt="Living Indian Cultural Heritage Panorama"
          />
        </div>
        <div className="hero-bg-pattern" />

        {/* Ambient Golden Dust Motes */}
        <div className="particle" style={{ width: 6, height: 6, top: '25%', left: '15%', animationDelay: '0s' }} />
        <div className="particle" style={{ width: 8, height: 8, top: '35%', right: '20%', animationDelay: '1.5s' }} />
        <div className="particle" style={{ width: 5, height: 5, bottom: '30%', left: '30%', animationDelay: '3s' }} />
        <div className="particle" style={{ width: 7, height: 7, top: '50%', right: '12%', animationDelay: '2.2s' }} />
        <div className="particle" style={{ width: 6, height: 6, bottom: '22%', right: '35%', animationDelay: '4s' }} />

        <div className="hero-content">
          <div className="hero-badge">
            <span />
            DISCOVER • PRESERVE • VERIFY IN REAL TIME
          </div>
          <h1 className="hero-title">
            DISCOVER INDIA’S <br />
            <span className="accent">LIVING HERITAGE</span>
          </h1>
          <p className="hero-subtitle-native text-devanagari">
            धरोहर सेतु — भारत का जीवित सांस्कृतिक एवं धरोहर मानचित्र
          </p>
          <p className="hero-description">
            India’s heritage is not frozen behind museum glass. It lives in the breath of oral chants,
            the pressure of block-printer hands, woodsmoke in temple kitchens, and the unbroken memory of living communities.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/map')}>
              <Map size={20} />
              Explore Heritage Map ↓
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={handleNavigateContribute}
            >
              <Mic size={20} />
              Contribute Your Story
            </button>
          </div>

          {/* Quick Indicator Chips */}
          <div className="hero-quick-indicators">
            {EPIGRAPHIC_SPHERES.map((sphere) => (
              <button
                key={sphere.title}
                className="hero-quick-indicator-chip"
                onClick={() => handleSelectSphere(sphere.categoryKey)}
              >
                <span>{sphere.emoji}</span>
                <span>{sphere.title.split('&')[0].trim()}</span>
              </button>
            ))}
          </div>

          {/* Scroll Down Hint (Flows cleanly below chips with zero overlap) */}
          <div
            className="hero-scroll-hint"
            onClick={() => document.getElementById('stats')?.scrollIntoView({ behavior: 'smooth' })}
            role="button"
            tabIndex={0}
            title="Scroll to explore living traditions"
          >
            <span>Scroll to Explore</span>
            <ChevronDown size={18} />
          </div>
        </div>
      </section>

      {/* ── 2. Stats Telemetry HUD Bar ── */}
      <section className="stats-bar" id="stats">
        <div className="stats-grid stagger">
          <div className="stat-item animate-fade-in-up">
            <div className="stat-number">{culturalRecords.length}</div>
            <div className="stat-label">Total Living Traditions</div>
          </div>
          <div className="stat-item animate-fade-in-up">
            <div className="stat-number" style={{ color: 'var(--primary)' }}>{igncaRecords.length}</div>
            <div className="stat-label">IGNCA National Inventory</div>
          </div>
          <div className="stat-item animate-fade-in-up">
            <div className="stat-number" style={{ color: 'var(--gold)' }}>{unescoRecords.length}</div>
            <div className="stat-label">UNESCO ICH Inscriptions</div>
          </div>
          <div className="stat-item animate-fade-in-up">
            <div className="stat-number" style={{ color: 'var(--emerald)' }}>{communityRecords.length}</div>
            <div className="stat-label">Community Field Lores</div>
          </div>
        </div>
      </section>

      {/* ── 3. Stitch Feature: "HERITAGE IS ALIVE" Curated Living Chronicles ── */}
      <section className="showcase-section" id="heritage-stories">
        <div className="section-header">
          <div className="ornament">✦</div>
          <div className="badge badge-oral" style={{ marginBottom: 12 }}>
            <Sparkles size={12} /> UNBROKEN LIVING MEMORY
          </div>
          <h2>HERITAGE IS ALIVE</h2>
          <p style={{ fontStyle: 'italic', color: 'var(--gold-light)', fontSize: '1.05rem', marginBottom: 8 }}>
            “It lives in songs, hands, kitchens, streets, rituals and memories.”
          </p>
          <p>
            Each vignette is a thread in the national fabric: tangible material arts vibrating in concert with intangible oral memories passed through living hands without interruption.
          </p>
        </div>

        <div className="showcase-grid">
          {CURATED_SHOWCASE_STORIES.slice(0, 4).map((story) => (
            <div key={story.id} className="showcase-card">
              <div className="showcase-card-media">
                <img src={story.image} alt={story.title} loading="lazy" />
                <span className="showcase-card-badge">{story.region}</span>
              </div>
              <div className="showcase-card-body">
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--gold-light)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {story.category}
                  </div>
                  <h3>{story.title}</h3>
                  <p>{story.description}</p>
                </div>
                <div className="showcase-card-footer">
                  <span className="bearer-count">{story.bearers}</span>
                  <button
                    className="action-link"
                    onClick={() => handleOpenCuratedStory(story.matchingRecordId)}
                  >
                    <span>Inspect Chronicle</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Fifth story: Panoramic wide card */}
          {CURATED_SHOWCASE_STORIES[4] && (
            <div className="showcase-card showcase-card-hero">
              <div className="showcase-card-media">
                <img
                  src={CURATED_SHOWCASE_STORIES[4].image}
                  alt={CURATED_SHOWCASE_STORIES[4].title}
                  loading="lazy"
                />
                <span className="showcase-card-badge">{CURATED_SHOWCASE_STORIES[4].region}</span>
              </div>
              <div className="showcase-card-body">
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--emerald)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    PANCHAVADYAM SYMPHONIC PEAK
                  </div>
                  <h3 style={{ fontSize: '1.6rem' }}>{CURATED_SHOWCASE_STORIES[4].title}</h3>
                  <p style={{ fontSize: '0.9rem' }}>{CURATED_SHOWCASE_STORIES[4].description}</p>
                </div>
                <div className="showcase-card-footer">
                  <span style={{ color: 'var(--gold-light)' }}>{CURATED_SHOWCASE_STORIES[4].bearers}</span>
                  <button
                    className="action-link"
                    onClick={() => handleOpenCuratedStory(CURATED_SHOWCASE_STORIES[4].matchingRecordId)}
                  >
                    <span>Listen Recording &amp; Inspect</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Stitch Feature: "Explore by Culture" Epigraphic Spheres ── */}
      <section className="epigraphic-spheres-section" id="culture-categories">
        <div className="spheres-container">
          <div className="section-header">
            <div className="badge badge-terracotta" style={{ marginBottom: 12 }}>
              <Compass size={12} /> 6 FOUNDATIONAL EPIGRAPHIC SPHERES
            </div>
            <h2>Explore by Culture</h2>
            <p>
              Deep-dive into the foundational pillars that sustain India’s tangible and intangible memory across centuries.
            </p>
          </div>

          <div className="spheres-grid">
            {EPIGRAPHIC_SPHERES.map((sphere) => (
              <div
                key={sphere.title}
                className="sphere-card"
                onClick={() => handleSelectSphere(sphere.categoryKey)}
              >
                <div className="sphere-header">
                  <div className="sphere-icon-circle">{sphere.emoji}</div>
                  <span className="sphere-count">{sphere.count}</span>
                </div>
                <h3>{sphere.title}</h3>
                <p>{sphere.description}</p>
                <div className="sphere-action">
                  <span>View Catalogued Stream</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Living Cultural Stream & Institutional Inventories ── */}
      <section className="cultural-stream" id="cultural-stream">
        <div className="section-header">
          <div className="ornament">✦</div>
          <h2>Living Cultural Stream &amp; Institutional Inventories</h2>
          <p>
            Official IGNCA National Inventory records, UNESCO Intangible Cultural Heritage inscriptions, and community-attested oral lore.
          </p>
        </div>

        {/* Category & Dataset Filters */}
        <div className="category-filters" id="category-filters">
          <button
            className={`category-chip ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            🇮🇳 All Traditions ({culturalRecords.length})
          </button>
          <button
            className={`category-chip ${activeCategory === 'ignca' ? 'active' : ''}`}
            onClick={() => setActiveCategory('ignca')}
            style={{
              borderColor: activeCategory === 'ignca' ? 'var(--primary)' : 'var(--border-light)',
              background: activeCategory === 'ignca' ? 'rgba(224, 109, 68, 0.15)' : undefined,
              color: activeCategory === 'ignca' ? 'var(--primary)' : undefined,
              fontWeight: 600,
            }}
          >
            <Building2 size={14} /> IGNCA Inventory ({igncaRecords.length})
          </button>
          <button
            className={`category-chip ${activeCategory === 'unesco' ? 'active' : ''}`}
            onClick={() => setActiveCategory('unesco')}
            style={{
              borderColor: activeCategory === 'unesco' ? 'var(--gold)' : 'var(--border-light)',
              background: activeCategory === 'unesco' ? 'rgba(212, 175, 55, 0.15)' : undefined,
              color: activeCategory === 'unesco' ? 'var(--gold-light)' : undefined,
            }}
          >
            <Landmark size={14} /> UNESCO ICH ({unescoRecords.length})
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <button
              key={key}
              className={`category-chip ${activeCategory === key ? 'active' : ''}`}
              onClick={() => setActiveCategory(key as RecordCategory)}
            >
              {config.emoji} {config.label}
            </button>
          ))}
        </div>

        {/* Dynamic Records Grid */}
        <div className="records-grid stagger">
          {filtered.map((record) => {
            const isIgnca = record.id.startsWith('ICH0');
            const isIch = record.id.startsWith('ICH-');
            const hasImage = record.images && record.images.length > 0;

            return (
              <article
                key={record.id}
                className="record-card animate-fade-in-up"
                onClick={() => onViewRecord(record)}
                id={`record-card-${record.id}`}
              >
                <div
                  className="record-card-image"
                  style={{
                    background: hasImage
                      ? 'var(--surface-dim)'
                      : isIgnca
                      ? 'linear-gradient(135deg, #C85A32, #090D16)'
                      : `linear-gradient(135deg, ${CATEGORY_CONFIG[record.category].color}, var(--surface-dim))`
                  }}
                >
                  {hasImage ? (
                    <>
                      <img
                        src={record.images![0]}
                        alt={record.title}
                        className="record-card-img-tag"
                        loading="lazy"
                      />
                      <div className="image-overlay" />
                    </>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <span className="record-card-emoji">{CATEGORY_CONFIG[record.category].emoji}</span>
                      {isIgnca && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--primary-light)', fontWeight: 600, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                          🏛️ IGNCA INVENTORY
                        </div>
                      )}
                    </div>
                  )}

                  <div className="record-card-badges">
                    {isIgnca ? (
                      <span className="badge" style={{ background: 'var(--primary)', color: 'var(--text-primary)', fontWeight: 700 }}>
                        🏛️ Source: IGNCA
                      </span>
                    ) : isIch ? (
                      <span className="badge" style={{ background: 'var(--gold)', color: 'var(--bg-canvas)', fontWeight: 700 }}>
                        🌐 UNESCO ICH
                      </span>
                    ) : (
                      <span className="badge badge-community">
                        👥 Community Lore
                      </span>
                    )}

                    <span className={`badge ${VERIFICATION_CONFIG[record.verificationStatus].badgeClass}`}>
                      {VERIFICATION_CONFIG[record.verificationStatus].label}
                    </span>

                    {record.isEndangered && (
                      <span className="badge badge-endangered">
                        <AlertTriangle size={10} /> Endangered
                      </span>
                    )}
                  </div>
                </div>

                <div className="record-card-body">
                  <div className="record-card-category" style={{ color: CATEGORY_CONFIG[record.category].color }}>
                    {CATEGORY_CONFIG[record.category].label}
                  </div>
                  <h3 className="record-card-title">{record.title}</h3>
                  {record.nativeTitle && (
                    <div className="record-card-native">{record.nativeTitle}</div>
                  )}
                  <p className="record-card-desc">{record.shortDescription}</p>
                </div>

                <div className="record-card-footer">
                  <span className="record-card-location">
                    <MapPin size={12} />
                    {record.state}{record.district ? `, ${record.district}` : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {record.audioScript && (
                      <div className="waveform-mini">
                        <div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" />
                      </div>
                    )}
                    <ArrowRight size={14} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── 6. Stitch Feature: "What Should Never Be Forgotten?" Citizen Contribution Callout ── */}
      <section className="citizen-callout-section" id="citizen-journey">
        <div className="citizen-callout-container">
          <div className="citizen-callout-grid">
            <div className="citizen-callout-copy">
              <div className="badge badge-terracotta" style={{ marginBottom: 12 }}>
                <HeartHandshake size={12} /> CITIZEN &amp; COMMUNITY EMPOWERMENT
              </div>
              <h2>
                What Should Never <br />Be Forgotten?
              </h2>
              <p className="lead">
                Your grandmother’s recipe. A song from your village. A craft passed through three generations. A festival known only to your community.
              </p>
              <p className="sub">
                Every tradition undocumented is a library lost forever. Dharohar Setu provides an open, accessible digital parchment so you can record, geotag, and preserve cultural heritage right from your palm.
              </p>

              {/* Offline-First Telemetry Card */}
              <div className="offline-telemetry-box">
                <div className="telemetry-icon">⚡</div>
                <div>
                  <h4>Offline-First Architecture</h4>
                  <p>Record anywhere in zero-connectivity valleys or remote hamlets; auto-synchronizes once connected.</p>
                </div>
              </div>
            </div>

            <div className="citizen-action-box">
              <h3>Record a Living Memory</h3>
              <p>Select media type to initiate field entry:</p>

              <div className="media-pills">
                <span className="media-pill">📷 Photos</span>
                <span className="media-pill" style={{ borderColor: 'var(--primary)', color: 'var(--primary-light)' }}>🎙 Voice</span>
                <span className="media-pill">🎥 Video</span>
                <span className="media-pill">📝 Story</span>
                <span className="media-pill">📍 GPS Coords</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleNavigateContribute}
                >
                  <Mic size={18} />
                  Record Voice / Oral Lore
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleNavigateContribute}
                >
                  <BookOpen size={18} />
                  Upload Visuals &amp; Documents
                </button>
              </div>

              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: 16 }}>
                Preserved under Ethical Cultural Commons Protocol
              </p>
            </div>
          </div>

          {/* 6-Step Visual Journey Flow */}
          <div>
            <div className="journey-flow-header">The Contribution Journey</div>
            <div className="journey-steps-grid">
              {CONTRIBUTION_JOURNEY_STEPS.map((step) => (
                <div key={step.num} className="journey-step-card">
                  <span className="step-num">{step.num}</span>
                  <span className="step-icon">{step.icon}</span>
                  <h4>{step.title}</h4>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Preservation Spotlight Section ── */}
      <section className="preservation-section" id="preservation-spotlight">
        <div className="section-header">
          <div className="ornament" style={{ color: 'var(--error)' }}>⚠</div>
          <h2>Preservation Spotlight</h2>
          <p>Traditions and urgent safeguarding elements needing continuous community &amp; institutional care.</p>
        </div>

        <div className="endangered-cards stagger">
          {endangered.map((record) => (
            <div
              key={record.id}
              className="endangered-card animate-fade-in-up"
              onClick={() => onViewRecord(record)}
              style={{ cursor: 'pointer' }}
            >
              <span className="badge badge-endangered" style={{ marginBottom: '8px' }}>
                <AlertTriangle size={10} /> Endangered Heritage
              </span>
              <h4>{record.title}</h4>
              <div className="location">
                <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                {record.state}{record.district ? `, ${record.district}` : ''}
              </div>
              <div className="note">{record.preservationNote}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
