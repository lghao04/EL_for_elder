# app/services/stt_service.py
import os
import asyncio
import mimetypes
from typing import Optional, Any, Dict

# Optional: HTTP fallback
try:
    import requests
except Exception:
    requests = None

# Try to import the most common client names across versions
try:
    from deepgram import DeepgramClient as _DeepgramClient  # newer name used in docs
except Exception:
    try:
        from deepgram import Deepgram as _DeepgramClient  # older name fallback
    except Exception:
        _DeepgramClient = None

if _DeepGramClient := _DeepgramClient is None:
    # if no client found, raise with clear message (this mirrors earlier behavior)
    raise ImportError(
        "Cannot find Deepgram client in `deepgram` package. "
        "Install official Deepgram SDK (pip install deepgram-sdk) or check the package."
    )

class DeepgramSTTService:
    """
    Deepgram STT service compatible with modern deepgram-sdk (v3+/v4+/v5+).
    Uses client.listen.v1.media.transcribe_file(request=bytes, model=..., ...) as preferred call.
    Falls back to transcription.prerecorded or HTTP POST /v1/listen if necessary.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DEEPGRAM_API_KEY")
        if not self.api_key:
            raise ValueError(
                "❌ DEEPGRAM_API_KEY not found!\n"
                "Add to .env: DEEPGRAM_API_KEY=your_key_here\n"
                "Get key: https://console.deepgram.com/"
            )

        # Try multiple constructor signatures
        try:
            # preferred keyword style
            self.client = _DeepgramClient(api_key=self.api_key)
        except TypeError:
            try:
                # some builds accept dict
                self.client = _DeepgramClient({"api_key": self.api_key})
            except TypeError:
                try:
                    # last resort: no-arg constructor (reads env)
                    self.client = _DeepgramClient()
                except Exception as e:
                    raise RuntimeError(
                        "Failed to initialize Deepgram client. Last error: %s" % e
                    )

        print("✅ Deepgram STT Service initialized (deepgram-sdk detected)")

    def _guess_mimetype(self, path: str) -> str:
        mimetype, _ = mimetypes.guess_type(path)
        if mimetype:
            return mimetype
        return "audio/wav"

    def _is_coroutine_callable(self, fn: Any) -> bool:
        return asyncio.iscoroutinefunction(fn)

    def _maybe_await(self, result_or_coro: Any) -> Any:
        if asyncio.iscoroutine(result_or_coro):
            return asyncio.run(result_or_coro)
        return result_or_coro

    def _extract_transcript_from_response(self, resp: Any) -> Dict[str, Any]:
        """
        Extract transcript & confidence from common response shapes.
        If no transcript found, returns {"text": None, "confidence": None}.
        """
        # If dict-like
        if isinstance(resp, dict):
            try:
                ch0 = resp.get("results", {}).get("channels", [])[0]
                alt0 = ch0.get("alternatives", [])[0]
                text = alt0.get("transcript") or ""
                confidence = alt0.get("confidence")
                if text and str(text).strip():
                    return {"text": str(text).strip(), "confidence": confidence}
            except Exception:
                pass
            try:
                ch0 = resp.get("channels", [])[0]
                alt0 = ch0.get("alternatives", [])[0]
                text = alt0.get("transcript") or ""
                confidence = alt0.get("confidence")
                if text and str(text).strip():
                    return {"text": str(text).strip(), "confidence": confidence}
            except Exception:
                pass
            if "transcript" in resp and isinstance(resp["transcript"], str) and resp["transcript"].strip():
                return {"text": resp["transcript"].strip(), "confidence": None}

        # If object-like (SDK often returns objects with attributes)
        try:
            results = getattr(resp, "results", None)
            if results is not None:
                channels = getattr(results, "channels", None) or (results.get("channels") if isinstance(results, dict) else None)
                if channels:
                    ch0 = channels[0]
                    alts = getattr(ch0, "alternatives", None) or (ch0.get("alternatives") if isinstance(ch0, dict) else None)
                    if alts:
                        alt0 = alts[0]
                        text = getattr(alt0, "transcript", None) or (alt0.get("transcript") if isinstance(alt0, dict) else None)
                        confidence = getattr(alt0, "confidence", None) or (alt0.get("confidence") if isinstance(alt0, dict) else None)
                        if text and str(text).strip():
                            return {"text": str(text).strip(), "confidence": confidence}
        except Exception:
            pass

        # No transcript found
        return {"text": None, "confidence": None}

    def transcribe_file(self, audio_path: str, language: str = "en") -> dict:
        """
        Transcribe audio file. Preferred: SDK call client.listen.v1.media.transcribe_file(request=bytes,...).
        Falls back to transcription.prerecorded or HTTP POST to /v1/listen.
        Returns: {"text": ..., "confidence": ..., "language": ...}
        Raises ValueError with friendly message if no speech detected.
        """
        if not os.path.isfile(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        mimetype = self._guess_mimetype(audio_path)

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        # quick checks
        if not audio_bytes or len(audio_bytes) < 500:
            raise ValueError("Không thể nhận dạng giọng nói. Vui lòng ghi âm lại (file quá ngắn hoặc rỗng).")

        sdk_kwargs = {
            "model": "nova-2",
            "language": language,
            "punctuate": True,
            "smart_format": True,
        }

        # 1) Preferred SDK call: client.listen.v1.media.transcribe_file(request=bytes, **kwargs)
        try:
            listen = getattr(self.client, "listen", None)
            if listen is not None:
                vobj = getattr(listen, "v", None)
                if callable(vobj):
                    v1 = vobj("1")
                else:
                    v1 = getattr(listen, "v1", None) or vobj
                media = getattr(v1, "media", None) if v1 is not None else None
                transcribe_file_fn = getattr(media, "transcribe_file", None) if media is not None else None

                if transcribe_file_fn:
                    # may be coroutine
                    try:
                        if self._is_coroutine_callable(transcribe_file_fn):
                            resp = self._maybe_await(transcribe_file_fn(request=audio_bytes, **sdk_kwargs))
                        else:
                            resp = transcribe_file_fn(request=audio_bytes, **sdk_kwargs)
                    except Exception as e:
                        print("WARN: transcribe_file call raised:", e)
                        resp = None

                    if resp is not None:
                        parsed = self._extract_transcript_from_response(resp)
                        if parsed.get("text"):
                            return {"text": parsed.get("text"), "confidence": parsed.get("confidence"), "language": language}
                        else:
                            # friendly message if no speech
                            raise ValueError("Không thể nhận dạng giọng nói. Vui lòng ghi âm lại.")
        except ValueError:
            raise
        except Exception as e:
            print("WARN: preferred listen.v1.media.transcribe_file failed:", e)

        # 2) Fallback: transcription.prerecorded (older SDK shape)
        try:
            transcription = getattr(self.client, "transcription", None)
            if transcription is not None:
                prerec = getattr(transcription, "prerecorded", None)
                if prerec:
                    try:
                        resp = prerec({"buffer": audio_bytes, "mimetype": mimetype}, sdk_kwargs)
                    except TypeError:
                        resp = prerec(request=audio_bytes, **sdk_kwargs) if self._is_coroutine_callable(prerec) else prerec(request=audio_bytes, **sdk_kwargs)
                    parsed = self._extract_transcript_from_response(resp)
                    if parsed.get("text"):
                        return {"text": parsed.get("text"), "confidence": parsed.get("confidence"), "language": language}
                    else:
                        raise ValueError("Không thể nhận dạng giọng nói. Vui lòng ghi âm lại.")
        except ValueError:
            raise
        except Exception as e:
            print("WARN: transcription.prerecorded failed:", e)

        # 3) Fallback: top-level transcribe (if exists)
        try:
            transcribe_top = getattr(self.client, "transcribe", None)
            if transcribe_top:
                try:
                    if self._is_coroutine_callable(transcribe_top):
                        resp = self._maybe_await(transcribe_top(request=audio_bytes, **sdk_kwargs))
                    else:
                        resp = transcribe_top(request=audio_bytes, **sdk_kwargs)
                except Exception as e:
                    print("WARN: transcribe_top call raised:", e)
                    resp = None

                if resp is not None:
                    parsed = self._extract_transcript_from_response(resp)
                    if parsed.get("text"):
                        return {"text": parsed.get("text"), "confidence": parsed.get("confidence"), "language": language}
                    else:
                        raise ValueError("Không thể nhận dạng giọng nói. Vui lòng ghi âm lại.")
        except ValueError:
            raise
        except Exception as e:
            print("WARN: top-level transcribe failed:", e)

        # 4) Final fallback: HTTP request to Deepgram REST API (/v1/listen)
        if requests is None:
            raise RuntimeError(
                "Deepgram transcription failed: SDK methods unavailable and 'requests' not installed for HTTP fallback. "
                "Install requests (`pip install requests`) or install a compatible deepgram-sdk version."
            )

        try:
            url = "https://api.deepgram.com/v1/listen"
            headers = {
                "Authorization": f"Token {self.api_key}",
                "Content-Type": mimetype
            }
            params = {
                "model": sdk_kwargs.get("model"),
                "language": language,
                "punctuate": "true" if sdk_kwargs.get("punctuate") else "false",
                "smart_format": "true" if sdk_kwargs.get("smart_format") else "false",
            }
            resp = requests.post(url, params=params, headers=headers, data=audio_bytes, timeout=60)
            if resp.status_code != 200:
                print("WARN: Deepgram HTTP fallback returned non-200:", resp.status_code, resp.text[:300])
                raise RuntimeError(f"Deepgram HTTP error {resp.status_code}: {resp.text}")
            data = resp.json()
            parsed = self._extract_transcript_from_response(data)
            if parsed.get("text"):
                return {"text": parsed.get("text"), "confidence": parsed.get("confidence"), "language": language}
            else:
                raise ValueError("Không thể nhận dạng giọng nói. Vui lòng ghi âm lại.")
        except ValueError:
            raise
        except Exception as e:
            raise RuntimeError(
                "Deepgram transcription failed: SDK method not found or all attempts raised errors. "
                f"HTTP fallback also failed: {e}"
            )
