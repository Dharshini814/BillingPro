"""
In-memory rate limiter using a sliding window counter.
Thread-safe, no external dependencies required.
"""

import time
import threading
from fastapi import HTTPException, Request, status

from app.core.config import RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_SECONDS


class RateLimiter:
    """
    Sliding-window rate limiter.
    Tracks request timestamps per client IP and rejects requests
    that exceed the configured threshold.
    """

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, ip: str) -> bool:
        """Return True if the request is allowed, False if rate-limited."""
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            timestamps = self._requests.get(ip, [])
            # Remove expired timestamps
            timestamps = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= self.max_requests:
                self._requests[ip] = timestamps
                return False

            timestamps.append(now)
            self._requests[ip] = timestamps
            return True

    def cleanup(self):
        """Remove entries older than the window. Call periodically."""
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            expired_keys = []
            for ip, timestamps in self._requests.items():
                filtered = [t for t in timestamps if t > cutoff]
                if filtered:
                    self._requests[ip] = filtered
                else:
                    expired_keys.append(ip)
            for key in expired_keys:
                del self._requests[key]


# Default instance using config values
default_rate_limiter = RateLimiter(
    max_requests=RATE_LIMIT_REQUESTS,
    window_seconds=RATE_LIMIT_WINDOW_SECONDS,
)


def rate_limit_dependency(
    max_requests: int = None,
    window_seconds: int = None,
):
    """
    Factory that returns a FastAPI dependency for rate limiting.

    Usage:
        @router.post("/endpoint", dependencies=[Depends(rate_limit_dependency())])
        # or with custom limits:
        @router.post("/endpoint", dependencies=[Depends(rate_limit_dependency(10, 60))])
    """
    limiter = (
        default_rate_limiter
        if max_requests is None and window_seconds is None
        else RateLimiter(
            max_requests=max_requests or RATE_LIMIT_REQUESTS,
            window_seconds=window_seconds or RATE_LIMIT_WINDOW_SECONDS,
        )
    )

    async def _check_rate_limit(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        if not limiter.check(client_ip):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests — please try again later",
            )

    return _check_rate_limit
