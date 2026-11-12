// 3D 와 상관없는 규칙만 모았다. node test_logic.mjs 로 브라우저 없이 시험한다.

// 'YYYY-MM-DD' (내 PC 시간대 기준)
export function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 출근 도장: 같은 날 두 번 찍어도 하나
export function addStamp(list, key) {
  return [...new Set([...list, key])].sort();
}

// 오늘부터 거꾸로 하루도 안 빠지고 찍힌 날 수
export function streak(list, todayKey) {
  const set = new Set(list);
  const d = parseKey(todayKey);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const SKY = { night: '#0e1828', dusk: '#e39a68', dawn: '#d8a993', day: '#9ec8e4' };

function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((ca >> s) & 255) * (1 - t) + ((cb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

// hour: 0~24 (소수). 6시·18시에 해가 지평선, 12시에 가장 높다고 단순화했다.
// ponytail: 계절·위도 무시. 일출·일몰 시각을 맞추려면 날짜로 태양 고도를 계산하면 된다.
export function skyAt(hour) {
  const elev = Math.sin((Math.PI * (hour - 6)) / 12);
  const edge = hour < 12 ? SKY.dawn : SKY.dusk;
  let sky, label;
  if (elev > 0.25) { sky = SKY.day; label = '낮'; }
  else if (elev > 0.05) { sky = mix(edge, SKY.day, (elev - 0.05) / 0.2); label = hour < 12 ? '아침' : '노을'; }
  else if (elev > -0.15) { sky = mix(SKY.night, edge, (elev + 0.15) / 0.2); label = hour < 12 ? '새벽' : '노을'; }
  else { sky = SKY.night; label = '밤'; }
  return {
    elev,
    label,
    sky,
    night: elev < -0.05,
    sun: Math.max(0, elev) * 1.6,
    ambient: 0.25 + 0.6 * Math.max(0, Math.min(1, (elev + 0.15) / 0.4)),
  };
}

// 1층에서 지나가야 하는 선: 정문(z=12)과 출근 게이트(z=7). 둘 다 가운데 |x|<=gap 으로만 지난다.
const LINES = [
  { z: 12, name: 'door', needsStamp: false },
  { z: 7, name: 'gate', needsStamp: true },
];

// from→to 로 갈 때 들를 점들. 도장 없이 게이트 안으로 들어가려 하면 게이트 앞에서 멈춘다.
// 나가는 쪽(z 가 커지는 쪽)은 도장 없이도 지나간다.
export function planPath(from, to, stamped, gap = 2.0) {
  const points = [];
  const north = to.z < from.z;
  const lines = north ? LINES : [...LINES].reverse();
  let cur = from;
  for (const L of lines) {
    if ((cur.z - L.z) * (to.z - L.z) >= 0) continue; // 이 선을 안 넘는다
    const dir = north ? -1 : 1;
    const t = (L.z - cur.z) / (to.z - cur.z);
    const x = Math.max(-gap, Math.min(gap, cur.x + (to.x - cur.x) * t));
    const before = { x, z: L.z - dir * 0.9 };
    if (L.needsStamp && !stamped && north) {
      points.push(before);
      return { points, blocked: L.name };
    }
    points.push(before, { x, z: L.z + dir * 0.9 });
    cur = points[points.length - 1];
  }
  points.push(to);
  return { points, blocked: null };
}
