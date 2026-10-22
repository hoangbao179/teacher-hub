export const limits = {inputBytes:10*1024*1024,pages:5,pixelsPerPage:12_000_000,totalPixels:60_000_000,pngBytes:32*1024*1024,temporaryBytes:64*1024*1024};
export function assertPageLimits(pages) {
  if(pages.length!==limits.pages)throw Error('INCOMPLETE: owned fixture must have exactly five pages');
  let total=0;
  for(const p of pages){
    if(!Number.isFinite(p.width)||!Number.isFinite(p.height)||p.width<=0||p.height<=0)throw Error('INCOMPLETE: invalid page size');
    const pixels=Math.ceil(p.width*300/72)*Math.ceil(p.height*300/72);total+=pixels;
    if(pixels>limits.pixelsPerPage)throw Error('INCOMPLETE: page pixel limit');
  }
  if(total>limits.totalPixels)throw Error('INCOMPLETE: total pixel limit');
}
