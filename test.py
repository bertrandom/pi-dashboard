import json, time, requests

BASE = '/opt/led-matrix'

with open(f'{BASE}/.spotify_token_cache') as f:
    tok = json.load(f)

with open(f'{BASE}/config.json') as f:
    cfg = json.load(f)['spotify']

if tok.get('expires_at', 0) < time.time():
    print("Token expired — refreshing...")
    r = requests.post('https://accounts.spotify.com/api/token', data={
        'grant_type': 'refresh_token',
        'refresh_token': tok['refresh_token'],
        'client_id': cfg['client_id'],
        'client_secret': cfg['client_secret'],
    }, timeout=10)
    print(f"Refresh status: {r.status_code}")
    if r.status_code == 200:
        tok.update(r.json())
        print("Token refreshed OK")
    else:
        print(f"Refresh failed: {r.text}"); exit(1)

print(f"Token prefix: {tok['access_token'][:20]}...")
print("\nCalling /v1/me/player ...")
try:
    r = requests.get('https://api.spotify.com/v1/me/player',
                     headers={'Authorization': f'Bearer {tok["access_token"]}'},
                     timeout=10)
    print(f"Status: {r.status_code}")
    retry_after = r.headers.get('Retry-After')
    if retry_after:
        print(f"Retry-After: {retry_after}s ({int(retry_after)//60}m {int(retry_after)%60}s)")
    else:
        print("Retry-After: (not present)")
    print(f"X-RateLimit-*: { {k:v for k,v in r.headers.items() if 'rate' in k.lower()} }")
    print(f"Body: {r.text[:500] or '(empty — nothing playing)'}")
except requests.exceptions.Timeout:
    print("TIMEOUT — network hang to api.spotify.com")
except Exception as e:
    print(f"ERROR: {e}")