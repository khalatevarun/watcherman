import request from 'request';
import { STATUS_CODES as statusCodes } from 'http';
import mailer from './mailer.js';

export default class WatchMan {
    constructor(opts) {
        this.website = '';

        this.timeout = 15;

        this.handler = null;

        this.init(opts);
    }
    init(opts) {
        var self = this;
        self.website = opts.website;
        self.timeout = (opts.timeout * (60 * 1000));
        self.start();
    }
    start() {
        var self = this,
            time = Date.now();

        console.log("\n Loading " + self.website + " at " + self.getFormatedDate(time) + "\n");

        self.handle = setInterval(function () {
            self.watch();
        }, self.timeout);

    }
    watch() {
        var self = this, currentTime = Date.now();

        try {
            request(self.website, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    self.isOk();
                }
                else if (!error) {
                    self.isNotOk(response.statusCode);
                }
                else {
                    self.isNotOk();
                }
            });
        }
        catch (err) {
            self.isNotOk();
        }
    }
    isOk() {
        this.log('UP', 'OK');
    }
    isNotOk(statusCode) {
        var time = Date.now(), self = this, time = self.getFormatedDate(time), msg = statusCodes[statusCode + ''], htmlMsg = '<p>Time: ' + time;
        htmlMsg += '</p><p>Website: ' + self.website;
        htmlMsg += '</p><p>Message: ' + msg + '</p>';

        this.log('DOWN', msg);

        mailer({
            from: 'khalatevarun@gmail.com',
            to: 'varunnewsletter@gmail.com',
            subject: self.website + ' is down',
            body: htmlMsg
        }, function (error, res) {
            if (error) {
                console.log(error);
            }
            else {
                console.log(res.message || 'Failed to send email');
            }
        });
    }
    log(status, msg) {
        var self = this,
            time = Date.now(),
            output = '';
        
        output += "\nWebsite: " + self.website;
        output += "\nTime: " + self.getFormatedDate(time);
        output += "\nStatus: " + status;
        output += "\nMessage: " + msg  + "\n";
     
        console.log(output);
    }

    getFormatedDate(time){
        var currentDate = new Date(time);
 
        currentDate = currentDate.toISOString();
        currentDate = currentDate.replace(/T/, ' ');
        currentDate = currentDate.replace(/\..+/, '');
 
        return currentDate;
    }
}