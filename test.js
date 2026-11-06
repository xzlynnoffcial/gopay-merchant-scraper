// by:Lynd - Rena-chan
// [Test] Unit Test QRIS EMVCo & CRC16 Calculation
import assert from 'node:assert';
import { computeCRC16CCITT, buildDynamicQRIS, parseQRIS } from './index.js';

console.log('Menjalankan self-test...');

// 1. Test CRC16-CCITT
const testPayload = '00020101021226580014ID.LINKAJA.WWW011893600911002212029520458125303360540418005802ID5911STARINDOPAY6007BANDUNG61054011562070703A016304';
const crc = computeCRC16CCITT(testPayload);
assert.strictEqual(crc.length, 4, 'CRC harus 4 karakter hex');
console.log('✅ CRC16-CCITT Test Lulus! Result:', crc);

// 2. Test Dynamic QRIS Injection
const staticSample = '00020101021126610014COM.GO-JEK.WWW01189360091400000000000210G0000000000303UMI51440014ID.CO.QRIS.WWW0215ID10000000000000303UMI5204549953033605802ID5909Demo Toko6007JAKARTA61051234562070703A016304ABCD';
const dynamicQris = buildDynamicQRIS(staticSample, 50000);

assert.ok(dynamicQris.includes('540550000'), 'Tag 54 nominal Rp 50.000 harus ada');
assert.ok(dynamicQris.includes('010212'), 'Point of initiation harus 010212 (Dynamic)');
assert.ok(dynamicQris.endsWith(computeCRC16CCITT(dynamicQris.slice(0, -4))), 'Checksum akhir harus valid');
console.log('✅ Dynamic QRIS Generator Test Lulus!');

// 3. Test QRIS Parser
const parsed = parseQRIS(dynamicQris);
assert.strictEqual(parsed.pointOfInitiation, 'DYNAMIC');
assert.strictEqual(parsed.amount, '50000');
assert.strictEqual(parsed.merchantName, 'Demo Toko');
assert.strictEqual(parsed.merchantCity, 'JAKARTA');
console.log('✅ QRIS Parser Test Lulus!');

console.log('\n🎉 Semua uji mandiri selesai tanpa error!');
