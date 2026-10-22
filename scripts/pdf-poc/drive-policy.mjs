// Research-only: this exact owned synthetic original, never an arbitrary document.
export const ownedHash='0ff031dc0939708531feaaa39b12798b89ae766d49539cb4154ccc50da2ed0c6';
export function driveId(value) {
  if(!/^[A-Za-z0-9_-]{20,100}$/.test(value??''))throw Error('Invalid owned fixture ID');
  return value;
}
export function allowedDriveRequest(value,id,isNavigation=false) {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.port||u.username||u.password)return false;
  if(isNavigation)return u.hostname==='drive.google.com'&&u.pathname===`/file/d/${driveId(id)}/view`&&!u.search;
  return ['drive.google.com','docs.google.com'].includes(u.hostname)||['.gstatic.com','.googleusercontent.com'].some(s=>u.hostname.endsWith(s));
}
export function assertCaptureDimensions(p,w,h) {
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>12_000_000)throw Error('INCOMPLETE: bitmap limit');
  if(Math.abs((w/h)/(p.width/p.height)-1)>0.002)throw Error('INCOMPLETE: bitmap aspect ratio');
  return {dpiX:w*72/p.width,dpiY:h*72/p.height};
}
export function assertOriginalIdentity(index,nearest,pageError) {
  // Thumbnail distances establish identity only; downsampling aliases fine rules.
  // The full 300-DPI comparison has a fixture-specific corruption ceiling, not a print-quality score.
  if(nearest.index!==index||!Number.isFinite(nearest.rmse)||!Number.isFinite(pageError)||pageError>20)throw Error(`INCOMPLETE: original content/order mismatch (page ${index}, nearest ${nearest.index}, full-page RMSE ${pageError})`);
  if(index===3&&pageError>0.1)throw Error('INCOMPLETE: blank page changed');
}
