import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newProject,box,entity,exportVMF,importVMF,validate} from '../src/model';
test('world settings round trip through native VMF',()=>{const p=newProject(false);p.world.skyname='sky_custom';p.world.custom_setting='keep';const q=importVMF(exportVMF(p));assert.equal(q.world.skyname,'sky_custom');assert.equal(q.world.custom_setting,'keep');});
test('sky diagnostics distinguish missing names and lighting',()=>{const p=newProject(false);p.objects.push(box('Sky',[0,0,64],[128,128,128],'TOOLS/TOOLSSKYBOX'));p.world.skyname='';assert.ok(validate(p).some(i=>i.level==='error'&&i.message.includes('skyname')));p.world.skyname='sky_custom';p.objects.push(entity('light_environment',[0,0,256]));assert.ok(!validate(p).some(i=>i.message.includes('skyname')||i.message.includes('light_environment')));});
