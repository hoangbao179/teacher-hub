import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import { DownloadRounded, RefreshRounded, ReplayRounded } from "@mui/icons-material";
import type { PdfBatch, PdfBatchList, PdfCapabilities, PdfJob, PdfJobStatus } from "@teacher/shared";
import { pdfApi, pdfDriveId } from "../api/pdf";
import { ApiError } from "../api/client";

const statuses: Record<PdfJobStatus,string> = {
  ENQUEUE_PENDING:"Đang chuẩn bị",ENQUEUE_RETRY:"Đang thử lại",QUEUED:"Đang chờ xử lý",
  COMPLETED:"Hoàn thành",FAILED:"Thất bại",RETRY_EXHAUSTED:"Hết lượt thử tự động",
  RESULT_UNCONFIRMED:"Chưa xác nhận kết quả",EXPIRED:"Hết hạn",
};
const ongoing = ["ENQUEUE_PENDING","ENQUEUE_RETRY","QUEUED","RESULT_UNCONFIRMED","RETRY_EXHAUSTED"];
const date = (d:string) => new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(d));
function message(error:unknown):string {
  if (!(error instanceof ApiError)) return "Có lỗi xảy ra. Vui lòng thử lại.";
  switch(error.code) {
    case "PDF_SERVICE_UNAVAILABLE":return "Công cụ đang được chuẩn bị, chưa thể xử lý tài liệu.";
    case "PDF_RATE_LIMITED":return "Đã đạt giới hạn xử lý. Vui lòng quay lại sau.";
    case "PDF_GUEST_SESSION_REQUIRED":return "Phiên trình duyệt đã hết hạn. Tải lại trang để bắt đầu phiên mới.";
    case "PDF_RETRY_BUSY":return "Tài liệu đang được hệ thống kiểm tra, vui lòng thử lại sau.";
    case "PDF_NOT_DOWNLOADABLE":return "Tài liệu chưa sẵn sàng hoặc đã hết hạn tải.";
    case "NETWORK_ERROR":return "Mất kết nối. Có thể công việc đã được ghi nhận; hãy thử lại bằng cùng yêu cầu.";
    default:return "Thao tác chưa thành công. Vui lòng thử lại.";
  }
}
function title(job:PdfJob):string { return "Tài liệu " + job.fileId.slice(0,14) + (job.fileId.length>14?"…":"") + ".pdf"; }
export function PublicPdfTool() {
  const [caps,setCaps]=useState<PdfCapabilities|null>(null);
  const [history,setHistory]=useState<PdfBatchList|null>(null);
  const [details,setDetails]=useState<Record<string,PdfBatch>>({});
  const [links,setLinks]=useState("");
  const [rights,setRights]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [page,setPage]=useState(1);
  const mounted=useRef(true),inFlight=useRef(false);
  const createAttempt=useRef<{fingerprint:string;key:string}|null>(null);
  const retryAttempts=useRef(new Map<string,string>());
  const enabled=caps?.submitEnabled===true;
  const parts=useMemo(()=>links.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),[links]);
  const invalid=useMemo(()=>{
    if(!parts.length)return "Vui lòng nhập ít nhất một liên kết.";
    if(parts.length>(caps?.maxLinksPerBatch??5))return "Chỉ nhận tối đa 5 liên kết/lần.";
    const ids=parts.map(pdfDriveId);
    if(ids.some(id=>!id))return "Chỉ hỗ trợ liên kết Drive /file/d/…/view hoặc /open?id=…";
    if(new Set(ids).size!==ids.length)return "Danh sách chứa liên kết trùng nhau.";
    return "";
  },[parts,caps?.maxLinksPerBatch]);
  const refresh=useCallback(async(p=1)=>{
    if(inFlight.current)return;
    inFlight.current=true;
    try{
      const [cap,list]=await Promise.all([pdfApi.capabilities(),pdfApi.list(p)]);
      if(!mounted.current)return;
      setCaps(cap);setHistory(list);
      const batches=await Promise.all(list.items.map(async item=>pdfApi.detail(item.id).catch(()=>null)));
      if(mounted.current)setDetails(Object.fromEntries(batches.filter((b):b is PdfBatch=>!!b).map(b=>[b.id,b])));
      setError("");
    }catch(e){if(mounted.current)setError(message(e));}
    finally{inFlight.current=false;if(mounted.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    mounted.current=true;
    queueMicrotask(()=>{if(mounted.current)void refresh(page);});
    const timer=window.setInterval(()=>{if(!document.hidden&&!inFlight.current)void refresh(page);},15000);
    return ()=>{mounted.current=false;window.clearInterval(timer);};
  },[refresh,page]);
  async function submit(){
    if(busy||!enabled||invalid||!rights)return;
    setBusy(true);setError("");setNotice("");
    const fingerprint=JSON.stringify(parts);
    const key=createAttempt.current?.fingerprint===fingerprint?createAttempt.current.key:crypto.randomUUID();
    createAttempt.current={fingerprint,key};
    try{
      await pdfApi.session();
      const batch=await pdfApi.create({links:parts,rightsConfirmed:true},key);
      createAttempt.current=null;
      setNotice("Đã ghi nhận "+batch.jobs.length+" tài liệu. Có thể đóng trang và quay lại xem kết quả.");
      setLinks("");setRights(false);setPage(1);
      await refresh(1);
    }catch(e){setError(message(e));}
    finally{setBusy(false);}
  }
  async function retry(job:PdfJob){
    if(busy||!enabled)return;
    setBusy(true);setError("");setNotice("");
    const key=retryAttempts.current.get(job.id)??crypto.randomUUID();
    retryAttempts.current.set(job.id,key);
    try{await pdfApi.retry(job.id,key);retryAttempts.current.delete(job.id);setNotice("Đã gửi lại yêu cầu xử lý.");await refresh(page);}
    catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function download(job:PdfJob){
    if(busy||caps?.downloadEnabled!==true)return;
    setBusy(true);setError("");setNotice("");
    try{
      const grant=await pdfApi.ticket(job.id);
      const controller=new AbortController();
      const timer=window.setTimeout(()=>controller.abort(),30000);
      let blob:Blob;
      try{blob=await pdfApi.download(grant.downloadPath,grant.ticket,controller.signal);}
      finally{window.clearTimeout(timer);}
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download=title(job);document.body.append(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(message(e));}finally{setBusy(false);}
  }
  return <Box data-testid="public-pdf-tool" sx={{maxWidth:820,mx:"auto",color:"#563c49"}}>
    {error&&<Alert severity="error" role="alert" sx={{mb:2}}>{error}</Alert>}
    {notice&&<Alert severity="success" sx={{mb:2}}>{notice}</Alert>}
    <Paper elevation={0} sx={{p:{xs:2.5,sm:3},border:"1px solid #f2dce5",borderRadius:4,bgcolor:"#fff"}}>
      <Typography component="h2" sx={{fontWeight:800,fontSize:21,mb:1}}>Tạo tài liệu PDF</Typography>
      <Typography sx={{fontSize:14,color:"#866a77"}}>Dán link Google Drive, mỗi dòng một link. Có thể mở lại trang trên thiết bị khác để xem kết quả.</Typography>
      {loading?<Stack component="div" direction="row" spacing={1} sx={{mt:2,alignItems:"center"}}><CircularProgress size={20}/><Typography>Đang kiểm tra công cụ…</Typography></Stack>:
        !enabled?<Alert severity="info" sx={{mt:2}}>Công cụ PDF đang được chuẩn bị. Chưa thể tạo tài liệu lúc này.</Alert>:null}
      <TextField label="Liên kết Google Drive" data-testid="pdf-links" fullWidth multiline minRows={3} maxRows={8} sx={{mt:2}}
        placeholder="https://drive.google.com/file/d/…/view" value={links} disabled={!enabled||busy}
        onChange={e=>setLinks(e.target.value)} helperText="Tối đa 5 liên kết, mỗi dòng một link."/>
      {enabled&&links.trim()&&invalid&&<Typography role="alert" sx={{fontSize:13,color:"#b3261e",mt:1}}>{invalid}</Typography>}
      <FormControlLabel control={<Checkbox checked={rights} disabled={!enabled||busy} onChange={e=>setRights(e.target.checked)}/>}
        label={<Typography sx={{fontSize:13.5}}>Tôi có quyền tải xuống và sử dụng các tài liệu này.</Typography>} sx={{mt:1}}/>
      <Button data-testid="pdf-submit" fullWidth variant="contained" disabled={!enabled||busy||!!invalid||!rights}
        onClick={()=>void submit()} sx={{mt:2,minHeight:48,bgcolor:"#b96d8d","&:hover":{bgcolor:"#985170"}}}>
        {busy?"Đang thực hiện…":"Tạo PDF"}
      </Button>
    </Paper>
    <Paper component="section" elevation={0} sx={{mt:3,p:{xs:2.5,sm:3},border:"1px solid #f2dce5",borderRadius:4,bgcolor:"#fff"}}>
      <Stack component="div" direction="row" spacing={1} sx={{alignItems:"center",justifyContent:"space-between"}}>
        <Typography component="h2" sx={{fontWeight:800,fontSize:19}}>Tài liệu đã xử lý</Typography>
        <Button startIcon={<RefreshRounded/>} onClick={()=>void refresh(page)} disabled={busy||loading} sx={{minHeight:44,color:"#b96d8d"}}>Làm mới</Button>
      </Stack>
      {!history?.items.length?<Typography sx={{mt:2,color:"#866a77"}}>Chưa có tài liệu nào được gửi lên công cụ.</Typography>:
        <Stack component="div" spacing={2} sx={{mt:2}}>
          {history.items.map(batch=><Box key={batch.id} sx={{border:"1px solid #f4e6ec",borderRadius:3,p:2}}>
            <Typography sx={{fontSize:12,color:"#866a77",mb:1}}>Ngày gửi: {date(batch.createdAt)}</Typography>
            {(details[batch.id]?.jobs??[]).map(job=>{
              const expired=Date.parse(job.expiresAt)<=Date.now();
              const completed=job.status==="COMPLETED"&&!expired;
              const retryable=["FAILED","RETRY_EXHAUSTED","EXPIRED"].includes(job.status)&&job.retryAttempts<(caps?.maxRetries??2);
              return <Box data-testid="pdf-job" key={job.id} sx={{py:1.5,borderTop:"1px solid #f4e6ec"}}>
                <Stack component="div" direction="row" spacing={1} sx={{justifyContent:"space-between",alignItems:"flex-start"}}>
                  <Box sx={{minWidth:0}}>
                    <Typography sx={{fontWeight:700,overflowWrap:"anywhere",fontSize:14}}>{title(job)}</Typography>
                    <Typography sx={{fontSize:12,color:"#866a77"}}>{job.pages!==null?job.pages+" trang · ":""}{job.bytes!==null?(job.bytes/1048576).toFixed(2)+" MB":"Chưa có dung lượng"}</Typography>
                  </Box>
                  <Chip size="small" color={completed?"success":"default"} label={expired?"Hết hạn":statuses[job.status]}/>
                </Stack>
                {job.status==="RESULT_UNCONFIRMED"&&!expired&&<Typography sx={{fontSize:12,mt:1}}>Chưa xác nhận được kết quả. Hệ thống đang tiếp tục kiểm tra.</Typography>}
                {ongoing.includes(job.status)&&!expired&&<Typography sx={{fontSize:12,mt:1,color:"#866a77"}}>Có thể đóng trang trong khi chờ.</Typography>}
                <Stack component="div" direction="row" sx={{mt:1,gap:1,flexWrap:"wrap"}}>
                  {completed&&<Button data-testid="pdf-download" startIcon={<DownloadRounded/>} disabled={busy||caps?.downloadEnabled!==true}
                    onClick={()=>void download(job)} sx={{minHeight:44,color:"#b96d8d"}}>Tải PDF</Button>}
                  {retryable&&<Button data-testid="pdf-retry" startIcon={<ReplayRounded/>} disabled={busy||!enabled}
                    onClick={()=>void retry(job)} sx={{minHeight:44,color:"#b96d8d"}}>Thử lại</Button>}
                </Stack>
              </Box>;
            })}
          </Box>)}
          {history.total>history.pageSize&&<Stack component="div" direction="row" sx={{justifyContent:"space-between"}}>
            <Button disabled={page===1} onClick={()=>setPage(page-1)}>Trang trước</Button>
            <Typography sx={{alignSelf:"center"}}>Trang {page}</Typography>
            <Button disabled={page*history.pageSize>=history.total} onClick={()=>setPage(page+1)}>Trang sau</Button>
          </Stack>}
        </Stack>}
    </Paper>
  </Box>;
}
