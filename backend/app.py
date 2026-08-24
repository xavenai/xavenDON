import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from yt_dlp import YoutubeDL

app = Flask(__name__)
CORS(app, origins=["https://xavenai.github.io"], supports_credentials=False)

ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
    "instagram.com", "www.instagram.com", "soundcloud.com", "www.soundcloud.com",
}
MAX_DURATION = 60 * 60


def clean_url(value: str) -> str:
    value = (value or "").strip()
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or host not in ALLOWED_HOSTS:
        raise ValueError("این لینک پشتیبانی نمی‌شود.")
    return value


def safe_title(value: str) -> str:
    value = re.sub(r"[^\w\-. ()\[\]]+", "_", value or "xavenDON", flags=re.UNICODE)
    return value[:90].strip(" ._") or "xavenDON"


@app.get("/health")
def health():
    return jsonify(ok=True, service="xavenDON")


@app.post("/api/analyze")
def analyze():
    try:
        url = clean_url((request.get_json(silent=True) or {}).get("url"))
        with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
            info = ydl.extract_info(url, download=False)
        duration = info.get("duration") or 0
        if duration and duration > MAX_DURATION:
            return jsonify(error="ویدیوهای بیشتر از یک ساعت در نسخه رایگان پشتیبانی نمی‌شوند."), 413
        heights = sorted({f.get("height") for f in info.get("formats", []) if f.get("height")}, reverse=True)
        return jsonify(
            title=info.get("title") or "بدون عنوان",
            caption=info.get("description") or info.get("title") or "",
            thumbnail=info.get("thumbnail"),
            duration=duration,
            qualities=[h for h in heights if h <= 2160],
            webpage_url=info.get("webpage_url") or url,
        )
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except Exception as exc:
        app.logger.exception("analyze failed")
        return jsonify(error="این لینک فعلاً قابل پردازش نیست؛ ممکن است خصوصی یا نیازمند ورود باشد."), 422


@app.get("/api/download")
def download():
    temp_dir = tempfile.mkdtemp(prefix="xavendon-")
    try:
        url = clean_url(request.args.get("url"))
        mode = request.args.get("mode", "video")
        height = request.args.get("height", "best")
        if mode not in {"video", "audio", "cover"}:
            raise ValueError("نوع خروجی نامعتبر است.")
        if height != "best" and not re.fullmatch(r"\d{3,4}", height):
            raise ValueError("کیفیت نامعتبر است.")

        output = str(Path(temp_dir) / "%(title).80s [%(id)s].%(ext)s")
        options = {
            "outtmpl": output,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "restrictfilenames": False,
            "merge_output_format": "mp4",
        }
        if mode == "cover":
            options.update({
                "skip_download": True,
                "writethumbnail": True,
                "postprocessors": [{"key": "FFmpegThumbnailsConvertor", "format": "jpg"}],
            })
        elif mode == "audio":
            options.update({
                "format": "bestaudio/best",
                "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
            })
        else:
            cap = "" if height == "best" else f"[height<={height}]"
            options["format"] = f"bestvideo{cap}[ext=mp4]+bestaudio[ext=m4a]/bestvideo{cap}+bestaudio/best{cap}/best"

        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
        files = [p for p in Path(temp_dir).iterdir() if p.is_file() and not p.name.endswith((".part", ".ytdl"))]
        if not files:
            raise RuntimeError("output missing")
        target = max(files, key=lambda p: p.stat().st_size)
        ext = "jpg" if mode == "cover" else "mp3" if mode == "audio" else "mp4"
        name = f"{safe_title(info.get('title'))}.{ext}"
        response = send_file(target, as_attachment=True, download_name=name, max_age=0)
        response.call_on_close(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
        return response
    except ValueError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify(error=str(exc)), 400
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        app.logger.exception("download failed")
        return jsonify(error="دانلود انجام نشد؛ محتوای خصوصی و محدود ممکن است نیازمند ورود باشد."), 422


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "10000")))

