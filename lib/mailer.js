import { createTransport } from 'nodemailer';
import { email, password } from '../config.js';

export default function mailer(opts, fn) {
    let smtpTrans;


    try {
        smtpTrans = createTransport({
            service: 'Gmail',
            auth: {
                user: email,
                pass: password
            }
        });
    } catch (err) {
        console.error("Error creating transport:", err);
        fn("Nodemailer could not create a transport", JSON.stringify(err));
        return;
    }

    const mailOpts = {
        from: opts.from,
        replyTo: opts.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.body
    };


    try {
        smtpTrans.sendMail(mailOpts, function (error, response) {
            if (error) {
                fn(true, error);
                console.log("ERROR SENDING MAIL:", error);
            } else {
                fn(false, response.message);
            }
        });
    } catch (err) {
        console.error("Error sending mail:", err);
        fn('Nodemailer could not send mail', '');
    }
}