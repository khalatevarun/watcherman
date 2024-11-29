import { createClient } from '@supabase/supabase-js';
import request from 'request';
import { STATUS_CODES as statusCodes } from 'http';
import 'dotenv/config';

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE ?? ''
);

class WebsiteMonitor {
    constructor(url, frequency) {
        this.url = url;
        this.frequency = frequency * 1000; // Convert to milliseconds
        this.status = 'PENDING';
        this.lastChecked = null;
        this.message = '';
        this.latency = null;
        this.handle = null;
        this.isChecking = false;
        this.missedChecks = 0;
    }

    start() {
        console.log(`Starting monitoring for ${this.url} with frequency ${this.frequency}ms`);
        this.watch(); // Initial check
        this.handle = setInterval(() => {
            if (this.isChecking) {
                console.log(`Previous check for ${this.url} still in progress. Missed checks: ${++this.missedChecks}`);
                if (this.missedChecks >= 3) {
                    this.updateStatus('DELAYED', `Response time consistently exceeding ${this.frequency}ms`, null);
                }
                return;
            }
            this.watch();
        }, this.frequency);
    }

    stop() {
        if (this.handle) {
            clearInterval(this.handle);
            this.handle = null;
        }
        this.isChecking = false;
        this.missedChecks = 0;
    }

    async watch() {
        this.isChecking = true;
        const startTime = Date.now();

        try {
            const response = await new Promise((resolve, reject) => {
                const req = request({
                    url: this.url,
                    timeout: this.frequency
                }, (error, response, body) => {
                    if (error) reject(error);
                    else resolve(response);
                });

                req.on('timeout', () => {
                    req.abort();
                    reject(new Error(`Request timed out after ${this.frequency}ms`));
                });
            });

            const endTime = Date.now();
            const latency = endTime - startTime;
            this.missedChecks = 0;

            if (response.statusCode === 200) {
                this.updateStatus('UP', 'OK', latency);
            } else {
                this.updateStatus('DOWN', statusCodes[response.statusCode], latency);
            }
        } catch (error) {
            const errorLatency = Date.now() - startTime;
            this.updateStatus('DOWN', error.message, errorLatency);
        } finally {
            this.isChecking = false;
        }
    }

    async updateStatus(status, message, latency) {
        this.status = status;
        this.message = message;
        this.latency = latency;
        this.lastChecked = new Date().toISOString();

        console.log(`[${this.url}] Status: ${status}, Message: ${message}, Latency: ${latency}ms`);

        try {
            const { error } = await supabase
                .from('website_monitoring')
                .insert([{
                    address: this.url,
                    status: this.status,
                    message: this.message,
                    lastChecked: this.lastChecked,
                    latency: this.latency,
                }]);

            if (error) {
                console.error('Error storing status in Supabase:', JSON.stringify(error));
            }
        } catch (error) {
            console.error('Failed to store status in Supabase:', error.message);
        }
    }
}

class MonitoringService {
    constructor() {
        this.monitors = new Map();
        this.isListening = false;
    }

    async start() {
        // Initial load of websites
        await this.loadWebsites();
        
        // Start real-time subscription
        this.startRealtimeSubscription();
    }

    async loadWebsites() {
        try {
            const { data, error } = await supabase
                .from('website_list')
                .select('address, freq');

            if (error) throw error;

            // Stop any existing monitors
            this.monitors.forEach(monitor => monitor.stop());
            this.monitors.clear();

            // Start new monitors
            data.forEach(({ address, freq }) => {
                const monitor = new WebsiteMonitor(address, freq);
                this.monitors.set(address, monitor);
                monitor.start();
            });
        } catch (error) {
            console.error('Failed to load websites:', error);
        }
    }

    startRealtimeSubscription() {
        const subscription = supabase
            .channel('website_list_changes')
            .on('postgres_changes', 
                {
                    event: '*',
                    schema: 'public',
                    table: 'website_list',
                    config: {
                        old_commit_timestamp: true,
                        include_old_record: true,
                        include_full_old_record: true  // This is key
                      }
                },
                async (payload) => {
                    console.log('Change received:', payload);
                    await this.handleDatabaseChange(payload);
                }
            )
            .subscribe();
    }

    async handleDatabaseChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        console.log('Handling change:', eventType, newRecord, oldRecord);

        switch (eventType) {
            case 'INSERT':
                const monitor = new WebsiteMonitor(newRecord.address, newRecord.freq);
                this.monitors.set(newRecord.address, monitor);
                monitor.start();
                break;

            case 'DELETE':
                const existingMonitor = this.monitors.get(oldRecord.address);
                if (existingMonitor) {
                    existingMonitor.stop();
                    this.monitors.delete(oldRecord.address);
                }

                // Clean up monitoring history
                try {
                    await supabase
                        .from('website_monitoring')
                        .delete()
                        .eq('address', oldRecord.address);
                } catch (error) {
                    console.error(`Failed to clean up monitoring history for ${oldRecord.address}:`, error);
                }

                break;

            // case 'UPDATE':
            //     const updatedMonitor = this.monitors.get(newRecord.address);
            //     if (updatedMonitor) {
            //         updatedMonitor.stop();
            //     }
            //     const newMonitor = new WebsiteMonitor(newRecord.address, newRecord.freq);
            //     this.monitors.set(newRecord.address, newMonitor);
            //     newMonitor.start();
            //     break;
        }
    }
}

// Start the monitoring service
const monitoringService = new MonitoringService();
monitoringService.start().catch(console.error);