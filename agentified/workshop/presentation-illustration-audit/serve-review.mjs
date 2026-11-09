#!/usr/bin/env node
import http from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const port=Number(process.env.AGENTIFIED_REVIEW_PORT||8738)
const mime={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.json':'application/json'}
http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname
  const file=path.resolve(here, `.${pathname}`)
  if(!file.startsWith(here+path.sep)){res.writeHead(403);res.end();return}
  let size
  try{size=statSync(file).size}catch{res.writeHead(404);res.end();return}
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'}
  const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'')
  let start=0,end=size-1,status=200
  if(match){start=Number(match[1]);end=match[2]?Number(match[2]):end;if(start>=size||end>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return}status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`}
  headers['Content-Length']=end-start+1
  res.writeHead(status,headers)
  if(req.method==='HEAD'){res.end();return}
  createReadStream(file,{start,end}).pipe(res)
}).listen(port,'127.0.0.1',()=>console.log(`Agentified review: http://127.0.0.1:${port}/review.html`))
