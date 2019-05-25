
const
	builder = require('@cxl/build'),
	exec = require('child_process').execSync
;

exec('mkdir -p public/mode && cp -R node_modules/codemirror/mode/* public/mode');
exec('mkdir -p public/fonts && cp -R node_modules/font-awesome/fonts/* public/fonts');
