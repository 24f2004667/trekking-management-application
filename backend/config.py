import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
os.makedirs(os.path.join(BASE_DIR, "instance"), exist_ok=True)

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "tma-secret-key-2026")
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(BASE_DIR, "instance", "tma.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CACHE_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0").replace("/0", "/1")
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL

    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_USERNAME", "noreply@tma.com")
    MAIL_SUPPRESS_SEND = os.environ.get("MAIL_USERNAME") is None

    CACHE_TTL = 120


def get_redis():
    import redis as redis_lib
    return redis_lib.Redis.from_url(Config.CACHE_REDIS_URL)
