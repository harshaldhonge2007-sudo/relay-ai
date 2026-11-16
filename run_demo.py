#!/usr/bin/env python3
"""
RELAY AI — Cross-Platform Standalone Demo Launcher
Runs 100% locally on macOS, Linux, and Windows without Docker or external DBs.
Usage:
    python run_demo.py
    python run_demo.py --reset
    python run_demo.py --port 8000 --web-port 5173 --no-browser
"""

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
API_DIR = ROOT_DIR / "api"
WEB_DIR = ROOT_DIR / "web"


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a TCP port is already open/occupied."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def check_prerequisites():
    """Verify Python and Node are available."""
    if sys.version_info < (3, 9):
        print(f"Error: Python 3.9+ required. Found Python {sys.version.split()[0]}")
        sys.exit(1)

    try:
        node_ver = subprocess.check_output(["node", "--version"], text=True).strip()
    except (FileNotFoundError, subprocess.SubprocessError):
        print("Error: Node.js is not installed or not in PATH.")
        print("Please install Node.js 18+ from https://nodejs.org/")
        sys.exit(1)

    try:
        npm_ver = subprocess.check_output(["npm", "--version"], text=True).strip()
    except (FileNotFoundError, subprocess.SubprocessError):
        print("Error: npm is not installed or not in PATH.")
        sys.exit(1)

    return node_ver, npm_ver


def main():
    parser = argparse.ArgumentParser(description="Launch RELAY AI demo servers locally.")
    parser.add_argument("--port", type=int, default=8000, help="Backend API port (default: 8000)")
    parser.add_argument("--web-port", type=int, default=5173, help="Frontend Vite port (default: 5173)")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--reset", action="store_true", help="Reset demo dataset to initial state")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open the browser")
    args = parser.parse_args()

    print("=" * 60)
    print("  RELAY AI — Standalone Hackathon Demo Launcher")
    print("=" * 60)

    # 1. Check prerequisites
    node_ver, npm_ver = check_prerequisites()
    print(f"✓ Python: {sys.version.split()[0]}")
    print(f"✓ Node.js: {node_ver} (npm: {npm_ver})")

    # 2. Check if ports are already occupied
    if is_port_in_use(args.port, args.host):
        print("\n" + "!" * 60)
        print(f"ERROR: Backend port {args.port} is already in use on {args.host}!")
        print(f"A process is already listening on port {args.port}.")
        print("To resolve:")
        print(f"  - Terminate the conflicting process: lsof -ti :{args.port} | xargs kill -9")
        print(f"  - Or run with a different port: python run_demo.py --port <port>")
        print("!" * 60)
        sys.exit(1)

    if is_port_in_use(args.web_port, args.host):
        print("\n" + "!" * 60)
        print(f"ERROR: Frontend port {args.web_port} is already in use on {args.host}!")
        print(f"A process is already listening on port {args.web_port}.")
        print("To resolve:")
        print(f"  - Terminate the conflicting process: lsof -ti :{args.web_port} | xargs kill -9")
        print(f"  - Or run with a different port: python run_demo.py --web-port <port>")
        print("!" * 60)
        sys.exit(1)

    # 3. Ensure frontend dependencies are installed
    if not (WEB_DIR / "node_modules").exists():
        print("\nFirst time setup: Installing frontend dependencies (npm install)...")
        res = subprocess.run(["npm", "install"], cwd=str(WEB_DIR))
        if res.returncode != 0:
            print("Error: npm install failed.")
            sys.exit(1)

    # Prepare environment variables
    env = os.environ.copy()
    env["RELAY_DEMO_MODE"] = "1"
    env["PORT"] = str(args.port)
    env["HOST"] = args.host
    env["VITE_API_URL"] = f"http://{args.host}:{args.port}"

    processes = []

    def shutdown(signum=None, frame=None):
        print("\nShutting down RELAY AI servers...")
        for p in processes:
            try:
                p.terminate()
                p.wait(timeout=3)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        print("Servers stopped cleanly.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # 4. Start backend
    print(f"\nStarting Backend API on http://{args.host}:{args.port} ...")
    api_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "mock_server:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]
    api_proc = subprocess.Popen(api_cmd, cwd=str(API_DIR), env=env)
    processes.append(api_proc)

    # Poll health endpoint
    health_url = f"http://{args.host}:{args.port}/health"
    backend_ready = False
    for _ in range(30):
        if api_proc.poll() is not None:
            print("Error: Backend process exited unexpectedly.")
            shutdown()
        try:
            with urllib.request.urlopen(health_url, timeout=0.5) as resp:
                if resp.status == 200:
                    backend_ready = True
                    break
        except Exception:
            time.sleep(0.2)

    if not backend_ready:
        print("Warning: Backend health check timed out. Proceeding...")

    # Optional dataset reset
    if args.reset:
        print("Resetting demo dataset to clean initial state...")
        try:
            req = urllib.request.Request(f"http://{args.host}:{args.port}/demo/seed", method="POST")
            urllib.request.urlopen(req, timeout=3)
            print("Dataset reset complete.")
        except Exception as e:
            print(f"Warning: Failed to reset dataset: {e}")

    # 5. Start frontend
    print(f"Starting Frontend Web UI on http://localhost:{args.web_port} ...")
    # Vite dev command
    web_cmd = ["npm", "run", "dev", "--", "--port", str(args.web_port)]
    web_proc = subprocess.Popen(web_cmd, cwd=str(WEB_DIR), env=env)
    processes.append(web_proc)

    time.sleep(1.5)

    app_url = f"http://localhost:{args.web_port}"
    print("\n" + "=" * 60)
    print("  RELAY AI IS LIVE!")
    print(f"  Web UI:    {app_url}")
    print(f"  API Docs:  http://{args.host}:{args.port}/docs")
    print(f"  Health:    {health_url}")
    print("-" * 60)
    print("  Demo Roles Available (via top-right role switcher):")
    print("    - Alex Chen (Engineering Lead)    [Full review, release, ACLs]")
    print("    - Jordan Taylor (Successor)       [View permitted, simulation]")
    print("    - Sam Rodriguez (Contractor)      [Restricted public view]")
    print("=" * 60)
    print("Press Ctrl+C to stop both servers.\n")

    if not args.no_browser:
        try:
            webbrowser.open(app_url)
        except Exception:
            pass

    try:
        while True:
            time.sleep(0.5)
            # Check if any child process died
            if api_proc.poll() is not None:
                print(f"Backend exited with code {api_proc.returncode}")
                break
            if web_proc.poll() is not None:
                print(f"Frontend exited with code {web_proc.returncode}")
                break
    except KeyboardInterrupt:
        pass
    finally:
        shutdown()


if __name__ == "__main__":
    main()
