'use client';

import React, { useEffect, useState } from 'react';
import { getAppUsers, getServices } from '@/lib/db';

export default function TestDbPage() {
  const [users, setUsers] = useState<any>(null);
  const [services, setServices] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function test() {
      try {
        const u = await getAppUsers();
        setUsers(u);
        const s = await getServices();
        setServices(s);
      } catch (e: any) {
        console.error('Test DB Page Error:', e);
        setError(e?.message || String(e));
      }
    }
    test();
  }, []);

  return (
    <div className="p-8 space-y-6 text-black bg-white min-h-screen">
      <h1 className="text-2xl font-black">Supabase Connection Diagnostics</h1>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">
          Error: {error}
        </div>
      )}

      <div>
        <h2 className="font-black text-lg text-blue-600">Users Retrieved:</h2>
        <pre className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-2 font-mono overflow-auto max-h-60">
          {users ? JSON.stringify(users, null, 2) : 'Loading users...'}
        </pre>
      </div>

      <div>
        <h2 className="font-black text-lg text-blue-600">Services Retrieved:</h2>
        <pre className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-2 font-mono overflow-auto max-h-60">
          {services ? JSON.stringify(services, null, 2) : 'Loading services...'}
        </pre>
      </div>
    </div>
  );
}
