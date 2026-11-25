const path=require('node:path');
const root=path.resolve('apps/web');
const binary=require.resolve('next/dist/bin/next',{paths:[root]});
process.argv=[process.execPath,binary,'start',root,'--hostname','0.0.0.0','--port',process.env.WEB_PORT||process.env.PORT||'3000'];
require(binary);
