// app.js
import express from 'express';
import cors from 'cors';
import { STATUS_CODES as statusCodes } from 'http';
import request from 'request';
import mailer from './lib/mailer.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(process.env.supabase_url, process.env.supasbase_service_role);

const app = express();
app.use(cors({
    origin: 'http://localhost:3000', // Your Next.js app URL
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }));
app.use(express.json());

// In-memory storage for monitored websites and their status
const monitoredWebsites = new Map();
// Store SSE clients
const clients = new Set();

class WebsiteMonitor {
    constructor(url, timeout = 15) {
        this.url = url;
        this.timeout = timeout * 1000; // Convert to milliseconds
        this.status = 'PENDING';
        this.lastChecked = null;
        this.message = '';
        this.latency = null;
        this.handle = null;
        this.isChecking = false; // Flag to track if a check is in progress
        this.missedChecks = 0; // Counter for missed checks due to long responses
    }

    start() {
        console.log(`Starting monitoring for ${this.url}`);
        this.watch(); // Initial check
        this.handle = setInterval(() => {
            if (this.isChecking) {
                console.log(`Previous check for ${this.url} still in progress. Missed checks: ${++this.missedChecks}`);
                if (this.missedChecks >= 3) { // Alert after 3 consecutive missed checks
                    this.updateStatus('DELAYED', `Response time consistently exceeding ${this.timeout}ms`, null);
                }
                return;
            }
            this.watch();
        }, this.timeout);
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
                    timeout: this.timeout // Set request timeout to match interval
                }, (error, response, body) => {
                    if (error) reject(error);
                    else resolve(response);
                });

                req.on('timeout', () => {
                    req.abort();
                    reject(new Error(`Request timed out after ${this.timeout}ms`));
                });
            });

            const endTime = Date.now();
            const latency = endTime - startTime;
            this.missedChecks = 0; // Reset missed checks counter on successful response

            if (response.statusCode === 200) {
                this.updateStatus('UP', 'OK', latency);
            } else {
                this.updateStatus('DOWN', statusCodes[response.statusCode], latency);
                // this.sendAlertEmail();
            }
        } catch (error) {
            const errorLatency = Date.now() - startTime;
            this.updateStatus('DOWN', error.message, errorLatency);
            // this.sendAlertEmail();
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

        const statusUpdate = {
            url: this.url,
            status: this.status,
            message: this.message,
            lastChecked: this.lastChecked,
            latency: this.latency,
            missedChecks: this.missedChecks
        };

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

        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify(statusUpdate)}\n\n`);
        });
    }


    sendAlertEmail() {
        const htmlMsg = `
            <p>Time: ${this.lastChecked}</p>
            <p>Website: ${this.url}</p>
            <p>Message: ${this.message}</p>
        `;

        mailer({
            from: 'khalatevarun@gmail.com',
            to: 'varunnewsletter@gmail.com',
            subject: `Watchman Alert: ${this.url} is down`,
            body: htmlMsg
        }, (error, res) => {
            if (error) {
                console.log('Email error:', error);
            } else {
                console.log(res.message || 'Failed to send email');
            }
        });
    }
}

// API Endpoint 1: Add new website to monitor
app.post('/api/monitor', (req, res) => {
    const { url, timeout } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (monitoredWebsites.has(url)) {
        return res.status(400).json({ error: 'Website is already being monitored' });
    }

    const monitor = new WebsiteMonitor(url, timeout);
    monitoredWebsites.set(url, monitor);
    monitor.start();

    res.status(201).json({
        message: 'Website monitoring started',
        url,
        timeout
    });
});

// API Endpoint 2: SSE endpoint for status updates
app.get('/api/status-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial status for all monitored websites
    const initialStatus = Array.from(monitoredWebsites.entries()).map(([url, monitor]) => ({
        url,
        status: monitor.status,
        message: monitor.message,
        lastChecked: monitor.lastChecked
    }));

    res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

    const clientId = Date.now();
    const client = {
        id: clientId,
        res
    };

    clients.add(client);

    req.on('close', () => {
        clients.delete(client);
    });
});

// API Endpoint 3: Get list of monitored websites
app.get('/api/websites', (req, res) => {
    const websites = Array.from(monitoredWebsites.entries()).map(([url, monitor]) => ({
        url,
        status: monitor.status,
        message: monitor.message,
        lastChecked: monitor.lastChecked,
        timeout: monitor.timeout
    }));

    res.json(websites);
});

// API Endpoint 4: Remove website from monitoring
app.delete('/api/monitor/:url', (req, res) => {
    const url = decodeURIComponent(req.params.url);
    const monitor = monitoredWebsites.get(url);

    if (!monitor) {
        return res.status(404).json({ error: 'Website not found' });
    }

    monitor.stop();
    monitoredWebsites.delete(url);

    res.json({ message: 'Website monitoring stopped', url });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;