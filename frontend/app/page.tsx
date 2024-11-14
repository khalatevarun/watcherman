// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import styles from "./page.module.css";

interface Website {
  url: string;
  status: string;
  message: string;
  lastChecked: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);

  useEffect(() => {
    // Set up SSE connection
    const sse = new EventSource('http://localhost:3001/api/status-stream');

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setWebsites(Array.isArray(data) ? data : [data]);
    };

    sse.onerror = (error) => {
      console.error('SSE Error:', error);
      sse.close();
    };

    // Cleanup on unmount
    return () => {
      sse.close();
    };
  }, []);

  const addWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          timeout: 0.25
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add website');
      }

      setUrl('');
      // Status updates will come through SSE
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'UP':
        return styles.statusUp;
      case 'DOWN':
        return styles.statusDown;
      default:
        return styles.statusPending;
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.title}>
          <h2>WatchMan - Focus on building great products and let us monitor the rest</h2>
        </div>

        <form onSubmit={addWebsite} className={styles.monitorForm}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL to monitor"
            required
            className={styles.input}
          />
          <button 
            type="submit" 
            disabled={loading}
            className={styles.button}
          >
            {loading ? (
              <>
                <svg 
                  className={styles.loading} 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    fill="currentColor" 
                    d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"
                  />
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    fill="currentColor" 
                    d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M13,7H11V11H7V13H11V17H13V13H17V11H13V7Z"
                  />
                </svg>
                Add Website
              </>
            )}
          </button>
        </form>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <div className={styles.websiteList}>
          {websites.map((website, index) => (
            <div key={website.url + index} className={styles.websiteCard}>
              <div className={styles.websiteHeader}>
                <div className={styles.websiteUrl}>{website.url}</div>
                <span className={`${styles.status} ${getStatusClass(website.status)}`}>
                  {website.status}
                </span>
              </div>
              <div className={styles.websiteInfo}>
                {website.message && (
                  <div>Message: {website.message}</div>
                )}
                {website.lastChecked && (
                  <div>
                    Last checked: {new Date(website.lastChecked).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}