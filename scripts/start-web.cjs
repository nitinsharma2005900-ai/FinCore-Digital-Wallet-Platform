const path=require('node:path');
/* eslint @typescript-eslint/no-require-imports: "off" -- This Node CLI bootstrap intentionally uses CommonJS. */
const root=path.resolve('apps/web');
const binary=require.resolve('next/dist/bin/next',{paths:[root]});
process.argv=[process.execPath,binary,'start',root,'--hostname','0.0.0.0','--port',process.env.WEB_PORT||process.env.PORT||'3000'];
require(binary);
/* global require, process */
