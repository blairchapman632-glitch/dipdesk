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
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const user = data?.user

    if (user) {
      await supabase.from('profiles').insert({
        id: user.id,
        email,
        full_name: fullName,
      })
    }

        setMessage('Account created. Please verify your email, then log in.')
    setIsSignUp(false)
    setFullName('')
    setEmail('')
    setPassword('')
    setLoading(false)
  }

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    // Clear any cached data from previous user
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('dipdesk_')) {
        localStorage.removeItem(key)
      }
    })

    router.replace('/dashboard')
    
  }

  return (
    <div className="min-h-screen bg-gray-200 p-3 flex items-center justify-center">
      <div className="relative w-full min-h-screen overflow-hidden md:h-[95vh] md:rounded-[28px] shadow-2xl">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "url('/login-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/60 via-white/20 to-transparent" />
                <div className="relative z-10 flex min-h-screen items-center justify-center px-4 md:justify-start md:px-0">

                              <div className="w-full max-w-[310px] mx-auto md:max-w-md md:mx-0 md:ml-20">
                                    <div className="relative z-20 bg-white/60 p-5 md:p-8 rounded-3xl shadow-lg md:shadow-2xl border border-white/40 backdrop-blur-md md:backdrop-blur-xl overflow-hidden">
                                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent" />
              <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight text-gray-900">
                WrapApp
              </h1>

                            <p className="text-sm text-gray-700 mb-5 md:mb-6">
                For the Love of Wraps
              </p>

              {isSignUp && (
                <input
                  type="text"
                  placeholder="Full name"
                                    className="w-full p-2.5 md:p-3 border border-gray-200 rounded-xl mb-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 xl:text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              )}

              <input
                type="email"
                placeholder="Email"
                className="w-full p-2.5 md:p-3 border border-gray-200 rounded-xl mb-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 xl:text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                className="w-full p-2.5 md:p-3 border border-gray-200 rounded-xl mb-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 xl:text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                onClick={() => {
                  if (isSignUp) {
                    handleSignUp()
                  } else {
                    handleLogin()
                  }
                }}
                                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white p-2.5 md:p-3 rounded-xl mb-2 hover:opacity-90 transition shadow-md"
                disabled={loading}
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Login'}
              </button>

              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                                className="w-full border border-gray-300 p-2.5 md:p-3 rounded-xl hover:bg-white/60 transition"
                disabled={loading}
              >
                {isSignUp ? 'Back to Login' : 'Create Account'}
              </button>

                                          {message && (
                <p
                  className={`mt-4 text-sm text-center ${
                    message.toLowerCase().includes('error')
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {message}
                </p>
              )}

                            <div className="mt-6 pt-4 border-t border-gray-200 text-center text-[11px] leading-5 text-gray-600">
                <p>© 2026 Paige Chapman. All rights reserved.</p>
                <div className="mt-2 flex justify-center gap-3">
                  <a href="/terms" className="text-pink-500 hover:underline">Terms</a>
                  <span>·</span>
                  <a href="/privacy" className="text-pink-500 hover:underline">Privacy</a>
                  <span>·</span>
                  <a href="/community" className="text-pink-500 hover:underline">Guidelines</a>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}