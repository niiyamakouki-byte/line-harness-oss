import { Hono } from 'hono';
import type { Env } from '../index.js';

export const measureGuide = new Hono<Env>();

measureGuide.get('/measure-guide', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>計測ガイド | スマホで簡単計測</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Hiragino Sans','Noto Sans JP',system-ui,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.7;-webkit-font-smoothing:antialiased}
.container{max-width:640px;margin:0 auto;padding:0 20px}
.hero{padding:60px 20px 40px;text-align:center;background:linear-gradient(135deg,rgba(13,17,23,0.95),rgba(13,17,23,0.8)),radial-gradient(circle at top right,rgba(200,165,90,0.2),transparent 50%)}
.hero .label{font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#c8a55a;margin-bottom:12px}
.hero h1{font-size:28px;font-weight:800;color:#fff;margin-bottom:8px}
.hero .sub{font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6}
.section{padding:40px 0}
.section-title{font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#c8a55a;text-align:center;margin-bottom:6px}
.section h2{font-size:22px;font-weight:700;color:#fff;text-align:center;margin-bottom:24px}
.divider{width:48px;height:3px;background:#c8a55a;border-radius:2px;margin:12px auto 32px}
.step-card{background:#161b22;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;margin-bottom:16px;position:relative;overflow:hidden}
.step-card::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;background:#c8a55a;border-radius:4px 0 0 4px}
.step-number{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:rgba(200,165,90,0.15);color:#c8a55a;font-size:15px;font-weight:700;margin-bottom:12px}
.step-card h3{font-size:16px;font-weight:700;color:#fff;margin-bottom:6px}
.step-card p{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7}
.checklist{background:#161b22;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px}
.check-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
.check-item:last-child{border-bottom:none}
.check-icon{width:22px;height:22px;border-radius:50%;background:rgba(200,165,90,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#c8a55a;font-size:13px}
.check-item span{font-size:14px;font-weight:500;color:#e6edf3}
.ok-box{background:rgba(200,165,90,0.08);border:1px solid rgba(200,165,90,0.2);border-radius:16px;padding:24px;text-align:center;margin-top:32px}
.ok-box .title{font-size:16px;font-weight:700;color:#fff;margin-bottom:6px}
.ok-box p{font-size:13px;color:rgba(255,255,255,0.5)}
.cta{padding:48px 20px 80px;text-align:center}
.cta h2{font-size:22px;font-weight:700;color:#fff;margin-bottom:8px}
.cta .desc{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:32px}
.line-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;max-width:360px;padding:18px 24px;border:none;border-radius:12px;font-size:17px;font-weight:700;text-decoration:none;color:#fff;background:#06C755;transition:opacity 0.15s}
.line-btn:active{opacity:0.85}
.line-btn svg{width:24px;height:24px;fill:currentColor}
.footer-note{font-size:11px;color:rgba(255,255,255,0.25);text-align:center;padding:0 20px 40px;line-height:1.6}
</style>
</head>
<body>

<div class="hero">
  <p class="label">Measurement Guide</p>
  <h1>スマホで簡単計測</h1>
  <p class="sub">スケール不要、iPhoneの「計測」アプリだけで十分です。<br>5ステップで必要な情報を揃えて、LINEで送るだけ。</p>
</div>

<div class="container">
  <div class="section">
    <p class="section-title">How to Measure</p>
    <h2>5ステップ計測ガイド</h2>
    <div class="divider"></div>

    <div class="step-card">
      <div class="step-number">1</div>
      <h3>iPhoneの「計測」アプリを開く</h3>
      <p>iPhoneに標準搭載されている「計測」アプリを起動します。LiDARセンサー搭載モデルならさらに高精度。</p>
    </div>

    <div class="step-card">
      <div class="step-number">2</div>
      <h3>部屋の幅を測定（壁から壁）</h3>
      <p>壁の一方端にカメラを向けて始点をタップ、反対側の壁まで移動して終点をタップ。幅（横方向）を記録します。</p>
    </div>

    <div class="step-card">
      <div class="step-number">3</div>
      <h3>部屋の奥行を測定</h3>
      <p>同じ要領で奥行（縦方向）も測定します。長方形でない部屋は、最長辺と最短辺の両方を測ると正確です。</p>
    </div>

    <div class="step-card">
      <div class="step-number">4</div>
      <h3>天井の高さを測定</h3>
      <p>床から天井に向かってカメラを移動させ、高さを測定します。通常は2.4m前後ですが、店舗は高い場合も。</p>
    </div>

    <div class="step-card">
      <div class="step-number">5</div>
      <h3>各壁面の写真を撮影（4枚）</h3>
      <p>部屋の四方向からそれぞれ1枚ずつ撮影します。窓・ドア・コンセントの位置が写るようにしてください。</p>
    </div>
  </div>

  <div class="section">
    <p class="section-title">Checklist</p>
    <h2>送信前チェックリスト</h2>
    <div class="divider"></div>

    <div class="checklist">
      <div class="check-item"><div class="check-icon">&#10003;</div><span>幅（横方向）</span></div>
      <div class="check-item"><div class="check-icon">&#10003;</div><span>奥行（縦方向）</span></div>
      <div class="check-item"><div class="check-icon">&#10003;</div><span>天井高</span></div>
      <div class="check-item"><div class="check-icon">&#10003;</div><span>開口部（窓・ドア）の位置</span></div>
      <div class="check-item"><div class="check-icon">&#10003;</div><span>写真4枚（四方向から）</span></div>
    </div>

    <div class="ok-box">
      <p class="title">スケール（メジャー）がなくてもOK</p>
      <p>iPhoneの計測アプリがあれば十分です。誤差があっても、現地調査で正確に再計測しますのでご安心ください。</p>
    </div>
  </div>
</div>

<div class="cta">
  <h2>測定結果をLINEで送信</h2>
  <p class="desc">計測データと写真をLINEで送るだけ。<br>AIが即座に完成イメージと概算見積を作成します。</p>
  <a href="https://line.me/R/" class="line-btn">
    <svg viewBox="0 0 24 24"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386a.63.63 0 0 1-.63-.629V8.108a.63.63 0 0 1 .63-.63h2.386a.63.63 0 0 1 0 1.26H17.61v1.125h1.755zm-3.855 3.016a.63.63 0 0 1-.63.63.629.629 0 0 1-.51-.26l-2.443-3.317v2.947a.63.63 0 0 1-1.26 0V8.108a.63.63 0 0 1 .63-.63c.2 0 .388.096.51.26l2.443 3.317V8.108a.63.63 0 0 1 1.26 0v4.771zm-5.741 0a.63.63 0 0 1-1.26 0V8.108a.63.63 0 0 1 1.26 0v4.771zm-2.466.63H4.917a.63.63 0 0 1-.63-.63V8.108a.63.63 0 0 1 1.26 0v4.141h1.756a.63.63 0 0 1 0 1.26zM24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.921.258 1.058.593.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967C23.309 14.09 24 12.323 24 10.314"/></svg>
    LINEで測定結果を送る
  </a>
</div>

<p class="footer-note">株式会社ラポルタ | AI × 内装工事</p>

</body>
</html>`);
});
