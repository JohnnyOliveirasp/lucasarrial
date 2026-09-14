// READ-ONLY: lista o prefixo ref/ da voz no R2 (procura auto.wav e auto.bak-*)
const fs=require("fs"),path=require("path");
const FRONTEND=path.resolve(__dirname,"..","..","frontend");
(function loadEnv(){const raw=fs.readFileSync(path.join(FRONTEND,".env.local"),"utf8");for(const l of raw.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]=v;}})();
const req=(n)=>{const v=process.env[n];if(!v)throw new Error(`Missing ${n}`);return v;};
const {S3Client,ListObjectsV2Command}=require(path.join(FRONTEND,"node_modules","@aws-sdk/client-s3"));
const s3=new S3Client({region:"auto",endpoint:req("R2_ENDPOINT"),credentials:{accessKeyId:req("R2_ACCESS_KEY_ID"),secretAccessKey:req("R2_SECRET_ACCESS_KEY")}});
(async()=>{
  const prefix="915cf384-243d-4b48-88c0-82c82dde7cd9/d1793844-c00b-4cf3-b260-6f4c31a6a9f8/ref/";
  const r=await s3.send(new ListObjectsV2Command({Bucket:req("R2_BUCKET_VOICES"),Prefix:prefix}));
  for(const o of (r.Contents||[])) console.log(o.LastModified.toISOString(), String(o.Size).padStart(9), o.Key.replace(prefix,""));
  if(!r.Contents) console.log("(prefixo vazio)");
})().catch(e=>{console.error("ERRO:",e.message);process.exit(1)});
