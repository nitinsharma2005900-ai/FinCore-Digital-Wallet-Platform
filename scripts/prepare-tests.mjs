import 'dotenv/config';
import {spawnSync} from 'node:child_process';
const admin=new URL(process.env.MIGRATION_DATABASE_URL);admin.pathname='/fincore_test';
const env={...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,MIGRATION_DATABASE_URL:admin.toString()};
for(const script of ['scripts/migrate.ts','database/seeds/seed.ts']){const r=spawnSync(process.execPath,['--import','tsx',script],{stdio:'inherit',env,windowsHide:true});if(r.status!==0)process.exit(r.status||1);}
