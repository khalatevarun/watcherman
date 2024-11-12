import WatchMan from './lib/watchman.js';
const websites = [
{
    url: 'http://crushit-compiler.herokuapp.com',
    timeout: 0.25
}];

const monitors = [];

websites.forEach(function (website) {
    const monitor = new WatchMan({
        website: website.url,
        timeout: website.timeout
    });
    monitors.push(monitor);
});