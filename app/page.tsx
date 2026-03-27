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

    setMessage('Account created. You can now log in.')
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

        <div className="relative z-10 flex min-h-screen items-center">
          <div className="w-full max-w-md ml-6 md:ml-20">
            <div className="relative z-20 bg-white/70 p-8 rounded-3xl shadow-2xl border border-white/50 backdrop-blur-xl">
              <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-gray-900">
                WrapApp
              </h1>

              <p className="text-sm text-gray-700 mb-6">
                Every wrap deserves to be shown off
              </p>

              {isSignUp && (
                <input
                  type="text"
                  placeholder="Full name"
                  className="w-full p-3 border border-gray-200 rounded-xl mb-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 xl:text-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              )}

              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 border border-gray-200 rounded-xl mb-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 xl:text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 border border-gray-200 rounded-xl mb-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 xl:text-sm"
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
                className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 rounded-xl mb-2 hover:opacity-90 transition shadow-md"
                disabled={loading}
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Login'}
              </button>

              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="w-full border border-gray-300 p-3 rounded-xl hover:bg-white/60 transition"
                disabled={loading}
              >
                {isSignUp ? 'Back to Login' : 'Create Account'}
              </button>

              {message && (
                <p className="mt-4 text-sm text-center">{message}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}