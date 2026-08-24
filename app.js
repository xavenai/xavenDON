const $ = (s) => document.querySelector(s);
const urlInput = $('#url');
const sourceBadge = $('#source');
const statusBox = $('#status');
const result = $('#result');
const permission = $('#permission');
let pendingKind = null;
const API = 'https://xavendon-api.onrender.com';
let mediaInfo = null;

const isIphoneSafari = /iPhone|iPod/i.test(navigator.userAgent) && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (isIphoneSafari && !isStandalone && sessionStorage.getItem('xavendon-ios-guide') !== 'seen') {
  $('#iosInstall').hidden = false;
  document.body.classList.add('installOpen');
}
$('#enterSite').addEventListener('click', () => {
  sessionStorage.setItem('xavendon-ios-guide', 'seen');
  $('#iosInstall').hidden = true;
  document.body.classList.remove('installOpen');
});

function sourceOf(value) {
  if (/youtu/i.test(value)) return 'YouTube';
  if (/instagram\.com/i.test(value)) return 'Instagram';
  if (/soundcloud\.com/i.test(value)) return 'SoundCloud';
  if (/^https?:\/\//i.test(value)) return 'Direct file';
  return '';
}

function updateSource() {
  const source = sourceOf(urlInput.value);
  sourceBadge.textContent = source;
  sourceBadge.hidden = !source;
  statusBox.classList.remove('show');
  result.hidden = true;
}

async function analyze() {
  const url = urlInput.value.trim();
  if (!/^https?:\/\//i.test(url)) {
    statusBox.textContent = 'یک لینک کامل و معتبر وارد کن.';
    statusBox.classList.add('show');
    result.hidden = true;
    return;
  }
  const button = $('#analyze');
  button.disabled = true;
  button.textContent = 'در حال بررسی…';
  statusBox.textContent = 'سرور رایگان در اولین استفاده ممکن است تا حدود یک دقیقه در حال بیدارشدن باشد.';
  statusBox.classList.add('show');
  result.hidden = true;
  try {
    const response = await fetch(`${API}/api/analyze`, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'بررسی لینک انجام نشد.');
    mediaInfo = data;
    const quality = $('#quality').value;
    statusBox.textContent = `${sourceOf(url)} شناسایی شد — ${data.title}`;
    $('#qualityText').textContent = `${quality} · خروجی MP4`;
    $('#captionText').textContent = data.caption || data.title || 'کپشنی پیدا نشد.';
    if (data.thumbnail) $('#coverImage').src = data.thumbnail;
    result.hidden = false;
    result.scrollIntoView({behavior:'smooth', block:'center'});
  } catch (error) {
    statusBox.textContent = error.message || 'ارتباط با سرور برقرار نشد.';
  } finally {
    button.disabled = false;
    button.innerHTML = 'بررسی لینک <span>←</span>';
  }
}

async function save() {
  permission.hidden = true;
  const url = urlInput.value.trim();
  if (!url) return;
  const selected = $('#quality').value;
  const height = selected === 'بهترین کیفیت' ? 'best' : (selected.match(/\d+/)?.[0] || 'best');
  const mode = selected === 'فقط صدا' ? 'audio' : pendingKind;
  const downloadUrl = `${API}/api/download?mode=${encodeURIComponent(mode)}&height=${encodeURIComponent(height)}&url=${encodeURIComponent(url)}`;
  statusBox.textContent = 'فایل در حال آماده‌شدن است؛ این صفحه را نبند.';
  statusBox.classList.add('show');
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('fetch');
    const blob = await response.blob();
    const ext = mode === 'cover' ? 'jpg' : mode === 'audio' ? 'mp3' : 'mp4';
    const file = new File([blob], `xavenDON-${Date.now()}.${ext}`, {type: blob.type});
    if (navigator.share && navigator.canShare?.({files:[file]})) {
      await navigator.share({files:[file], title:'xavenDON'});
      return;
    }
  } catch (_) {
    window.location.href = downloadUrl;
    return;
  }
  const a = document.createElement('a');
  a.href = downloadUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.download = '';
  a.click();
}

urlInput.addEventListener('input', updateSource);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') analyze(); });
$('#analyze').addEventListener('click', analyze);
document.querySelectorAll('[data-kind]').forEach((button) => button.addEventListener('click', () => {
  pendingKind = button.dataset.kind;
  permission.hidden = false;
}));
$('#allow').addEventListener('click', save);
$('#cancel').addEventListener('click', () => { permission.hidden = true; });
permission.addEventListener('click', (e) => { if (e.target === permission) permission.hidden = true; });
$('#copy').addEventListener('click', async (e) => {
  await navigator.clipboard.writeText($('#captionText').textContent);
  e.currentTarget.textContent = 'کپی شد ✓';
  setTimeout(() => { e.currentTarget.textContent = 'کپی متن'; }, 1600);
});

