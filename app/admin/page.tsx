'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/app/components/AppLayout'

type AdminUserRow = {
  id: string
  full_name: string | null
  username: string | null
  email: string
  is_admin: boolean
  is_active: boolean
  last_active_at: string | null
  wraps_count: number
}

function formatLastActive(value: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [actionUserId, setActionUserId] = useState<string | null>(null)

  useEffect(() => {
    void loadAdminData()
  }, [])

  async function loadAdminData() {
    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || profileData?.is_admin !== true) {
      router.push('/dashboard')
      return
    }

    setIsAdmin(true)

    const { data: adminUsers, error: adminUsersError } = await supabase
      .from('admin_user_overview')
      .select('*')
      .order('last_active_at', { ascending: false })

    if (adminUsersError) {
      console.error(adminUsersError)
      setUsers([])
    } else {
      setUsers((adminUsers || []) as AdminUserRow[])
    }

    setLoading(false)
  }

  async function handleToggleUser(userId: string, nextStatus: boolean) {
    setActionUserId(userId)

    const { error } = await supabase.rpc('set_user_active_status', {
      target_user_id: userId,
      new_status: nextStatus,
    })

    if (error) {
      console.error(error)
      setActionUserId(null)
      return
    }

    await loadAdminData()
    setActionUserId(null)
  }

  const totalUsers = users.length
  const activeUsers = useMemo(
    () => users.filter((user) => user.is_active).length,
    [users]
  )
  const deactivatedUsers = totalUsers - activeUsers
  const totalWraps = useMemo(
    () => users.reduce((sum, user) => sum + Number(user.wraps_count || 0), 0),
    [users]
  )

  if (loading) {
    return (
      <AppLayout hideHeader>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Loading admin dashboard...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <AppLayout hideHeader>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
            <p className="text-sm text-gray-600">
              Manage users and view app activity.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalUsers}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active Users</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {activeUsers}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Deactivated Users</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {deactivatedUsers}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Wraps</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalWraps}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Wraps
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Last Activity
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => {
                  const isBusy = actionUserId === user.id

                  return (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-3 text-gray-900">
                        {user.full_name || user.username || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{user.email}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {user.wraps_count}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatLastActive(user.last_active_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            user.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.is_admin ? (
                          <span className="text-xs font-semibold text-purple-700">
                            Admin
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
  const confirmed = window.confirm(
    user.is_active
      ? 'Are you sure you want to deactivate this user?'
      : 'Are you sure you want to reactivate this user?'
  )

  if (!confirmed) return

  handleToggleUser(user.id, !user.is_active)
}}
                            className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
  user.is_active
    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
    : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
}`}
                          >
                            {isBusy
  ? 'Saving...'
  : user.is_active
  ? 'Deactivate User'
  : 'Reactivate User'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}