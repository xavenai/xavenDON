const $ = (s) => document.querySelector(s);
const urlInput = $('#url');
const sourceBadge = $('#source');
const statusBox = $('#status');
const result = $('#result');
const permission = $('#permission');
let pendingKind = null;

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

function analyze() {
  const url = urlInput.value.trim();
  if (!/^https?:\/\//i.test(url)) {
    statusBox.textContent = 'یک لینک کامل و معتبر وارد کن.';
    statusBox.classList.add('show');
    result.hidden = true;
    return;
  }
  const quality = $('#quality').value;
  const details = [sourceOf(url) || 'لینک', quality];
  if ($('#cover').checked) details.push('همراه کاور');
  if ($('#caption').checked) details.push('همراه کپشن');
  statusBox.textContent = details.join(' — ');
  statusBox.classList.add('show');
  $('#qualityText').textContent = `${quality} · سازگار با گالری`;
  result.hidden = false;
  result.scrollIntoView({behavior:'smooth', block:'center'});
}

async function save() {
  permission.hidden = true;
  const url = urlInput.value.trim();
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('fetch');
    const blob = await response.blob();
    const ext = pendingKind === 'cover' ? 'jpg' : pendingKind === 'audio' ? 'mp3' : 'mp4';
    const file = new File([blob], `xavenDON-${Date.now()}.${ext}`, {type: blob.type});
    if (navigator.share && navigator.canShare?.({files:[file]})) {
      await navigator.share({files:[file], title:'xavenDON'});
      return;
    }
  } catch (_) {}
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.download = '';
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

