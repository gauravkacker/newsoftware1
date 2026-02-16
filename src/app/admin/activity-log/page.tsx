// ============================================
// Module 2: Activity Log Page
// Doctor can audit all user actions (Module 2.10)
// ============================================

'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { activityLogDb } from '@/lib/db/database';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ActivityLog } from '@/types';

export default function ActivityLogPage() {
  const { user, hasPermission, isAuthenticated } = useAuth();
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');

  // Check if user has permission to view activity logs
  if (!isAuthenticated || !hasPermission('settings')) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Access Denied</p>
            <p className="text-sm text-gray-400">You don&apos;t have permission to view activity logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const logs = activityLogDb.getAll() as ActivityLog[];
  
  // Get unique users and modules for filters
  const users = [...new Set(logs.map((log) => log.userName))];
  const modules = [...new Set(logs.map((log) => log.module))];

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filterUser !== 'all' && log.userName !== filterUser) return false;
    if (filterModule !== 'all' && log.module !== filterModule) return false;
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <Badge variant="outline">{filteredLogs.length} entries</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by User
              </label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">All Users</option>
                {users.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Module
              </label>
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">All Modules</option>
                {modules.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 100).map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3">{log.userName}</td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        {log.module}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {log.patientId && (
                          <span className="text-blue-600">
                            Patient: {log.patientId}
                          </span>
                        )}
                        {Object.keys(log.details).length > 0 && (
                          <span className="text-gray-400 ml-2">
                            {JSON.stringify(log.details).slice(0, 50)}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
