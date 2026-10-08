'use strict';
// Reuse the exact browser build inside the APK, including local sound effects.
const fs=require('node:fs'),path=require('node:path');
require('./build-web');
const root=path.resolve(__dirname,'..'),source=path.join(root,'dist'),target=path.join(root,'android/app/build/generated/gameAssets');
fs.mkdirSync(target,{recursive:true});fs.cpSync(source,target,{recursive:true});
for(const file of ['LICENSE','audio/LICENSE.md','THIRD_PARTY_NOTICES.md','licenses/APACHE-2.0.txt']){
  const destination=path.join(target,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination);
}
console.log('Android assets synced from the browser build.');
