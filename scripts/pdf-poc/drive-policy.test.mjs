import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driveId,allowedDriveRequest,assertCaptureDimensions,assertOriginalIdentity} from './drive-policy.mjs';
const id='owned_fixture_identifier_123';
test('Drive research navigation is pinned and never permits login or arbitrary URLs',()=>{
 assert.equal(allowedDriveRequest(`https://drive.google.com/file/d/${id}/view`,id,true),true);
 for(const url of ['http://drive.google.com/','https://accounts.google.com/','https://drive.google.com.evil.test/','https://127.0.0.1/','https://drive.google.com:444/','https://evil.googleusercontent.com.evil.test/'])assert.equal(allowedDriveRequest(url,id),false);
 assert.equal(allowedDriveRequest(`https://drive.google.com/file/d/another/view`,id,true),false);
 assert.equal(allowedDriveRequest('https://lh3.googleusercontent.com/image',id),true);
 assert.throws(()=>driveId('../../x'));
});
test('original verification rejects reordered, unrelated, invalid and dirty blank pages',()=>{
 assert.doesNotThrow(()=>assertOriginalIdentity(3,{index:3,rmse:0},0));
 assert.doesNotThrow(()=>assertOriginalIdentity(2,{index:2,rmse:35},16));
 for(const [page,nearest,error]of [[1,{index:2,rmse:0},0],[1,{index:1,rmse:1},80],[1,{index:1,rmse:NaN},0],[1,{index:1,rmse:1},NaN],[3,{index:3,rmse:0},1]])assert.throws(()=>assertOriginalIdentity(page,nearest,error),/INCOMPLETE/);
});
test('DPI is measured separately for portrait and landscape, with aspect/pixel guards',()=>{
 assert.ok(assertCaptureDimensions({width:595,height:842},2400,3396).dpiX>290);
 assert.ok(assertCaptureDimensions({width:842,height:595},2400,1696).dpiX<206);
 assert.throws(()=>assertCaptureDimensions({width:595,height:842},2400,1696),/aspect/);
 assert.throws(()=>assertCaptureDimensions({width:595,height:842},4800,6792),/limit/);
});
