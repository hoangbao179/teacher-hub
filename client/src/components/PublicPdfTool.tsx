import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import { DownloadRounded, RefreshRounded, ReplayRounded } from "@mui/icons-material";
import { pdfFilename } from "@teacher/shared";
import type { PdfBatch, PdfBatchList, PdfCapabilities, PdfJob, PdfJobStatus } from "@teacher/shared";
import { pdfApi, pdfDriveId } from "../api/pdf";
import { ApiError } from "../api/client";
import { pdfBatchNeedsPolling } from "../api/pdfPolling";

const statuses: Record<PdfJobStatus,string> = {
  ENQUEUE_PENDING:"Đang chuẩn bị",ENQUEUE_RETRY:"Đang thử lại",QUEUED:"Đang chờ xử lý",
  COMPLETED:"Hoàn thành",FAILED:"Thất bại",RETRY_EXHAUSTED:"Hết lượt thử tự động",
  RESULT_UNCONFIRMED:"Chưa xác nhận kết quả",EXPIRED:"Hết hạn",
};
const ongoing = ["ENQUEUE_PENDING","ENQUEUE_RETRY","QUEUED","RESULT_UNCONFIRMED","RETRY_EXHAUSTED"];
const failureReasons: Record<string,string> = {
  ACCESS_DENIED: "Không truy cập được tài liệu từ liên kết này (thường do link không xem được khi ẩn danh). Hãy mở thử cửa sổ ẩn danh hoặc xin chủ file chia sẻ Viewer công khai.",
  PRINT_UNAVAILABLE: "Trình xem chưa sẵn sàng hoặc giao diện Google Drive thay đổi. Thử lại sau; thiếu nút In vẫn có thể tạo PDF nếu Viewer mở được ẩn danh.",
  UNSUPPORTED_SOURCE: "Không lấy được bản PDF hợp lệ từ liên kết này.",
  INVALID_PDF: "Nguồn trả về không phải PDF hợp lệ.",
  FILE_TOO_LARGE: "Tệp lớn hơn giới hạn xử lý.",
  PAGE_LIMIT_EXCEEDED: "Tài liệu có quá nhiều trang.",
  JOB_EXPIRED: "Công việc đã hết hạn.",
};
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
function title(job:PdfJob):string { return pdfFilename(job.filename,job.fileId); }
export function PublicPdfTool() {
  const [caps,setCaps]=useState<PdfCapabilities|null>(null);
  const [history,setHistory]=useState<PdfBatchList|null>(null);
  const [details,setDetails]=useState<Record<string,PdfBatch>>({});
  const [links,setLinks]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [downloadFeedback,setDownloadFeedback]=useState<{jobId:string;text:string;error:boolean}|null>(null);
  useEffect(()=>{
    if(!downloadFeedback || downloadFeedback.error)return;
    const timer=window.setTimeout(()=>setDownloadFeedback(null),6500);
    return ()=>window.clearTimeout(timer);
  },[downloadFeedback]);
  const [page,setPage]=useState(1);
  const mounted=useRef(true),inFlight=useRef(false);
  const detailCache=useRef<Record<string,PdfBatch>>({});
  const visiblePage=useRef(1),activePage=useRef(1),pendingRefresh=useRef<number|null>(null);
  const createAttempt=useRef<{fingerprint:string;key:string}|null>(null);
  const retryAttempts=useRef(new Map<string,string>());
  const enabled=caps?.submitEnabled===true;
  const parts=useMemo(()=>links.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),[links]);
  const invalid=useMemo(()=>{
    if(!parts.length)return "Vui lòng nhập ít nhất một liên kết.";
    if(parts.length>(caps?.maxLinksPerBatch??5))return `Chỉ nhận tối đa ${caps?.maxLinksPerBatch??5} liên kết/lần.`;
    const ids=parts.map(pdfDriveId);
    if(ids.some(id=>!id))return "Chỉ hỗ trợ liên kết Drive /file/d/…/view hoặc /open?id=…";
    if(new Set(ids).size!==ids.length)return "Danh sách chứa liên kết trùng nhau.";
    return "";
  },[parts,caps?.maxLinksPerBatch]);
  const refresh=useCallback(async function refreshPage(p=1,force=true):Promise<void>{
    if(inFlight.current){if(force)pendingRefresh.current=p;return;}
    inFlight.current=true;
    activePage.current=p;
    try{
      const [cap,list]=await Promise.all([pdfApi.capabilities(),pdfApi.list(p)]);
      if(!mounted.current)return;
      const cached=detailCache.current;
      const next:Record<string,PdfBatch>={};
      for(const item of list.items)if(cached[item.id])next[item.id]=cached[item.id];
      const due=list.items.filter(item=>force||!cached[item.id]||pdfBatchNeedsPolling(cached[item.id]));
      // Limit concurrent detail reads, including first load/manual refresh of 20 batches.
      for(let start=0;start<due.length;start+=4){
        const batches=await Promise.all(due.slice(start,start+4).map(async item=>pdfApi.detail(item.id).catch(()=>null)));
        for(const batch of batches)if(batch)next[batch.id]=batch;
      }
      if(mounted.current&&visiblePage.current===p){
        detailCache.current=next;setCaps(cap);setHistory(list);setDetails(next);setError("");
      }
    }catch(e){if(mounted.current)setError(message(e));}
    finally{
      inFlight.current=false;
      if(mounted.current){
        setLoading(false);
        const pending=pendingRefresh.current;pendingRefresh.current=null;
        if(pending!==null)void refreshPage(pending,true);
      }
    }
  },[]);
  const needsFastPoll=useMemo(()=>Object.values(details).some(batch=>pdfBatchNeedsPolling(batch)),[details]);
  useEffect(()=>{
    mounted.current=true;
    visiblePage.current=page;
    queueMicrotask(()=>{
      if(!mounted.current)return;
      if(inFlight.current){if(activePage.current!==page)pendingRefresh.current=page;}
      else void refresh(page,false);
    });
    const timer=window.setInterval(()=>{if(!document.hidden&&!inFlight.current)void refresh(page,false);},needsFastPoll?5000:15000);
    return ()=>{mounted.current=false;window.clearInterval(timer);};
  },[refresh,page,needsFastPoll]);
  async function submit(){
    if(busy||!enabled||invalid)return;
    setBusy(true);setError("");setNotice("");setDownloadFeedback(null);
    const fingerprint=JSON.stringify(parts);
    const key=createAttempt.current?.fingerprint===fingerprint?createAttempt.current.key:crypto.randomUUID();
    createAttempt.current={fingerprint,key};
    try{
      await pdfApi.session();
      const batch=await pdfApi.create({links:parts},key);
      createAttempt.current=null;
      setNotice("Đã ghi nhận "+batch.jobs.length+" tài liệu. Có thể đóng trang và quay lại xem kết quả.");
      setLinks("");setPage(1);
      await refresh(1);
    }catch(e){setError(message(e));}
    finally{setBusy(false);}
  }
  async function retry(job:PdfJob){
    if(busy||!enabled)return;
    setBusy(true);setError("");setNotice("");setDownloadFeedback(null);
    const key=retryAttempts.current.get(job.id)??crypto.randomUUID();
    retryAttempts.current.set(job.id,key);
    try{await pdfApi.retry(job.id,key);retryAttempts.current.delete(job.id);setNotice("Đã gửi lại yêu cầu xử lý.");await refresh(page);}
    catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function download(job:PdfJob){
    if(busy||caps?.downloadEnabled!==true)return;
    setBusy(true);setError("");setNotice("");setDownloadFeedback(null);
    try{
      const grant=await pdfApi.ticket(job.id);
      if(!mounted.current)return;
      if(job.workerVersion===2){pdfApi.downloadNative(grant.downloadPath,grant.ticket);setDownloadFeedback({jobId:job.id,text:"Đã gửi yêu cầu tải PDF cho trình duyệt.",error:false});return;}
      const controller=new AbortController();
      const timer=window.setTimeout(()=>controller.abort(),30000);
      let blob:Blob;
      try{blob=await pdfApi.download(grant.downloadPath,grant.ticket,controller.signal);}
      finally{window.clearTimeout(timer);}
      if(!mounted.current)return;
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download=title(job);document.body.append(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){if(mounted.current)setDownloadFeedback({jobId:job.id,text:message(e),error:true});}finally{if(mounted.current)setBusy(false);}
  }
  return <Box data-testid="public-pdf-tool" sx={{color:"#563c49",minWidth:0}}>
    {error&&<Alert severity="error" role="alert" sx={{mb:2}}>{error}</Alert>}
    {notice&&<Alert severity="success" sx={{mb:2}}>{notice}</Alert>}
    <Box sx={{display:"grid",gridTemplateColumns:"minmax(0, 1fr)",gap:3,alignItems:"start","@media (min-width:1024px)":{gridTemplateColumns:"minmax(0, 0.85fr) minmax(0, 1.65fr)"}}}>
    <Paper elevation={0} sx={{p:{xs:2,sm:3},border:"1px solid #f2dce5",borderRadius:4,bgcolor:"#fff"}}>
      <Typography component="h2" sx={{fontWeight:800,fontSize:21,mb:1}}>Tạo tài liệu PDF</Typography>
      <Typography sx={{fontSize:14,color:"#866a77"}}>Dán link Google Drive, mỗi dòng một link. Lịch sử và tên tài liệu hiển thị công khai trên các thiết bị. Chỉ gửi tài liệu phù hợp để chia sẻ công khai.</Typography>
      {loading?<Stack component="div" direction="row" spacing={1} sx={{mt:2,alignItems:"center"}}><CircularProgress size={20}/><Typography>Đang kiểm tra công cụ…</Typography></Stack>:
        !enabled?<Alert severity="info" sx={{mt:2}}>Công cụ PDF đang được chuẩn bị. Chưa thể tạo tài liệu lúc này.</Alert>:null}
      <TextField label="Liên kết Google Drive" data-testid="pdf-links" fullWidth multiline minRows={3} maxRows={8} sx={{mt:2}}
        placeholder="https://drive.google.com/file/d/…/view" value={links} disabled={!enabled||busy}
        onChange={e=>setLinks(e.target.value)} helperText={`Tối đa ${caps?.maxLinksPerBatch??5} liên kết, mỗi dòng một link.${caps?.maxPages ? ` Tối đa ${caps.maxPages} trang/tài liệu.` : ''}`}/>
      {caps?.maxSourceBytes&&caps.maxBytes?<Typography sx={{fontSize:12,color:"#866a77",mt:1}}>
        PDF nguồn tối đa {caps.maxSourceBytes/1048576} MiB · PDF kết quả tối đa {caps.maxBytes/1048576} MiB.
      </Typography>:null}
      {enabled&&links.trim()&&invalid&&<Typography role="alert" sx={{fontSize:13,color:"#b3261e",mt:1}}>{invalid}</Typography>}
      <Button data-testid="pdf-submit" fullWidth variant="contained" disabled={!enabled||busy||!!invalid}
        onClick={()=>void submit()} sx={{mt:2,minHeight:48,bgcolor:"#b96d8d","&:hover":{bgcolor:"#985170"}}}>
        {busy?"Đang thực hiện…":"Tạo PDF"}
      </Button>
    </Paper>
    <Paper component="section" elevation={0} sx={{minWidth:0,p:{xs:2,sm:3},border:"1px solid #f2dce5",borderRadius:4,bgcolor:"#fff"}}>
      <Stack component="div" direction="row" spacing={1} sx={{alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <Typography component="h2" sx={{fontWeight:800,fontSize:19}}>Tài liệu đã xử lý</Typography>
        <Button startIcon={<RefreshRounded/>} onClick={()=>void refresh(page)} disabled={busy||loading} sx={{minHeight:44,color:"#b96d8d"}}>Làm mới</Button>
      </Stack>
      <Typography sx={{fontSize:13,color:"#866a77",mt:1}}>Tên gốc hiển thị khi xác định được; tài liệu cũ hoặc chưa có tên dùng mã Drive.</Typography>
      {!history?.items.length?<Typography sx={{mt:2,color:"#866a77"}}>Chưa có tài liệu nào được gửi lên công cụ.</Typography>:
        <Stack component="div" spacing={2} sx={{mt:2}}>
          {history.items.map(batch=><Box key={batch.id} sx={{border:"1px solid #f4e6ec",borderRadius:3,p:2}}>
            <Typography sx={{fontSize:12,color:"#866a77",mb:1}}>Ngày gửi: {date(batch.createdAt)}</Typography>
            {(details[batch.id]?.jobs??[]).map(job=>{
              const expired=Date.parse(job.expiresAt)<=Date.now();
              const completed=job.status==="COMPLETED"&&!expired;
              const active=ongoing.includes(job.status);
              const progress=job.progress;
              const showProgress=Boolean(progress)&&!expired&&(active||completed);
              const retryable=(expired||["FAILED","RETRY_EXHAUSTED","EXPIRED"].includes(job.status))&&job.retryAttempts<(caps?.maxRetries??2);
              return <Box data-testid="pdf-job" key={job.id} sx={{py:1.5,borderTop:"1px solid #f4e6ec",display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",sm:"minmax(0,1fr) auto"},columnGap:2,alignItems:"start"}}>
                <Stack component="div" direction="row" spacing={1} sx={{gridColumn:1,justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:1}}>
                  <Box sx={{minWidth:0,flex:"1 1 180px"}}>
                    <Typography sx={{fontWeight:700,overflowWrap:"anywhere",fontSize:15}}>{title(job)}</Typography>
                    <Typography sx={{fontSize:12,color:"#866a77"}}>{job.pages!==null?job.pages+" trang · ":""}{job.bytes!==null?(job.bytes/1048576).toFixed(2)+" MB":"Chưa có dung lượng"}</Typography>
                  </Box>
                  <Chip size="small" color={completed?"success":job.status==="FAILED"?"error":"default"} label={expired?"Hết hạn":statuses[job.status]}/>
                </Stack>
                {showProgress&&progress&&<Box data-testid="pdf-progress" sx={{mt:1.5,gridColumn:1}}>
                  <Typography sx={{fontSize:12,mb:0.5}} aria-live="polite">
                    {completed ? "Hoàn thành · 100%" : progress.stage==="DISCOVERING" ? "Đang kiểm tra số trang" :
                      `${progress.processedPages}/${progress.totalPages} trang · ${progress.percent}%${progress.stage==="MERGING" ? " · Đang ghép PDF" : ""}`}
                  </Typography>
                  <LinearProgress variant={progress.totalPages===null&&!completed ? "indeterminate" : "determinate"}
                    value={completed?100:progress.percent} aria-label="Tiến độ tạo PDF" sx={{height:6,borderRadius:3}}/>
                </Box>}
                {job.status==="FAILED"&&job.errorCode&&<Box sx={{mt:1,gridColumn:1,overflowWrap:"anywhere"}}>
                  <Typography sx={{fontSize:12,color:"#866a77"}}>{failureReasons[job.errorCode]??"Không thể xử lý tài liệu này."}</Typography>
                  <Typography sx={{fontSize:12,color:"#866a77",mt:0.5}}>Hệ thống đã dừng xử lý tài liệu này; không còn job chạy phía server.</Typography>
                </Box>}
                {job.status==="RESULT_UNCONFIRMED"&&!expired&&<Typography sx={{fontSize:13,mt:1,gridColumn:1}}>Chưa xác nhận được kết quả. Hệ thống đang tiếp tục kiểm tra.</Typography>}
                {job.cloudErrorCode&&ongoing.includes(job.status)&&!expired&&<Typography sx={{fontSize:13,mt:1,gridColumn:1}}>Hệ thống đang thử kết nối lại. Tiến độ đã lưu vẫn được giữ.</Typography>}
                {active&&!expired&&<Typography sx={{fontSize:13,mt:1,gridColumn:1,color:"#866a77"}}>Có thể đóng trang trong khi chờ. Tiến độ cập nhật tự động khi hệ thống còn xử lý.</Typography>}
                <Stack component="div" direction="row" sx={{mt:{xs:1,sm:0},gap:1,flexWrap:"wrap",gridColumn:{xs:1,sm:2},gridRow:{sm:1},alignSelf:"start"}}>
                  {completed&&<Button data-testid="pdf-download" startIcon={<DownloadRounded/>} disabled={busy||caps?.downloadEnabled!==true}
                    onClick={()=>void download(job)} sx={{minHeight:44,color:"#b96d8d"}}>Tải PDF</Button>}
                  {retryable&&<Button data-testid="pdf-retry" startIcon={<ReplayRounded/>} disabled={busy||!enabled}
                    onClick={()=>void retry(job)} sx={{minHeight:44,color:"#b96d8d"}}>Thử lại</Button>}
                </Stack>
                {downloadFeedback?.jobId===job.id&&<Alert data-testid="pdf-download-feedback" severity={downloadFeedback.error?"error":"info"} role={downloadFeedback.error?"alert":"status"} aria-live={downloadFeedback.error?"assertive":"polite"} onClose={()=>setDownloadFeedback(null)} sx={{mt:1,gridColumn:"1 / -1",overflowWrap:"anywhere"}}>{downloadFeedback.text}</Alert>}
              </Box>;
            })}
          </Box>)}
          {history.total>history.pageSize&&<Stack component="div" direction="row" sx={{justifyContent:"space-between"}}>
            <Button sx={{minHeight:44}} disabled={page===1} onClick={()=>{setDownloadFeedback(null);setPage(page-1);}}>Trang trước</Button>
            <Typography sx={{alignSelf:"center"}}>Trang {page}</Typography>
            <Button sx={{minHeight:44}} disabled={page*history.pageSize>=history.total} onClick={()=>{setDownloadFeedback(null);setPage(page+1);}}>Trang sau</Button>
          </Stack>}
        </Stack>}
    </Paper>
    </Box>
  </Box>;
}
