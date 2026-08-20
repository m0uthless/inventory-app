from django.contrib.sessions.backends.db import SessionStore

SESSION_KEY = "u1xk54fatahs0zyg4735bfzt1hxczsnl"

s = SessionStore(session_key=SESSION_KEY)
print("exists:", s.exists(SESSION_KEY))
print("contenuto sessione:", dict(s.items()))
