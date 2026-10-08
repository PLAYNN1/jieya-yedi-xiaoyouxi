'use strict';
// Personal release key is generated once and excluded from Git. Keep it for updates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.private/android-signing');
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
const java=process.env.JAVA_HOME;
if(!sdk||!java)throw Error('Set JAVA_HOME and ANDROID_HOME before signing.');
const unsigned=path.join(root,'android/app/build/outputs/apk/release/app-release-unsigned.apk');
if(!fs.existsSync(unsigned))throw Error('Build assembleRelease in android/ first.');
const windows=process.platform==='win32',bin=name=>path.join(java,'bin',name+(windows?'.exe':''));
const version=require('../package.json').version;
const buildTools=fs.readdirSync(path.join(sdk,'build-tools')).filter(v=>/^\d+(\.\d+)+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
if(!buildTools)throw Error('Install Android SDK build-tools.');
const tool=name=>path.join(sdk,'build-tools',buildTools,name);
const output=path.join(root,'outputs'),apk=path.join(output,'jieya-yedi-v'+version+'.apk');
fs.mkdirSync(privateDir,{recursive:true});fs.mkdirSync(output,{recursive:true});
const key=path.join(privateDir,'yedi-release.jks'),password=path.join(privateDir,'password.txt');
function run(command,args){
  const result=spawnSync(command,args,{stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;if(result.status!==0)throw Error('Android signing tool failed.');
}
if(!fs.existsSync(key)){
  if(!fs.existsSync(password))fs.writeFileSync(password,crypto.randomBytes(36).toString('base64url'),{mode:0o600});
  run(bin('keytool'),['-genkeypair','-keystore',key,'-storepass:file',password,'-keypass:file',password,'-alias','yedi','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=PLAYNN1 YEDI, OU=Open Source, O=YEDI, C=CN','-noprompt']);
}
if(!fs.existsSync(password))throw Error('The existing release key needs its original password file.');
run(tool(windows?'zipalign.exe':'zipalign'),['-f','-p','4',unsigned,apk]);
const signer=tool('lib/apksigner.jar');
run(bin('java'),['-jar',signer,'sign','--ks',key,'--ks-key-alias','yedi','--ks-pass','file:'+password,apk]);
run(bin('java'),['-jar',signer,'verify','--verbose','--print-certs',apk]);
const hash=crypto.createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
fs.writeFileSync(apk+'.sha256',hash+'  '+path.basename(apk)+'\n');
console.log('Signed APK: outputs/'+path.basename(apk));
