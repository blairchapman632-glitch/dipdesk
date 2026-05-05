'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace('/dashboard')
      }
    }
    checkSession()
  }, [router])

  const handleSignUp = async () => {
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) { setMessage(error.message); setLoading(false); return }
    const user = data?.user
    if (user) {
      await supabase.from('profiles').insert({ id: user.id, email, full_name: fullName })
    }
    setMessage('Account created! Please verify your email, then log in.')
    setIsSignUp(false)
    setFullName('')
    setEmail('')
    setPassword('')
    setLoading(false)
  }

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(error.message); setLoading(false); return }
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('dipdesk_')) localStorage.removeItem(key)
    })
    router.replace('/dashboard')
  }

  const scrollToAuth = (signup = false) => {
    setIsSignUp(signup)
    setTimeout(() => {
      const el = document.getElementById('auth-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
  }

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
        .cta-primary { color: #fff; }
        .cta-secondary { background: #f4f4f4; color: #1a1a2e; }

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
          font-size: 1.6rem;
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

        .auth-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          font-size: 16px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.15s;
          background: #fff;
          color: #1a1a2e;
          box-sizing: border-box;
        }
        .auth-input:focus { border-color: #a855f7; }
        .auth-input::placeholder { color: #9ca3af; }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/icon-192.png" alt="WrapApp" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px' }}>WrapApp</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => scrollToAuth(false)} className="cta-btn cta-secondary" style={{ padding: '10px 22px', fontSize: '14px' }}>
              Sign in
            </button>
            <button onClick={() => scrollToAuth(true)} className="cta-btn cta-primary grad-bg" style={{ padding: '10px 22px', fontSize: '14px' }}>
              Join free
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>

          {/* HERO */}
          <section style={{ position: 'relative', textAlign: 'center', padding: '72px 0 60px', overflow: 'hidden' }}>
            <div className="hero-blob" style={{ width: 500, height: 500, background: '#a855f7', top: -100, left: -150 }} />
            <div className="hero-blob" style={{ width: 400, height: 400, background: '#f97316', top: -80, right: -120 }} />
            <div className="hero-blob" style={{ width: 300, height: 300, background: '#5b8dee', bottom: 0, left: '30%' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ marginBottom: '24px' }}>
                <span className="pill grad-bg" style={{ color: '#fff' }}>✦ Free to join</span>
              </div>

              <h1 className="hero-headline" style={{
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '3.8rem',
                lineHeight: 1.08, margin: '0 0 20px', letterSpacing: '-0.02em',
              }}>
                Your wrap collection,{' '}
                <span className="grad-text">beautifully organised</span>
              </h1>

              <p className="hero-sub" style={{
                fontSize: '1.15rem', color: '#555', maxWidth: 520,
                margin: '0 auto 36px', lineHeight: 1.65, fontWeight: 300,
              }}>
                Manage your wraps, discover other collectors, and buy or sell — all in one place.
                Built for the wrap community, by wrap lovers.
              </p>

              <div className="hero-btns" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => scrollToAuth(true)} className="cta-btn cta-primary grad-bg">
                  Join WrapApp →
                </button>
                <button onClick={() => scrollToAuth(false)} className="cta-btn cta-secondary">
                  Sign in
                </button>
              </div>

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
                <div style={{ padding: '16px', background: '#fafafa' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#999', margin: '0 0 12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>My Collection</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { bg: 'linear-gradient(135deg,#5b8dee,#a855f7)', label: 'Linuschka' },
                      { bg: 'linear-gradient(135deg,#a855f7,#ec4899)', label: 'Luna Cocoon' },
                      { bg: 'linear-gradient(135deg,#ec4899,#f97316)', label: 'Solnce' },
                      { bg: 'linear-gradient(135deg,#f97316,#fbbf24)', label: 'Artipoppe' },
                      { bg: 'linear-gradient(135deg,#10b981,#5b8dee)', label: 'Origins' },
                      { bg: 'linear-gradient(135deg,#8b5cf6,#ec4899)', label: 'Strings' },
                    ].map((w) => (
                      <div key={w.label} className="wrap-tile" style={{ background: w.bg }}>
                        <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '2px 6px', backdropFilter: 'blur(4px)' }}>{w.label}</span>
                      </div>
                    ))}
                  </div>
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
                { icon: '✨', iconBg: 'linear-gradient(135deg,#fce7f3,#fbcfe8)', title: 'Showcase your collection', desc: 'Add wraps, upload photos, and display everything in a beautiful public gallery. Your collection, your way.' },
                { icon: '🔍', iconBg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', title: 'Discover collectors', desc: "Explore collections, search by brand or size, and find wraps you've been hunting for." },
                { icon: '🛍️', iconBg: 'linear-gradient(135deg,#ffedd5,#fed7aa)', title: 'Buy & sell naturally', desc: 'Mark wraps for sale and let buyers come to you. Marketplace built into your collection.' },
                { icon: '🎲', iconBg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', title: 'Run a Dip', desc: 'Track spots, manage your draw, and share results with your community. Transparent and easy.' },
                { icon: '⭐', iconBg: 'linear-gradient(135deg,#fef9c3,#fef08a)', title: 'ISO & wishlist', desc: "Let the community know what you're searching for. Never miss a swap opportunity." },
                { icon: '💬', iconBg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)', title: 'Direct messages', desc: 'Chat directly with sellers and collectors. No third-party apps needed.' },
              ].map((f) => (
                <div key={f.title} className="feature-card">
                  <div className="feature-icon" style={{ background: f.iconBg }}>{f.icon}</div>
                  <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '1rem', margin: '0 0 8px' }}>{f.title}</h3>
                  <p style={{ color: '#666', fontSize: '0.88rem', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* STATS */}
          <section style={{
            background: 'linear-gradient(135deg,#faf5ff,#fff0fb,#fff5f0)',
            borderRadius: 28, padding: '48px 32px', marginBottom: '80px', textAlign: 'center',
          }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.6rem', margin: '0 0 8px' }}>
              Built for the wrap community
            </h2>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 40px', fontWeight: 300 }}>
              A better home for your collection than spreadsheets and Facebook groups
            </p>
            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, overflow: 'hidden' }}>
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

          {/* AUTH SECTION */}
          <section id="auth-section" style={{ padding: '0 0 100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2.4rem',
              margin: '0 0 8px', letterSpacing: '-0.02em', textAlign: 'center',
            }}>
              Ready to{' '}
              <span className="grad-text">wrap it all together?</span>
            </h2>
            <p style={{ color: '#777', marginBottom: '40px', fontWeight: 300, fontSize: '1rem', textAlign: 'center' }}>
              Free to join. Just your wraps, organised beautifully.
            </p>

            <div style={{
              width: '100%', maxWidth: 400,
              background: '#fff',
              border: '1.5px solid #f0f0f0',
              borderRadius: 28,
              padding: '36px 32px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
            }}>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 6px', textAlign: 'center' }}>
                {isSignUp ? 'Create your account' : 'Welcome back'}
              </h3>
              <p style={{ color: '#999', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 24px', fontWeight: 300 }}>
                {isSignUp ? 'Join the wrap community' : 'Sign in to your collection'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: {
                        redirectTo: `${window.location.origin}/dashboard`,
                      },
                    })
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '13px', borderRadius: 14, border: '1.5px solid #e5e7eb',
                    background: '#fff', cursor: 'pointer', fontSize: '15px',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: '#1a1a2e',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continue with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
                  <span style={{ fontSize: '12px', color: '#bbb' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
                </div>
                <input className="auth-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="auth-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

                <button
                  type="button"
                  onClick={isSignUp ? handleSignUp : handleLogin}
                  disabled={loading}
                  className="cta-btn cta-primary grad-bg"
                  style={{ justifyContent: 'center', borderRadius: 14, padding: '14px', fontSize: '15px', marginTop: 4, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
                  disabled={loading}
                  style={{
                    background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 14,
                    padding: '13px', fontSize: '14px', color: '#555', cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                  }}
                >
                  {isSignUp ? 'Already have an account? Sign in' : 'New here? Create account'}
                </button>
              </div>

              {message && (
                <p style={{
                  marginTop: 16, fontSize: '13px', textAlign: 'center',
                  color: message.toLowerCase().includes('error') ? '#ef4444' : '#10b981',
                }}>
                  {message}
                </p>
              )}

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f0f0f0', textAlign: 'center', fontSize: '11px', color: '#bbb' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <a href="/terms" style={{ color: '#bbb', textDecoration: 'none' }}>Terms</a>
                  <a href="/privacy" style={{ color: '#bbb', textDecoration: 'none' }}>Privacy</a>
                  <a href="/community" style={{ color: '#bbb', textDecoration: 'none' }}>Guidelines</a>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* FOOTER */}
        <footer style={{
          borderTop: '1px solid #f0f0f0', padding: '32px 24px',
          textAlign: 'center', color: '#aaa', fontSize: '13px', fontWeight: 300,
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