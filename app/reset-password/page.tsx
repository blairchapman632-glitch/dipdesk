'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async () => {
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message) } else { router.replace('/dashboard') }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .reset-input {
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
        .reset-input:focus { border-color: #a855f7; }
        .reset-input::placeholder { color: #9ca3af; }
      `}</style>

      <div style={{
        minHeight: '100vh', background: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px', fontFamily: 'DM Sans, sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/icon-192.png" alt="WrapApp" style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 16 }} />
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.8rem', margin: '0 0 8px', color: '#1a1a2e' }}>
              New password
            </h1>
            <p style={{ color: '#999', fontSize: '0.9rem', margin: 0, fontWeight: 300 }}>
              Choose a new password for your account
            </p>
          </div>

          {!ready ? (
            <div style={{ textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
              Verifying reset link...
            </div>
          ) : (
            <div style={{
              background: '#fff', border: '1.5px solid #f0f0f0',
              borderRadius: 28, padding: '32px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '13px', color: '#777', marginBottom: 6, display: 'block' }}>New password</label>
                  <input
                    className="reset-input"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: '#777', marginBottom: 6, display: 'block' }}>Confirm password</label>
                  <input
                    className="reset-input"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                  />
                </div>

                {error && (
                  <p style={{ fontSize: '13px', color: '#ef4444', margin: 0, textAlign: 'center' }}>{error}</p>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading || !password || !confirm}
                  style={{
                    background: 'linear-gradient(135deg, #5b8dee 0%, #a855f7 35%, #ec4899 65%, #f97316 100%)',
                    color: '#fff', border: 'none', borderRadius: 14,
                    padding: '14px', fontSize: '15px', fontWeight: 500,
                    fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                    opacity: loading || !password || !confirm ? 0.5 : 1,
                    marginTop: 4,
                  }}
                >
                  {loading ? 'Updating...' : 'Set new password'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}