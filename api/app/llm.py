import json
import hashlib
import logging
from typing import Any, Optional, Dict
from pathlib import Path
import os
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

REPLAY_CACHE_FILE = Path(settings.replay_cache_path)


class LLMProvider:
    """Provider-agnostic LLM wrapper supporting Gemini and OpenAI."""

    def __init__(self):
        self.provider = settings.llm_provider
        self.temperature = settings.llm_temperature
        self.replay_mode = settings.replay_mode
        self._load_replay_cache()

    def _load_replay_cache(self):
        """Load replay cache from disk."""
        self.replay_cache = {}
        if REPLAY_CACHE_FILE.exists():
            try:
                with open(REPLAY_CACHE_FILE) as f:
                    self.replay_cache = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load replay cache: {e}")

    def _save_replay_cache(self):
        """Save replay cache to disk."""
        try:
            REPLAY_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(REPLAY_CACHE_FILE, "w") as f:
                json.dump(self.replay_cache, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save replay cache: {e}")

    def _get_prompt_hash(self, prompt: str) -> str:
        """Hash a prompt for caching."""
        return hashlib.sha256(prompt.encode()).hexdigest()

    async def generate(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> str:
        """Generate LLM response with optional JSON schema."""
        prompt_hash = self._get_prompt_hash(prompt)

        if self.replay_mode and prompt_hash in self.replay_cache:
            logger.info(f"Replay: {prompt_hash}")
            return self.replay_cache[prompt_hash]

        if self.provider == "gemini":
            response = await self._call_gemini(prompt, schema, **kwargs)
        elif self.provider == "openai":
            response = await self._call_openai(prompt, schema, **kwargs)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

        if self.replay_mode:
            self.replay_cache[prompt_hash] = response
            self._save_replay_cache()

        return response

    async def _call_gemini(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> str:
        """Call Google Gemini API."""
        try:
            import google.generativeai as genai

            api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY not set")

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            config = {
                "temperature": self.temperature,
            }

            if schema:
                config["response_mime_type"] = "application/json"
                config["response_schema"] = schema

            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(**config),
            )

            return response.text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise

    async def _call_openai(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> str:
        """Call OpenAI API."""
        try:
            from openai import AsyncOpenAI

            api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set")

            client = AsyncOpenAI(api_key=api_key)

            messages = [{"role": "user", "content": prompt}]

            kwargs = {
                "model": "gpt-4o",
                "messages": messages,
                "temperature": self.temperature,
            }

            if schema:
                kwargs["response_format"] = {
                    "type": "json_schema",
                    "json_schema": schema,
                }

            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def extract_json(self, text: str) -> Dict[str, Any]:
        """Extract JSON from LLM response."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            try:
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
            raise ValueError("Could not extract JSON from response")


llm = LLMProvider()
