"""In-process pub/sub hub for job progress.

Phase 1 runs the pipeline in the same process (FastAPI BackgroundTasks), so a
simple in-memory hub of asyncio queues is enough to push live updates to
WebSocket subscribers. In Phase 2 (Celery/Redis workers) this is swapped for a
Redis pub/sub channel keyed by job_id — the WS endpoint API stays the same.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict


class Hub:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, key: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs[key].add(q)
        return q

    def unsubscribe(self, key: str, q: asyncio.Queue) -> None:
        subs = self._subs.get(key)
        if subs:
            subs.discard(q)
            if not subs:
                self._subs.pop(key, None)

    def publish(self, key: str, message: dict) -> None:
        for q in list(self._subs.get(key, ())):
            q.put_nowait(message)


hub = Hub()
