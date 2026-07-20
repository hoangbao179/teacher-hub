const fs=require('node:fs');
const path=require('node:path');
const source=path.join(__dirname,'..','src','db','migrations');
const target=path.join(__dirname,'..','dist','db','migrations');
fs.mkdirSync(target,{recursive:true});
for(const file of fs.readdirSync(source)){if(file.endsWith('.sql'))fs.copyFileSync(path.join(source,file),path.join(target,file));}
