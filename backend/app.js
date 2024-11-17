// app.js
import express from 'express';
import cors from 'cors';
import { STATUS_CODES as statusCodes } from 'http';
import request from 'request';
import mailer from './lib/mailer.js';
import { createClient } from '@supabase/supabase-js';
import { supabase_url, supasbase_service_role } from './config.js';

// Initialize Supabase client
const supabase = createClient(supabase_url, supasbase_service_role);

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
        this.timeout = timeout * (60 * 1000);
        this.status = 'PENDING';
        this.lastChecked = null;
        this.message = '';
        this.handle = null;
    }

    start() {
        console.log(`Starting monitoring for ${this.url}`);
        this.watch(); // Initial check
        this.handle = setInterval(() => this.watch(), this.timeout);
    }

    stop() {
        if (this.handle) {
            clearInterval(this.handle);
            this.handle = null;
        }
    }

    async watch() {
        try {
            const response = await new Promise((resolve, reject) => {
                request(this.url, (error, response, body) => {
                    if (error) reject(error);
                    else resolve(response);
                });
            });

            if (response.statusCode === 200) {
                this.updateStatus('UP', 'OK');
            } else {
                this.updateStatus('DOWN', statusCodes[response.statusCode]);
                this.sendAlertEmail();
            }
        } catch (error) {
            this.updateStatus('DOWN', error.message);
            this.sendAlertEmail();
        }
    }

   async updateStatus(status, message) {
        this.status = status;
        this.message = message;
        this.lastChecked = new Date().toISOString();

        // Notify all connected clients
        const statusUpdate = {
            url: this.url,
            status: this.status,
            message: this.message,
            lastChecked: this.lastChecked
        };

                
        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify(statusUpdate)}\n\n`);
        });
        
        // Store in Supabase
        try {
            const { error } = await supabase
                .from('website_monitoring')
                .insert([{
                    address: this.url,
                    status: this.status === 'UP' ? true : false,
                    message: this.message,
                    lastChecked: this.lastChecked
                }]);

            if (error) {
                console.error('Error storing status in Supabase:', error);
            }
        } catch (error) {
            console.error('Failed to store status in Supabase:', error);
        }

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