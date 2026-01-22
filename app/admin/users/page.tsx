'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, Copy, Check, Shield, ShieldOff, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface User {
  id: string
  email: string
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
  order_count: number
  total_spent: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const session = await getCurrentSession()
      if (!session) return

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, debouncedSearch])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset to page 1 when search changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [debouncedSearch])

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy ID:', error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    // Confirm before changing to/from admin
    const action = newRole === 'admin' ? 'grant admin privileges to' : 'remove admin privileges from'
    if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) {
      return
    }

    setUpdatingRole(userId)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        // Update local state
        setUsers(prev =>
          prev.map(u =>
            u.id === userId ? { ...u, role: newRole } : u
          )
        )
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update user role')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update user role')
    } finally {
      setUpdatingRole(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'User Management' }
          ]} />

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-purple-400" size={32} />
              <h1 className="text-4xl font-bold">User Management</h1>
            </div>
            <p className="text-gray-400">Manage users, view purchase history, and assign roles</p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Total Users</p>
              <p className="text-2xl font-bold">{pagination.total}</p>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Admins</p>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</p>
            </div>
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400 text-sm">Users with Orders</p>
              <p className="text-2xl font-bold">{users.filter(u => u.order_count > 0).length}</p>
            </div>
          </div>

          {/* Users Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading users...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="mx-auto mb-4" size={48} />
              <p>{debouncedSearch ? 'No users found matching your search' : 'No users found'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-4 px-4 text-gray-400 font-medium">Email</th>
                      <th className="text-left py-4 px-4 text-gray-400 font-medium">Role</th>
                      <th className="text-left py-4 px-4 text-gray-400 font-medium">Orders</th>
                      <th className="text-left py-4 px-4 text-gray-400 font-medium">Total Spent</th>
                      <th className="text-left py-4 px-4 text-gray-400 font-medium">Joined</th>
                      <th className="text-right py-4 px-4 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-gray-800/50 hover:bg-gray-900/50"
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-white font-medium">{user.email}</p>
                            <p className="text-xs text-gray-500 font-mono">{user.id.slice(0, 8)}...</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as 'user' | 'admin')}
                            disabled={updatingRole === user.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                              user.role === 'admin'
                                ? 'bg-purple-600/20 text-purple-400 border border-purple-600/50'
                                : 'bg-gray-800 text-gray-300 border border-gray-700'
                            } ${updatingRole === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <ShoppingBag size={16} className="text-gray-500" />
                            <span className={user.order_count > 0 ? 'text-white' : 'text-gray-500'}>
                              {user.order_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={user.total_spent > 0 ? 'text-green-400 font-medium' : 'text-gray-500'}>
                            {formatCurrency(user.total_spent)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <motion.button
                              onClick={() => handleCopyId(user.id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                                copiedId === user.id
                                  ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                                  : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600'
                              }`}
                              title="Copy User ID for discount codes"
                            >
                              {copiedId === user.id ? (
                                <>
                                  <Check size={14} />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  Copy ID
                                </>
                              )}
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-800">
                  <p className="text-gray-400 text-sm">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="p-2 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="px-4 py-2 text-gray-400">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="p-2 bg-gray-800 border border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Help Text */}
          <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <h3 className="text-sm font-medium text-gray-300 mb-2">How to use</h3>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>• Use the <strong>Copy ID</strong> button to copy a user&apos;s UUID for assigning user-specific discount codes</li>
              <li>• Change user roles using the dropdown - admins have access to this dashboard</li>
              <li>• Search by email to quickly find specific users</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
