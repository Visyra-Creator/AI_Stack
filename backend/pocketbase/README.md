# PocketBase setup for AIKeeper

This folder contains import-ready collection configs for the app data layer migration.

## Files

- `collections.import.json` - local/dev rules (open)
- `collections.import.prod.json` - production-safe rules (auth required)

## 1) Start PocketBase

```bash
cd /Users/sagar/AIKeeper1/backend/pocketbase
./pocketbase serve --http=0.0.0.0:8090
```

## 2) Create superuser (one time)

```bash
cd /Users/sagar/AIKeeper1/backend/pocketbase
./pocketbase superuser upsert YOUR_EMAIL YOUR_PASSWORD
```

## 3) Import schema (if Dashboard Import button is missing)

Use the REST API directly:

```bash
curl -X POST "http://127.0.0.1:8090/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'
```

Copy the returned `token`, then import:

```bash
curl -X POST "http://127.0.0.1:8090/api/collections/import" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @/Users/sagar/AIKeeper1/backend/pocketbase/collections.import.json
```

For production rules, replace the JSON path with `collections.import.prod.json`.

## 4) Expo app environment

Create `frontend/.env`:

```bash
EXPO_PUBLIC_USE_POCKETBASE=true
EXPO_PUBLIC_POCKETBASE_URL=http://YOUR_LAN_IP:8090
```

Example: `http://192.168.1.25:8090`

## 5) Run app

```bash
cd /Users/sagar/AIKeeper1/frontend
yarn install
yarn start
```

## Notes

- Keep Android phone and laptop on same Wi-Fi.
- Use LAN IP, not `localhost`, in Expo env.
- Existing AsyncStorage data is lazily migrated to PocketBase on first read per section.

