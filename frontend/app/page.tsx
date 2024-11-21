'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE ?? ''
);

const BASE_URL = 'https://watchman-beta.vercel.app/'

interface Website {
  id: number;
  address: string;
  status: string;
  message: string;
  lastChecked: string;
  latency: number;
  created_at: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchWebsites();
    setupRealtimeSubscription();
  }, []);

  const fetchWebsites = async () => {
    const { data } = await supabase
      .from('website_monitoring')
      .select('*')
      .order('lastChecked', { ascending: false });

    if (data?.length) {
      setWebsites(data);
      setActiveUrl(data[0].address);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel('website_monitoring')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'website_monitoring' },
        (payload) => setWebsites(current => [payload.new as Website, ...current])
      )
      .subscribe();

    return () => subscription.unsubscribe();
  };

  const addWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, timeout: 2 }),
      });
      if (!response.ok) throw new Error('Failed to add website');
      setUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UP': return '#4ade80'; // pale green
      case 'DOWN': return '#f87171'; // pale red
      case 'DELAYED': return '#fbbf24'; // pale yellow
      default: return '#d1d5db'; // light grey
    }
  };

  const uniqueUrls = Array.from(new Set(websites.map(site => site.address)));
  const activeWebsiteData = websites
    .filter(site => site.address === activeUrl)
    .sort((a, b) => new Date(a.lastChecked).getTime() - new Date(b.lastChecked).getTime())
    .slice(-20);

    return (
<div className="px-4 md:px-8 lg:px-16 py-4 bg-white min-h-screen text-black">      
<h1 className="text-2xl font-bold mb-6">WatchMan</h1>
  
        <form onSubmit={addWebsite} className="mb-8 flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL"
            className="flex-1 px-3 py-2 rounded bg-white text-black border-gray-200 border"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-white text-black rounded hover:bg-gray-100 border border-gray-200"
          >
            {loading ? 'Adding...' : 'Monitor'}
          </button>
        </form>
  
        {error && <div className="mb-4 text-red-500">{error}</div>}
  
        <div className="flex gap-4 mb-4 flex-wrap">
          {uniqueUrls.map(url => (
            <button
              key={url}
              onClick={() => setActiveUrl(url)}
              className={`px-4 py-2 rounded border ${
                activeUrl === url 
                  ? 'bg-black text-white' 
                  : 'bg-white text-black hover:bg-gray-100 border-gray-200'
              }`}
            >
              {url}
            </button>
          ))}
        </div>
  
        {activeUrl && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              {(() => {
                const latest = websites.find(site => site.address === activeUrl);
                if (!latest) return null;
                return (
                  <div className="space-y-2">
                    <div 
                      className="inline-block px-3 py-1 rounded text-black font-medium"
                      style={{ backgroundColor: getStatusColor(latest.status) }}
                    >
                      {latest.status}
                    </div>
                    <p className="text-black">Latency: <span className="text-blue-500 font-medium">{latest.latency}ms</span></p>
                    <p className="text-gray-600">Message: {latest.message}</p>
                    <p className="text-gray-600">Last Checked: {new Date(latest.lastChecked).toLocaleString()}</p>
                  </div>
                );
              })()}
            </div>
  
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Latency History</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeWebsiteData}>
                    <XAxis 
                      dataKey="lastChecked"
                      tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                      stroke="#374151"
                    />
                    <YAxis stroke="#374151" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      formatter={(value: any) => [`${value}ms`, 'Latency']}
                    />
                    <Line 
                      type="monotone"
                      dataKey="latency"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
  
            <div className="bg-white p-6 rounded-lg border border-gray-200 overflow-x-auto">
              <h3 className="text-lg font-semibold mb-4">Recent History</h3>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-gray-600">Time</th>
                    <th className="text-left p-2 text-gray-600">Status</th>
                    <th className="text-left p-2 text-gray-600">Latency</th>
                    <th className="text-left p-2 text-gray-600">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {websites
                    .filter(site => site.address === activeUrl)
                    .slice(0, 10)
                    .map(site => (
                      <tr key={site.id} className="border-b border-gray-100">
                        <td className="p-2 text-gray-600">{new Date(site.lastChecked).toLocaleString()}</td>
                        <td className="p-2">
                          <span 
                            className="px-2 py-1 rounded text-black text-sm font-medium"
                            style={{ backgroundColor: getStatusColor(site.status) }}
                          >
                            {site.status}
                          </span>
                        </td>
                        <td className="p-2 text-blue-500 font-medium">{site.latency}ms</td>
                        <td className="p-2 text-gray-600">{site.message}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
}