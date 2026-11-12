// node test_logic.mjs — 아무 출력 없이 끝나면 통과
import assert from 'node:assert/strict';
import { dayKey, addStamp, streak, skyAt, planPath, blockedStep } from './logic.js';

// 출근 도장
assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
assert.deepEqual(addStamp(['2026-11-12'], '2026-11-12'), ['2026-11-12']);
assert.deepEqual(addStamp(['2026-11-13'], '2026-11-12'), ['2026-11-12', '2026-11-13']);
assert.equal(streak(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02'), 3); // 달 넘김
assert.equal(streak(['2026-11-01', '2026-11-03'], '2026-11-03'), 1); // 하루 빠짐
assert.equal(streak(['2026-11-01'], '2026-11-03'), 0); // 오늘 안 찍음

// 하늘
assert.equal(skyAt(12).label, '낮');
assert.equal(skyAt(0).label, '밤');
assert.equal(skyAt(18.2).label, '노을');
assert.equal(skyAt(5.8).label, '새벽');
assert.equal(skyAt(12).night, false);
assert.equal(skyAt(23).night, true);
assert.match(skyAt(18).sky, /^#[0-9a-f]{6}$/);

// 게이트: 밖(z=18)에서 사무실(z=0)로
let r = planPath({ x: 10, z: 18 }, { x: -8, z: 0 }, false);
assert.equal(r.blocked, 'gate');
assert.equal(r.points.at(-1).z, 7.9); // 게이트 앞에서 멈춤
assert.ok(Math.abs(r.points.at(-1).x) <= 2); // 통로 안쪽
assert.ok(r.points.every((p) => p.z > 7)); // 게이트 안으로 한 발짝도 안 들어감

r = planPath({ x: 10, z: 18 }, { x: -8, z: 0 }, true);
assert.equal(r.blocked, null);
assert.deepEqual(r.points.at(-1), { x: -8, z: 0 });
assert.ok(r.points.some((p) => p.z === 12.9) && r.points.some((p) => p.z === 6.1)); // 정문, 게이트를 차례로

// 안에서 밖으로는 도장 없이도
r = planPath({ x: -8, z: 0 }, { x: 0, z: 18 }, false);
assert.equal(r.blocked, null);
assert.deepEqual(r.points.at(-1), { x: 0, z: 18 });

// 선을 안 넘으면 바로
assert.deepEqual(planPath({ x: -8, z: 0 }, { x: 8, z: -5 }, false).points, [{ x: 8, z: -5 }]);

// 키보드 한 걸음
assert.equal(blockedStep({ x: 0, z: 12.1 }, { x: 0, z: 11.9 }, false), null); // 정문 가운데
assert.equal(blockedStep({ x: 8, z: 12.1 }, { x: 8, z: 11.9 }, true), 'wall'); // 유리벽
assert.equal(blockedStep({ x: 0, z: 7.1 }, { x: 0, z: 6.9 }, false), 'gate'); // 도장 없이 안으로
assert.equal(blockedStep({ x: 0, z: 7.1 }, { x: 0, z: 6.9 }, true), null);
assert.equal(blockedStep({ x: 0, z: 6.9 }, { x: 0, z: 7.1 }, false), null); // 나가는 쪽
assert.equal(blockedStep({ x: -9, z: 7.1 }, { x: -9, z: 6.9 }, true), 'wall'); // 게이트 옆 유리 칸막이
assert.equal(blockedStep({ x: -9, z: 7.1 }, { x: -9.1, z: 7.2 }, false), null); // 선을 안 넘음
