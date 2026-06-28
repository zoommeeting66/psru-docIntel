# 03 — System Architecture

## 3.1 มุมมองภาพรวม (C4 — Context)
```
        ┌──────────────────────────────────────────────────────────────┐
        │                     Organization SOS Platform                 │
        │                                                               │
 Employee│  ┌────────────┐        ┌─────────────────────────────────┐   │
 ───────▶│  │ Mobile App │◀──────▶│            Backend               │   │
Responder│  │ (Flutter)  │  WSS/  │ (microservices on Kubernetes)    │   │
 ───────▶│  └────────────┘  HTTPS │                                 │   │
 Control │  ┌────────────┐        │  Auth · Incident · Notification │   │
 ───────▶│  │ Web Dash   │◀──────▶│  · GIS · HR-Connector · Audit   │   │
         │  │ (React)    │        └────────────┬────────────────────┘   │
         │  └────────────┘                     │                        │
        └─────────────────────────────────────┼────────────────────────┘
                                               │
   External systems:  ┌───────────────┐  ┌─────┴──────┐  ┌──────────────┐
                      │ IdP (Entra/   │  │ HRIS/LDAP/ │  │ SMS GW · FCM/│
                      │ Google/LDAP)  │  │ AD         │  │ APNs · LINE  │
                      └───────────────┘  └────────────┘  └──────────────┘
```

## 3.2 สถาปัตยกรรมเชิงตรรกะ (Logical / Microservices)
| Service | หน้าที่ | Tech |
|---------|---------|------|
| **API Gateway** | routing, rate-limit, TLS termination, request auth (JWT verify) | Kong / NGINX / Envoy |
| **Auth Service** | OIDC/SAML broker, issue JWT, session, MFA policy | Keycloak |
| **HR Data Connector** | sync บุคลากรจาก HRIS/LDAP/AD/Entra/Google (scheduled + delta) | NestJS worker |
| **Incident Service** | core: รับ SOS, dedupe, state machine, assignment, timeline | NestJS/Go |
| **Notification Service** | fan-out Push/SMS/LINE/Email, retry, template | NestJS + queue |
| **GIS Service** | geocoding, indoor positioning resolve, geofence, map tiles proxy | Go + PostGIS |
| **Ingest/Relay Gateway** | รับข้อความจาก SMS inbound, LoRa GW, BLE/Wi-Fi relay payload | NestJS |
| **Audit Service** | เขียน audit log (append-only), serve audit queries | NestJS + WORM store |
| **Realtime Hub** | WebSocket fan-out ไป Dashboard/แอป (subscribe by role/scope) | Socket.IO + Redis |
| **Report Service** | สร้าง after-action report, สถิติ, export | NestJS + worker |

> เริ่มต้นแบบ **modular monolith** ก็ได้ (deploy เร็วใน MVP) แล้วค่อยแยก service ตามภาระงาน
> Incident + Realtime เป็นหัวใจ จึงควรแยก scale ได้ก่อน

## 3.3 Data Stores
| Store | ใช้ทำอะไร |
|-------|-----------|
| **PostgreSQL 16** | ข้อมูลหลัก: persons, incidents, events, assignments, audit |
| **PostGIS 3.4** | geometry/geography (จุดเหตุ, geofence, อาคาร/ชั้น polygon) |
| **Redis 7** | cache, session, **Streams** (event bus), Pub/Sub (realtime), rate-limit |
| **Object Storage (S3/R2/MinIO)** | ไฟล์แนบ (รูปภาพเหตุ, รายงาน PDF), แผนที่ offline tiles |
| **WORM/Cold store** | audit log สำเนา append-only เพื่อ compliance |

## 3.4 Data Flow — SOS Online (happy path)
```
App ──POST /v1/incidents (idempotency-key)──▶ API GW ──▶ Incident Svc
  1. verify JWT, validate payload
  2. dedupe by (person, time-window, idempotency-key)
  3. resolve location (GIS Svc: GPS→address, beacon→building/floor)
  4. enrich (HR data: supervisor, emergency contacts, consented health)
  5. persist incident + first event → PostgreSQL/PostGIS
  6. publish "incident.created" → Redis Stream
        ├─▶ Notification Svc → Push/SMS/LINE/Email (responder, supervisor, contact)
        ├─▶ Realtime Hub → WSS push to Control Dashboard + responders
        └─▶ Audit Svc → log access/enrichment
  7. return 201 {incident_id, status, channels} → App
```

## 3.5 Data Flow — SOS Offline (Store & Forward / Relay)
```
App offline ──▶ write to encrypted Outbox (local)
   ├─ try SMS (to control number) ─────────────▶ SMS GW ─inbound webhook─▶ Ingest GW
   ├─ try BLE Mesh (gossip to nearby phones) ──▶ a relay phone w/ net ──▶ POST /v1/incidents
   ├─ try Wi-Fi Direct (nearby device) ────────▶ relay ──────────────────▶ POST /v1/incidents
   └─ keep in Outbox; on reconnect ────────────▶ POST /v1/incidents/sync (batch)
Backend dedups all of the above into ONE incident via client-generated incident_uuid
```
- **incident_uuid** สร้างที่เครื่อง client (UUIDv7) แนบไปทุกช่องทาง → backend ใช้ dedupe
- ดูรายละเอียดการ relay/encoding ใน [08-offline-communication](08-offline-communication.md)

## 3.6 Deployment (Physical / DevOps)
```
            Internet
               │  (mTLS/HTTPS, WAF)
        ┌──────┴───────┐
        │  Ingress/LB  │  (cloud LB + WAF)
        └──────┬───────┘
   ┌───────────┴────────────┐  Kubernetes cluster (multi-AZ)
   │  ns: gateway/auth      │
   │  ns: incident/realtime │   HPA autoscale; PodDisruptionBudget
   │  ns: notify/gis/audit  │
   └───────────┬────────────┘
   ┌───────────┴───────────────────────────┐
   │ Managed PostgreSQL (HA, PITR backup)  │
   │ Redis (HA/replica)                    │
   │ Object storage (versioned)            │
   └───────────────────────────────────────┘
   On-prem/edge (optional): LoRa Gateway, SMS modem pool, indoor beacon controllers
```
- **Hosting**: คลาวด์ในประเทศ/ภูมิภาคที่สอดคล้อง PDPA (data residency) หรือ on-prem
- **Multi-AZ** สำหรับ availability ≥ 99.9%
- **CI/CD**: GitHub Actions → build/test/scan → Helm deploy (staging → prod, manual approval)
- **IaC**: Terraform (infra) + Helm (apps); config แยกตาม env ผ่าน Sealed Secrets/Vault

## 3.7 Cross-cutting Concerns
- **Observability**: OpenTelemetry trace ทุก request; Prometheus metrics; Loki logs; Grafana dashboards; alerting (PagerDuty/Opsgenie)
- **Resilience**: circuit breaker, retry with backoff, dead-letter queue สำหรับ notification
- **Idempotency**: ทุก write รับ `Idempotency-Key`; SOS ใช้ `incident_uuid`
- **Scalability**: stateless services + Redis Streams consumer groups; DB read replica
- **Config**: 12-factor; secrets ใน Vault/Sealed Secrets; ไม่มี secret ใน repo
- **Time**: ทุก service ใช้ UTC; client แนบ timezone offset

## 3.8 สถาปัตยกรรมแอปมือถือ (Mobile internal)
```
Flutter UI ── BLoC/Riverpod state ── Domain ── Repositories
                                                  ├─ ApiClient (Dio + retry)
                                                  ├─ Outbox (SQLite + sqlcipher)
                                                  ├─ LocationProvider (GPS/beacon/wifi)
                                                  ├─ ConnectivityWatcher
                                                  └─ Channels: SMS · BLE Mesh · Wi-Fi Direct
Background: foreground service (Android) / BGTask + significant-location (iOS)
```
ดูรายละเอียดหน้าจอใน [06-mobile-screen-flow](06-mobile-screen-flow.md)
