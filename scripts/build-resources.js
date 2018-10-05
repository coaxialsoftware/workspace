
const
	builder = require('@cxl/build'),
	exec = require('child_process').execSync
;

exec('cp -r node_modules/codemirror/mode/* public/mode');
exec('cp -r node_modules/font-awesome/fonts/* public/fonts');
