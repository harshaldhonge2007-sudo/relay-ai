"""
RELAY AI - Initialize and verify the system.
"""

import asyncio
import logging
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "api"))

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


async def verify_setup():
    """Verify RELAY AI setup."""
    print()
    print("=" * 70)
    print("RELAY AI - System Verification")
    print("=" * 70)
    print()

    try:
        from app.config import get_settings
        settings = get_settings()
        print("✓ Configuration loaded")
        print(f"  - Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else '***'}")
        print(f"  - LLM Provider: {settings.llm_provider}")
        print(f"  - Replay Mode: {settings.replay_mode}")
        print()
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        return False

    try:
        from app.db import init_db
        await init_db()
        print("✓ Database initialized")
        print()
    except Exception as e:
        print(f"✗ Database error: {e}")
        return False

    try:
        from app.llm import llm
        print("✓ LLM provider loaded")
        print(f"  - Model: {llm.provider}")
        print(f"  - Temperature: {llm.temperature}")
        print()
    except Exception as e:
        print(f"✗ LLM error: {e}")

    print("Project Structure:")
    relay_dir = Path(__file__).parent / "relay"
    for category, pattern in [
        ("Detectors", "api/app/detect/*.py"),
        ("Risk", "api/app/risk/*.py"),
        ("Interview", "api/app/interview/*.py"),
        ("Handover", "api/app/handover/*.py"),
        ("Simulation", "api/app/sim/*.py"),
    ]:
        files = list((relay_dir).glob(pattern))
        files = [f.name for f in files if not f.name.startswith("_")]
        print(f"  {category:15} {', '.join(files)}")
    print()

    print("Seed Data:")
    seed_dir = Path(__file__).parent / "relay" / "seed"
    for file in seed_dir.glob("*"):
        if file.is_file():
            size = file.stat().st_size
            print(f"  {file.name:20} ({size:,} bytes)")
    print()

    print("=" * 70)
    print("✓ Setup verification complete!")
    print()
    print("Next steps:")
    print("  1. Run: docker-compose up")
    print("  2. Run: python test_integration.py")
    print("  3. Run: ./scripts/demo.sh")
    print("  4. Open: http://localhost:5173")
    print()
    print("=" * 70)
    print()

    return True


def main():
    """Entry point."""
    try:
        result = asyncio.run(verify_setup())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\nInterrupted")
        sys.exit(0)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
