from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")


def _generate(prompt: str, json_mode: bool = False) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1},
    }
    if json_mode:
        payload["format"] = "json"
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(
            "Ollama is not running. Start Ollama and run "
            f"'ollama pull {OLLAMA_MODEL}'."
        ) from exc
    return result["response"].strip()


async def call_gemini(prompt: str) -> dict | list:
    """Send a prompt to the local Ollama model and return parsed JSON."""
    text = await asyncio.to_thread(_generate, prompt, True)
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]
    return json.loads(text)


async def call_gemini_text(prompt: str) -> str:
    """Send a prompt to the local Ollama model and return raw text."""
    return await asyncio.to_thread(_generate, prompt)
