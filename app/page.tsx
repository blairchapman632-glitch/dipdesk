export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .landing-root {
          font-family: 'DM Sans', sans-serif;
          background: #fff;
          color: #1a1a2e;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .grad-text {
          background: linear-gradient(135deg, #5b8dee 0%, #a855f7 35%, #ec4899 65%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .grad-bg {
          background: linear-gradient(135deg, #5b8dee 0%, #a855f7 35%, #ec4899 65%, #f97316 100%);
        }

        .hero-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          pointer-events: none;
        }

        .feature-card {
          background: #fafafa;
          border: 1px solid #f0f0f0;
          border-radius: 20px;
          padding: 2rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
        }

        .feature-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 1rem;
        }

        .nav-link {
          color: #555;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          transition: color 0.15s;
        }
        .nav-link:hover { color: #a855f7; }

        .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          border-radius: 100px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.15s, opacity 0.15s;
          border: none;
        }
        .cta-btn:hover { transform: scale(1.03); opacity: 0.95; }
        .cta-btn:active { transform: scale(0.99); }

        .cta-primary {
          color: #fff;
        }

        .cta-secondary {
          background: #f4f4f4;
          color: #1a1a2e;
        }

        .pill {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .stat-num {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 2.5rem;
          line-height: 1;
        }

        .mockup-wrap {
          background: linear-gradient(160deg, #f0f4ff 0%, #fdf0ff 50%, #fff5f0 100%);
          border-radius: 28px;
          padding: 2px;
        }

        .mockup-inner {
          background: #fff;
          border-radius: 26px;
          overflow: hidden;
        }

        .phone-bar {
          height: 44px;
          background: linear-gradient(135deg, #5b8dee, #a855f7, #ec4899, #f97316);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wrap-tile {
          border-radius: 12px;
          aspect-ratio: 1;
          display: flex;
          align-items: flex-end;
          padding: 8px;
          font-size: 11px;
          font-weight: 500;
          color: #fff;
          overflow: hidden;
          position: relative;
        }

        @media (max-width: 640px) {
          .hero-headline { font-size: 2.4rem !important; }
          .hero-sub { font-size: 1rem !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-row { grid-template-columns: 1fr 1fr !important; }
          .hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .hero-btns .cta-btn { justify-content: center; }
        }
      `}</style>

      <div className="landing-root">

        {/* NAV */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          height: '60px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          maxWidth: '1100px', margin: '0 auto',
          width: '100%',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/icon-192.png" alt="WrapApp" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px' }}>WrapApp</span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#features" className="nav-link" style={{ display: 'none' }}>Features</a>
            <a
              href="/login"
              className="cta-btn cta-primary grad-bg"
              style={{ padding: '10px 22px', fontSize: '14px' }}
            >
              Sign in
            </a>
          </div>
        </nav>

        {/* NAV spacer for sticky */}
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>

          {/* HERO */}
          <section style={{
            position: 'relative',
            textAlign: 'center',
            padding: '72px 0 60px',
            overflow: 'hidden',
          }}>
            {/* Blobs */}
            <div className="hero-blob" style={{ width: 500, height: 500, background: '#a855f7', top: -100, left: -150 }} />
            <div className="hero-blob" style={{ width: 400, height: 400, background: '#f97316', top: -80, right: -120 }} />
            <div className="hero-blob" style={{ width: 300, height: 300, background: '#5b8dee', bottom: 0, left: '30%' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Badge */}
              <div style={{ marginBottom: '24px' }}>
                <span className="pill grad-bg" style={{ color: '#fff' }}>
                  ✦ Free to join
                </span>
              </div>

              {/* Headline */}
              <h1 className="hero-headline" style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 800,
                fontSize: '3.8rem',
                lineHeight: 1.08,
                margin: '0 0 20px',
                letterSpacing: '-0.02em',
              }}>
                Your wrap collection,{' '}
                <span className="grad-text">beautifully organised</span>
              </h1>

              {/* Subheading */}
              <p className="hero-sub" style={{
                fontSize: '1.15rem',
                color: '#555',
                maxWidth: 520,
                margin: '0 auto 36px',
                lineHeight: 1.65,
                fontWeight: 300,
              }}>
                Manage your wraps, discover other collectors, and buy or sell — all in one place.
                Built for the wrap community, by wrap lovers.
              </p>

              {/* CTAs */}
              <div className="hero-btns" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/login" className="cta-btn cta-primary grad-bg">
                  Start for free →
                </a>
                <a href="#features" className="cta-btn cta-secondary">
                  See how it works
                </a>
              </div>

              {/* Social proof */}
              <p style={{ marginTop: '24px', fontSize: '13px', color: '#999' }}>
                Join wrap collectors already using WrapApp
              </p>
            </div>
          </section>

          {/* PHONE MOCKUP */}
          <section style={{ padding: '0 0 72px', display: 'flex', justifyContent: 'center' }}>
            <div className="mockup-wrap" style={{ width: '100%', maxWidth: 340 }}>
              <div className="mockup-inner">
                <div className="phone-bar">
                  <span style={{ color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>WrapApp</span>
                </div>
                {/* Collection grid */}
                <div style={{ padding: '16px', background: '#fafafa' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#999', margin: '0 0 12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>My Collection</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { bg: 'linear-gradient(135deg,#5b8dee,#a855f7)', label: 'Oscha' },
                      { bg: 'linear-gradient(135deg,#a855f7,#ec4899)', label: 'Didymos' },
                      { bg: 'linear-gradient(135deg,#ec4899,#f97316)', label: 'Girasol' },
                      { bg: 'linear-gradient(135deg,#f97316,#fbbf24)', label: 'Vatanai' },
                      { bg: 'linear-gradient(135deg,#10b981,#5b8dee)', label: 'Lenny' },
                      { bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', label: 'Firespiral' },
                    ].map((w) => (
                      <div key={w.label} className="wrap-tile" style={{ background: w.bg }}>
                        <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '2px 6px', backdropFilter: 'blur(4px)' }}>{w.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Bottom nav mock */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20, paddingTop: 12, borderTop: '1px solid #eee' }}>
                    {['🏠', '🔍', '⭐', '💬', '👤'].map(icon => (
                      <span key={icon} style={{ fontSize: 18 }}>{icon}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section id="features" style={{ padding: '0 0 80px' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '2rem', margin: '0 0 12px' }}>
                Everything a collector needs
              </h2>
              <p style={{ color: '#777', fontSize: '1rem', fontWeight: 300 }}>
                One app to manage, share, and grow your collection
              </p>
            </div>

            <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                {
                  icon: '🗂️',
                  iconBg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
                  title: 'Manage your collection',
                  desc: 'Add wraps, upload photos, track purchase price, and organise everything cleanly in one place.',
                },
                {
                  icon: '✨',
                  iconBg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)',
                  title: 'Showcase your wraps',
                  desc: 'Your public profile is a beautiful visual gallery. Share it with the community.',
                },
                {
                  icon: '🔍',
                  iconBg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
                  title: 'Discover collectors',
                  desc: 'Explore collections, search by brand or size, and find wraps you\'ve been hunting for.',
                },
                {
                  icon: '🛍️',
                  iconBg: 'linear-gradient(135deg,#ffedd5,#fed7aa)',
                  title: 'Buy & sell naturally',
                  desc: 'Mark wraps for sale and let buyers come to you. Marketplace built into your collection.',
                },
                {
                  icon: '⭐',
                  iconBg: 'linear-gradient(135deg,#fef9c3,#fef08a)',
                  title: 'ISO & wishlist',
                  desc: 'Let the community know what you\'re searching for. Never miss a swap opportunity.',
                },
                {
                  icon: '💬',
                  iconBg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
                  title: 'Direct messages',
                  desc: 'Chat directly with sellers and collectors. No third-party apps needed.',
                },
              ].map((f) => (
                <div key={f.title} className="feature-card">
                  <div className="feature-icon" style={{ background: f.iconBg }}>
                    {f.icon}
                  </div>
                  <h3 style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 600,
                    fontSize: '1rem',
                    margin: '0 0 8px',
                  }}>{f.title}</h3>
                  <p style={{ color: '#666', fontSize: '0.88rem', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* STATS */}
          <section style={{
            background: 'linear-gradient(135deg,#faf5ff,#fff0fb,#fff5f0)',
            borderRadius: 28,
            padding: '48px 32px',
            marginBottom: '80px',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.6rem',
              margin: '0 0 8px',
            }}>Built for the wrap community</h2>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 40px', fontWeight: 300 }}>
              A better home for your collection than spreadsheets and Facebook groups
            </p>
            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
              {[
                { num: 'Free', label: 'To join' },
                { num: 'Mobile', label: 'First' },
                { num: '🇦🇺', label: 'Aussie made' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="stat-num grad-text">{s.num}</div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#888', fontWeight: 300 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* BOTTOM CTA */}
          <section style={{ textAlign: 'center', padding: '0 0 100px' }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: '2.4rem',
              margin: '0 0 16px',
              letterSpacing: '-0.02em',
            }}>
              Ready to{' '}
              <span className="grad-text">wrap it all together?</span>
            </h2>
            <p style={{ color: '#777', marginBottom: '32px', fontWeight: 300, fontSize: '1rem' }}>
              Free to join. Just your wraps, organised beautifully.
            </p>
            <a href="/login" className="cta-btn cta-primary grad-bg" style={{ fontSize: '17px', padding: '16px 40px' }}>
              Join WrapApp →
            </a>
          </section>

        </div>

        {/* FOOTER */}
        <footer style={{
          borderTop: '1px solid #f0f0f0',
          padding: '32px 24px',
          textAlign: 'center',
          color: '#aaa',
          fontSize: '13px',
          fontWeight: 300,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <img src="/icon-192.png" alt="WrapApp" style={{ width: 24, height: 24, borderRadius: 6, opacity: 0.7 }} />
            <span style={{ color: '#888', fontWeight: 500 }}>WrapApp</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
            <a href="/terms" style={{ color: '#aaa', textDecoration: 'none' }}>Terms of Service</a>
            <a href="/privacy" style={{ color: '#aaa', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/community" style={{ color: '#aaa', textDecoration: 'none' }}>Community Guidelines</a>
            <a href="mailto:blairchapman632@gmail.com" style={{ color: '#aaa', textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ margin: 0 }}>© 2026 WrapApp · Australia</p>
        </footer>

      </div>
    </>
  )
}