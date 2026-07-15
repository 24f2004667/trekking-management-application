#!/usr/bin/env python3

import os
import signal
import subprocess
import sys
import time

BACKEND_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), "backend")
processes = []

def check_redis():
    try:
        import redis
        redis.Redis(host="localhost", port=6379).ping()
        return True
    except Exception:
        return False


def start(cmd, name):
    print(f"[run.py] starting {name}: {' '.join(cmd)}")
    p = subprocess.Popen(cmd, cwd=BACKEND_DIR)
    processes.append((name, p))
    return p


def shutdown(*_):
    print("\n[run.py] shutting down...")
    for name, p in processes:
        if p.poll() is None:
            print(f"[run.py] stopping {name}")
            p.terminate()
    for name, p in processes:
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()
    sys.exit(0)


def main():
    if not check_redis():
        print("=" * 70)
        print(" ERROR: Redis is not running on localhost:6379")
        print(" Start it first, e.g.:")
        print("=" * 70)
        sys.exit(1)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    py = sys.executable

    start([py, "-m", "celery", "-A", "tasks.celery", "worker", "--loglevel=info", "--pool=solo"], "celery-worker")

    start([py, "-m", "celery", "-A", "tasks.celery", "beat", "--loglevel=info"], "celery-beat")

    print("\n[run.py] Flask app starting at http://localhost:5000  \n")
    flask_proc = start([py, "app.py"], "flask-app")
    flask_proc.wait()
    shutdown()


if __name__ == "__main__":
    main()
