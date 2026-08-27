# Week 2 — HTTP as a Protocol

## Learning objectives

By the end of this chapter, you should be able to:

- explain HTTP as an application-layer protocol rather than merely a convention for building REST APIs;
- distinguish HTTP **semantics** from the details of HTTP/1.1, HTTP/2, and HTTP/3 message transport;
- describe the roles of clients, origin servers, proxies, gateways, and caches;
- distinguish a **resource** from a **representation** of that resource;
- choose HTTP methods based on their defined semantics rather than on CRUD mnemonics;
- distinguish **safe**, **idempotent**, and **cacheable** operations;
- interpret the major classes of HTTP status codes and choose codes that communicate useful protocol semantics;
- use headers such as `Content-Type`, `Accept`, `Location`, `Cache-Control`, `ETag`, `If-None-Match`, and `If-Match`;
- explain freshness, validation, and conditional requests;
- reason about retries, duplicate requests, and the lost-update problem using HTTP semantics.

---

# 1. HTTP is more than a transport for JSON

Modern application developers often first encounter HTTP through code such as:

```python
@app.get("/users/{user_id}")
def get_user(user_id: str):
    ...
```

or:

```typescript
const response = await fetch("/api/users/123");
```

This can make HTTP look like a thin transport layer:

```text
frontend
   |
   | JSON
   v
backend
```

But HTTP defines much more than how bytes travel between two programs.

HTTP gives participants a shared vocabulary for expressing things such as:

- **what resource** a request concerns;
- **what the client intends to do** with that resource;
- whether the operation is safe to perform automatically;
- whether a failed request can be retried;
- whether a response may be cached;
- whether a cached representation is still valid;
- whether a request should only proceed if a resource has not changed;
- what kind of representation is being transferred;
- whether an operation succeeded, failed, redirected, or requires further action.

A useful mental model is:

```text
HTTP = shared protocol semantics
       +
       message metadata
       +
       representation transfer
       +
       transport/framing rules
```

When designing an HTTP API, you are therefore not inventing an entirely new protocol from scratch.

You are building your application-level contract **on top of an existing protocol contract**.

The more accurately your API uses HTTP's existing semantics, the more work can be performed correctly by generic infrastructure:

```text
browsers
caches
CDNs
reverse proxies
API gateways
load balancers
HTTP client libraries
monitoring tools
crawlers
debugging tools
```

This is one of the central reasons HTTP semantics matter.

---

# 2. HTTP semantics are not HTTP/1.1 syntax

A raw HTTP/1.1 request might look like this:

```http
GET /users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
```

and the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "user-123-v7"

{
  "id": "123",
  "name": "Alice"
}
```

It is tempting to conclude that HTTP is a text protocol whose requests consist of:

```text
request line
headers
blank line
body
```

That describes HTTP/1.1 reasonably well.

It does **not** describe HTTP in general.

HTTP/2 and HTTP/3 use different framing mechanisms. HTTP/2 uses binary frames and multiplexed streams; HTTP/3 carries HTTP semantics over QUIC.

Yet the application still reasons in terms of:

```text
GET
/users/123
200 OK
Content-Type
ETag
representation
```

The important separation is:

```text
                 HTTP semantics
       methods, status codes, fields,
       resources, representations
                    |
        +-----------+-----------+
        |           |           |
        v           v           v
     HTTP/1.1     HTTP/2      HTTP/3
```

For API design, we will focus primarily on **HTTP semantics**.

The protocol version changes how messages are encoded and transported.

It does not change the fundamental meaning of `GET`, `PUT`, `404`, or `ETag`.

---

# 3. The client–server interaction model

At its simplest, HTTP works as a request-response protocol.

```text
client                         server
   |                              |
   | -------- request ----------> |
   |                              |
   | <------- response ---------- |
   |                              |
```

The client sends a request expressing an intention.

For example:

```http
GET /weather/london
```

The origin server interprets that request relative to the target resource and returns a response.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "temperature_c": 18
}
```

A request usually includes some combination of:

```text
method
target URI
header fields
content
```

A response usually includes:

```text
status code
header fields
content
```

Notice the asymmetry:

```text
request  → intention
response → result
```

This sounds obvious, but it provides a useful way of understanding methods and status codes.

The method tells the server what the client is asking to happen.

The status code tells the client what happened when the server processed that request.

---

# 4. The real network path can contain intermediaries

The simple model:

```text
client → server
```

is often incomplete.

A production request might travel through:

```text
client
  |
  v
corporate proxy
  |
  v
CDN
  |
  v
load balancer
  |
  v
API gateway
  |
  v
reverse proxy
  |
  v
application server
```

These systems are **HTTP intermediaries**.

Depending on their role, they may:

- route requests;
- terminate TLS;
- authenticate callers;
- enforce rate limits;
- compress content;
- cache responses;
- retry requests;
- add or remove headers;
- collect telemetry;
- transform protocol versions.

This matters because HTTP APIs do not operate in a private conversation between two application processes.

Generic infrastructure may interpret the request based on HTTP semantics.

If your API defines:

```http
GET /accounts/123/delete
```

and accessing that URI deletes the account, you have created a dangerous mismatch.

A crawler, prefetcher, browser, cache, or monitoring tool is allowed to assume that `GET` is safe.

The application has violated the protocol contract.

---

# 5. Resources and representations

HTTP is built around the concept of a **resource**.

A resource is the thing identified by a URI.

For example:

```text
https://api.example.com/users/123
```

might identify a user.

But the bytes sent over the network are not literally the user.

They are a **representation** of that resource.

For example:

```json
{
  "id": "123",
  "name": "Alice",
  "status": "active"
}
```

This distinction is extremely important.

```text
URI
 |
 v
resource
 |
 +------ representation A: JSON
 |
 +------ representation B: XML
 |
 +------ representation C: HTML
 |
 +------ representation D: image
```

The same resource can potentially have multiple representations.

For example:

```http
GET /reports/123
Accept: application/json
```

might return structured report data, while:

```http
GET /reports/123
Accept: application/pdf
```

might return a PDF rendering.

The resource is:

```text
report 123
```

The representations differ.

This distinction also helps explain `PUT`.

A `PUT` request sends a representation expressing the desired state of the target resource. It does not mean "update some database row."

---

# 6. URIs identify resources

A request acts on a **target resource**.

For an HTTP API, the target is usually identified by a URI such as:

```text
https://api.example.com/orders/ord_123
```

You can think of this as:

```text
scheme       authority         path
  |              |              |
https:// api.example.com /orders/ord_123
```

A query component may further identify or parameterise the target:

```text
/orders?status=pending&limit=50
```

One useful principle from Week 1 carries directly into HTTP:

> A URI should identify a meaningful resource in the API's conceptual model, not expose internal storage machinery without good reason.

Compare:

```text
/customers/cus_123
```

with:

```text
/database/customer_table/row/91827
```

The first identifies a domain concept.

The second exposes an implementation concept.

HTTP does not force you to choose good resources.

That remains an API design problem.

---

# 7. Methods express request semantics

The HTTP request method is not merely a routing label.

It communicates the **meaning of the request**.

Core methods include:

| Method | Core semantic intent |
|---|---|
| `GET` | Transfer a current representation of the target resource |
| `HEAD` | Same as `GET`, but without response content |
| `POST` | Ask the target resource to process the request content according to its own semantics |
| `PUT` | Create or replace the state of the target resource with the supplied representation |
| `DELETE` | Remove the association between the target resource and its current functionality |
| `OPTIONS` | Describe communication options for the target resource |

`PATCH` is defined separately and expresses a request to apply partial modifications to a resource.

The common beginner mnemonic:

```text
GET    = read
POST   = create
PUT    = update
DELETE = delete
```

is useful for the first ten minutes of learning HTTP.

It becomes misleading after that.

In particular:

```text
POST ≠ simply "create"
PUT  ≠ simply "update"
```

Their distinction is semantic.

---

# 8. GET — retrieve a representation

A `GET` request asks for a current selected representation of the target resource.

```http
GET /users/123
```

Possible response:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "123",
  "name": "Alice"
}
```

`GET` is defined as **safe**.

That means the client is not asking the server to change application state.

This does **not** mean the server performs literally no writes.

A server may still:

```text
write access logs
increment metrics
refresh an internal cache
record tracing information
```

Those are incidental effects.

The important distinction is whether the caller requested a state-changing operation.

This is why:

```http
GET /users/123/delete
```

should not delete a user.

A generic system might issue `GET` automatically.

---

# 9. HEAD — GET without transferring the content

`HEAD` has the same semantics as `GET`, except that the server does not send response content.

For example:

```http
HEAD /downloads/archive.zip
```

might return:

```http
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Length: 73492811
ETag: "ab8f-23891"
Last-Modified: Tue, 25 Aug 2026 10:00:00 GMT
```

without transferring the 73 MB archive itself.

Potential uses include:

- checking whether a resource exists;
- inspecting metadata;
- checking modification state;
- inspecting content size;
- link validation.

A server should generally return the same header fields it would have returned for the equivalent `GET`, although some headers may be omitted when computing them would require generating the content.

---

# 10. POST — ask a resource to process something

`POST` is deliberately broad.

It asks the target resource to process the request content according to that resource's own semantics.

A common example is collection creation:

```http
POST /orders
Content-Type: application/json

{
  "product_id": "prod_7",
  "quantity": 2
}
```

The server chooses an identifier:

```http
HTTP/1.1 201 Created
Location: /orders/ord_981
Content-Type: application/json

{
  "id": "ord_981",
  "product_id": "prod_7",
  "quantity": 2
}
```

But `POST` can represent much more than creation.

For example:

```http
POST /search
```

```http
POST /payments/pay_123/refunds
```

```http
POST /jobs/job_123/executions
```

```http
POST /documents/doc_123/actions
```

The defining idea is not "create."

It is:

> Process this request according to the semantics of the target resource.

`POST` is not safe.

It is not idempotent **by definition**.

A particular POST operation can nevertheless be designed to behave idempotently.

We will return to this distinction later.

---

# 11. PUT — establish the state of a known resource

`PUT` expresses a stronger and more specific intention.

The client knows the target resource:

```http
PUT /profiles/usr_123
Content-Type: application/json

{
  "display_name": "Alice",
  "timezone": "Europe/London"
}
```

Conceptually, the request says:

> Make the state of `/profiles/usr_123` correspond to this representation.

If the target did not previously have a current representation and the server creates it, `201 Created` is appropriate.

If an existing representation is replaced, a server will normally respond with `200 OK` or `204 No Content`.

The important difference from `POST` is:

```text
POST:
    target resource decides how to process the content

PUT:
    content describes the desired state of the known target
```

Compare:

```http
POST /profiles
```

The server may create a new profile and choose its identifier.

versus:

```http
PUT /profiles/usr_123
```

The client already knows the target URI.

This is also why `PUT` is idempotent.

Sending the same desired state once:

```text
timezone = Europe/London
```

and sending it three times should have the same intended final effect.

---

# 12. PATCH — apply a partial modification

`PATCH` exists because replacing an entire representation is not always convenient or appropriate.

Suppose the current representation is:

```json
{
  "id": "usr_123",
  "display_name": "Alice",
  "timezone": "Europe/London",
  "language": "en",
  "marketing_emails": true
}
```

A client wants only to change:

```text
marketing_emails
```

A patch might look conceptually like:

```http
PATCH /users/usr_123
Content-Type: application/merge-patch+json

{
  "marketing_emails": false
}
```

A critical subtlety:

> `PATCH` is a method. It does not define the patch-document format.

Different patch media types can have different semantics.

For example, a patch operation meaning:

```text
set marketing_emails to false
```

can naturally be idempotent.

An operation meaning:

```text
increment login_count by 1
```

is not.

Therefore `PATCH` is **not idempotent by definition**.

Whether a particular PATCH request is idempotent depends on the semantics of the patch document.

The PATCH specification also requires the server to apply the set of changes atomically: clients should not observe an intermediate partially applied state.

---

# 13. DELETE — remove the resource's current association

A request such as:

```http
DELETE /users/usr_123
```

asks the server to remove the association between that target URI and its current functionality.

This wording is more precise than:

> Delete the database row.

HTTP does not dictate what happens to storage.

An application might implement deletion by:

- physically deleting data;
- soft deleting;
- archiving;
- anonymising personal information;
- disabling the resource;
- scheduling asynchronous removal.

Those are application semantics.

A successful DELETE might return:

```http
HTTP/1.1 204 No Content
```

If deletion has been accepted but will happen asynchronously:

```http
HTTP/1.1 202 Accepted
```

could be more appropriate.

`DELETE` is idempotent.

This often surprises people.

Consider:

```text
DELETE /users/123
```

first request:

```text
user becomes absent
```

second request:

```text
user remains absent
```

The two responses do not have to be identical.

For example:

```text
first request  → 204
second request → 404
```

can still be compatible with idempotency.

Idempotency concerns the intended effect on server state, not identical responses.

---

# 14. OPTIONS — ask what communication is supported

`OPTIONS` asks about communication options for a resource.

For example:

```http
OPTIONS /users/123
```

A response might include:

```http
HTTP/1.1 204 No Content
Allow: GET, HEAD, PUT, PATCH, DELETE, OPTIONS
Accept-Patch: application/merge-patch+json
```

This can help advertise:

- supported methods;
- supported patch formats;
- protocol capabilities.

You will also encounter `OPTIONS` in browser CORS preflight requests.

CORS is primarily a browser security mechanism rather than an API design primitive, so we will not treat it in detail here.

---

# 15. Safe, idempotent, and cacheable are different properties

These terms are often confused.

They describe different things.

## Safe

A method is **safe** when the client is not asking for a state change.

Core safe methods include:

```text
GET
HEAD
OPTIONS
TRACE
```

Safety is primarily about intent.

---

## Idempotent

An operation is **idempotent** when performing the same request multiple times has the same intended effect as performing it once.

For example:

```http
PUT /settings/usr_1

{
  "theme": "dark"
}
```

Executing this once:

```text
theme = dark
```

Executing it ten times:

```text
theme = dark
```

The final intended state is the same.

---

## Cacheable

A response is cacheable when HTTP caching rules permit it to be stored and reused.

This is a separate concern.

A method can be:

```text
safe but not practically cached
idempotent but unsafe
cacheable without being safe in the general sense
```

A useful summary:

| Method | Safe? | Idempotent by definition? | Typical caching |
|---|---:|---:|---|
| `GET` | Yes | Yes | Common |
| `HEAD` | Yes | Yes | Supported |
| `POST` | No | No | Possible under specific explicit conditions; uncommon |
| `PUT` | No | Yes | Responses are not normally reused as cached representations |
| `PATCH` | No | No | Not normally cacheable as an operation |
| `DELETE` | No | Yes | Response not cacheable |
| `OPTIONS` | Yes | Yes | Not generally used for ordinary representation caching |

Do not memorize the table without understanding the properties.

---

# 16. Why idempotency matters: failure creates uncertainty

Suppose a client sends:

```http
POST /payments

{
  "account": "A",
  "amount": "100.00",
  "currency": "GBP"
}
```

The server receives it and successfully charges £100.

Then the network fails before the response reaches the client.

```text
client                  server
   |                       |
   | ----- POST ---------> |
   |                       | charge £100
   |                       |
   | <--- response --- X   |
   |      network loss     |
```

What does the client know?

Only this:

```text
I did not receive a response.
```

It does **not** know:

```text
the server did not process the request
```

If the client blindly retries:

```http
POST /payments
```

the user might be charged twice.

This is why idempotency is operationally important.

For methods that are idempotent by definition, generic clients and infrastructure have more freedom to retry after certain communication failures.

For non-idempotent operations, the application often needs an additional mechanism such as an application-level idempotency key:

```http
POST /payments
Idempotency-Key: 7cb7c2fe-...

{
  "amount": "100.00",
  "currency": "GBP"
}
```

That header is not a general core HTTP guarantee by itself; its behaviour must be part of the API's application contract.

The important design question is:

> Can the client safely repeat this operation when it cannot tell whether the previous request completed?

---

# 17. Status codes communicate the result

HTTP responses use three-digit status codes.

The first digit identifies the broad class:

| Range | Class | Meaning |
|---|---|---|
| `1xx` | Informational | Request received; processing continues |
| `2xx` | Successful | Request successfully received, understood, and accepted |
| `3xx` | Redirection | Additional action or another location is involved |
| `4xx` | Client Error | The request cannot be fulfilled as submitted |
| `5xx` | Server Error | The server failed while attempting to fulfil an apparently valid request |

The code is part of the machine-readable protocol contract.

A JSON error body can provide richer application information.

For example:

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/order-already-shipped",
  "title": "Order cannot be cancelled",
  "status": 409,
  "detail": "Order ord_123 has already been shipped."
}
```

The HTTP status communicates the broad protocol-level result.

The body communicates domain-specific detail.

---

# 18. Important successful status codes

## 200 OK

The request succeeded and the response contains an appropriate representation of the result.

For a GET:

```http
HTTP/1.1 200 OK

{
  "id": "usr_123"
}
```

For a POST, a `200` response might represent the result of processing.

---

## 201 Created

Use when the request resulted in creation of one or more resources.

For example:

```http
HTTP/1.1 201 Created
Location: /orders/ord_123
```

The `Location` header identifies the primary created resource.

---

## 202 Accepted

The request has been accepted for processing, but processing has not necessarily completed.

This is useful for asynchronous work:

```http
POST /reports
```

```http
HTTP/1.1 202 Accepted
Location: /operations/op_123
```

A critical point:

> `202` does not mean the operation ultimately succeeded.

It means the server accepted responsibility for attempting it.

---

## 204 No Content

The request succeeded and there is no response content to send.

For example:

```http
DELETE /sessions/s_123
```

```http
HTTP/1.1 204 No Content
```

Use `204` rather than returning an empty JSON object merely out of habit.

---

# 19. Important client-error status codes

## 400 Bad Request

The server cannot or will not process the request because of something considered a client error.

Examples include malformed request syntax or other invalid framing/request conditions.

Many APIs also use `400` as a broad application-validation error.

---

## 401 Unauthorized

Despite the historical name, `401` generally means:

> Authentication credentials are missing or invalid.

Think:

```text
Who are you?
I cannot establish an acceptable authenticated identity.
```

---

## 403 Forbidden

The server understood the request but refuses to fulfil it.

Typically:

```text
I know who you are,
but you are not allowed to do this.
```

The distinction between `401` and `403` is therefore approximately:

```text
401 → authentication problem
403 → authorization/refusal problem
```

---

## 404 Not Found

The server did not find a current representation for the target resource, or is unwilling to disclose that one exists.

That latter possibility is useful for security: an API need not reveal the existence of a sensitive resource to an unauthorized caller.

---

## 405 Method Not Allowed

The server recognizes the method, but that method is not allowed for the target resource.

For example:

```http
POST /users/usr_123
```

might receive:

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, PATCH, DELETE
```

Compare this with `501 Not Implemented`, which indicates that the server does not support the method itself.

---

## 409 Conflict

The request conflicts with the current state of the target resource.

For example:

```text
cancel an order that has already shipped
create a username that violates a state-dependent uniqueness rule
perform a transition that is invalid from the current state
```

The important word is **state**.

---

## 412 Precondition Failed

A request included a protocol precondition and that precondition evaluated to false.

Example:

```http
PUT /documents/doc_1
If-Match: "v7"
```

but the current entity tag is:

```text
"v8"
```

The request can fail with:

```http
HTTP/1.1 412 Precondition Failed
```

This is different from a generic domain conflict.

---

## 415 Unsupported Media Type

The server refuses the request because the request content is in a format it does not support for that operation.

Example:

```http
POST /users
Content-Type: application/xml
```

when only JSON is supported.

---

## 422 Unprocessable Content

The server understands the content type and syntax, but cannot process the instructions contained in it.

A common API use is semantically invalid input:

```json
{
  "start_date": "2026-10-10",
  "end_date": "2026-09-01"
}
```

The exact boundary between `400` and `422` is partly an API convention. Consistency matters more than inventing hyper-fine distinctions.

---

# 20. Important server-error status codes

## 500 Internal Server Error

The server encountered an unexpected condition that prevented it from fulfilling the request.

This is the generic server failure.

It should not be used to hide predictable client errors.

---

## 502 Bad Gateway

A server acting as a gateway or proxy received an invalid response from an upstream server.

This often indicates infrastructure or dependency failure.

---

## 503 Service Unavailable

The server is temporarily unable to handle the request.

Possible reasons include:

```text
maintenance
overload
temporary dependency failure
load shedding
```

A `Retry-After` header may tell the client when another attempt could be appropriate.

---

## 504 Gateway Timeout

A gateway or proxy did not receive a timely response from an upstream server.

This is different from an application simply deciding that a business operation took too long.

---

# 21. Do not turn status codes into an enum obsession

It is possible to spend enormous amounts of time debating:

```text
400 vs 409 vs 422
```

That is rarely the most important API-design problem.

A better hierarchy is:

1. Is the broad status class correct?
2. Does the chosen status carry useful standard semantics?
3. Is the API consistent?
4. Does the response body give the consumer enough structured information to act?
5. Will retries, caches, gateways, and generic clients behave correctly?

For example, this is poor:

```http
HTTP/1.1 200 OK

{
  "success": false,
  "error": "user not found"
}
```

The HTTP layer says:

```text
success
```

while the application body says:

```text
failure
```

Generic infrastructure cannot understand the application-specific boolean.

Use the protocol.

---

# 22. Header fields carry metadata and control information

HTTP headers are not miscellaneous strings attached to a request.

They frequently modify or describe protocol semantics.

For example:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer ...
Location: /orders/ord_123
Cache-Control: max-age=60
ETag: "v7"
If-Match: "v7"
If-None-Match: "v7"
Retry-After: 120
```

A useful distinction:

```text
content metadata
request preferences
authentication/authorization metadata
caching metadata
conditional request metadata
routing/proxy metadata
```

Do not invent a custom application field when HTTP already provides the required protocol mechanism.

For example, this:

```json
{
  "response_format": "json"
}
```

is usually inferior to:

```http
Accept: application/json
```

when representation negotiation is genuinely required.

---

# 23. Content-Type answers: "What did I send?"

Suppose a client sends:

```http
POST /users
Content-Type: application/json

{
  "name": "Alice"
}
```

`Content-Type` describes the media type of the request content.

Likewise:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

describes the response content.

A useful rule:

```text
Content-Type → describes this message's content
```

It does not mean:

```text
please send me this format
```

That is the role of `Accept`.

---

# 24. Accept answers: "What representations can I receive?"

A request might say:

```http
GET /reports/123
Accept: application/pdf
```

The client is saying:

> If possible, send me a PDF representation.

Another client might send:

```http
GET /reports/123
Accept: application/json
```

The same resource can therefore be represented differently.

If the server cannot provide any acceptable representation, `406 Not Acceptable` may be appropriate.

In many JSON APIs, content negotiation is deliberately simple:

```text
application/json in
application/json out
```

That is perfectly reasonable.

The important point is to understand the protocol mechanism before deciding not to use its full flexibility.

---

# 25. Content negotiation is another dimension of the contract

Consider:

```text
/report/123
```

The API could expose:

```text
/report/123.json
/report/123.pdf
```

or one resource with negotiated representations:

```http
GET /report/123
Accept: application/json
```

and:

```http
GET /report/123
Accept: application/pdf
```

Neither design is automatically correct.

The important conceptual distinction is:

```text
resource identity
        ≠
representation format
```

Keeping those concepts separate helps when thinking about:

- localisation;
- compression;
- image formats;
- HTML vs JSON;
- API versioned media types;
- downloadable documents.

---

# 26. Caching is part of HTTP semantics

Caching is not merely an optimization added by a CDN.

It is part of the HTTP model.

Suppose:

```http
GET /products/prod_123
```

returns:

```http
HTTP/1.1 200 OK
Cache-Control: max-age=60
Content-Type: application/json

{
  "id": "prod_123",
  "name": "Keyboard"
}
```

A cache can potentially reuse that response for 60 seconds without contacting the origin server again.

```text
first request:

client → cache → origin
                 |
                 v
              response
                 |
client ← cache ←-+

next request while fresh:

client → cache
         |
         v
      response

origin not contacted
```

Benefits include:

- lower latency;
- less network traffic;
- reduced server load;
- improved resilience to temporary origin slowness.

But caching also creates correctness questions.

When is stale data acceptable?

Who is allowed to cache it?

How can a stale response be cheaply validated?

Those questions are part of protocol design.

---

# 27. Fresh and stale responses

A cached response has an **age**.

It also has some **freshness lifetime**.

Conceptually:

```text
age < freshness lifetime
          ↓
        fresh
```

When fresh, the cache can often use the response without contacting the origin.

When:

```text
age >= freshness lifetime
```

the response becomes stale.

Stale does not necessarily mean:

```text
delete these bytes
```

It means the cache generally needs to:

```text
validate them
or
obtain a new response
```

depending on the caching directives and circumstances.

For API designers, explicit freshness is often clearer than relying on heuristic caching.

For example:

```http
Cache-Control: max-age=30
```

says that the response can be considered fresh for 30 seconds according to the relevant caching rules.

---

# 28. Cache-Control

`Cache-Control` carries caching directives.

Examples:

```http
Cache-Control: max-age=60
```

The response has a freshness lifetime of 60 seconds for relevant caches.

```http
Cache-Control: no-store
```

Caches should not store the response.

```http
Cache-Control: no-cache
```

This name is notoriously misleading.

It does **not** mean:

> Never store this.

It means, roughly:

> Do not reuse the stored response without successful validation.

This distinction is worth remembering:

```text
no-store → don't store it
no-cache → validate before reuse
```

There are many additional directives, including rules for shared caches.

We will not attempt to memorize the full caching specification in Week 2.

The goal is to understand the model.

---

# 29. Validators: ETag and Last-Modified

Suppose a server responds:

```http
HTTP/1.1 200 OK
ETag: "user-123-v7"
Content-Type: application/json

{
  "id": "123",
  "name": "Alice"
}
```

The `ETag` is a validator representing a particular version of the selected representation.

Later, the client can ask:

```http
GET /users/123
If-None-Match: "user-123-v7"
```

If that representation is still current, the server can respond:

```http
HTTP/1.1 304 Not Modified
ETag: "user-123-v7"
```

without retransmitting the representation content.

The client can reuse its existing copy.

Conceptually:

```text
client: "I have version v7. Give me the representation
         only if there is something newer."

server: "v7 is still current."
```

`Last-Modified` and date-based conditional fields provide a time-based validation mechanism.

Entity tags are usually more precise because timestamps can have limited granularity and may not map perfectly to representation identity.

---

# 30. Conditional GET

Conditional retrieval combines caching with validators.

Initial request:

```http
GET /users/123
```

Response:

```http
HTTP/1.1 200 OK
ETag: "v7"

{
  "id": "123",
  "name": "Alice"
}
```

Later:

```http
GET /users/123
If-None-Match: "v7"
```

If unchanged:

```http
HTTP/1.1 304 Not Modified
ETag: "v7"
```

If changed:

```http
HTTP/1.1 200 OK
ETag: "v8"

{
  "id": "123",
  "name": "Alice Smith"
}
```

This saves bandwidth and can reduce expensive representation generation.

But conditional requests have another powerful use.

They can protect **writes**.

---

# 31. The lost-update problem

Imagine two users load the same document.

Initial state:

```text
document version = v7
title = "API Course"
```

Alice and Bob both retrieve `v7`.

```text
Alice                         Bob
  |                            |
  | GET                        | GET
  | ← v7                       | ← v7
```

Alice changes the title:

```text
"Advanced API Course"
```

and saves.

The resource becomes:

```text
v8
```

Bob still has his old `v7` copy.

He changes the description and sends the whole document back.

Without concurrency control, Bob might unknowingly overwrite Alice's title.

```text
v7 ---- Alice update ----> v8
 \
  \
   Bob update based on v7 ----> overwrites v8
```

This is the **lost-update problem**.

---

# 32. If-Match as optimistic concurrency control

HTTP can express:

> Apply my write only if the resource still corresponds to the version I read.

Alice originally receives:

```http
ETag: "v7"
```

She sends:

```http
PUT /documents/doc_123
If-Match: "v7"
Content-Type: application/json

{
  "title": "Advanced API Course",
  "description": "..."
}
```

The server sees that `v7` is still current and applies the update.

New version:

```text
v8
```

Bob sends:

```http
PUT /documents/doc_123
If-Match: "v7"
```

But the current version is `v8`.

The precondition fails:

```http
HTTP/1.1 412 Precondition Failed
```

Bob can now retrieve the latest state, reconcile his changes, and retry deliberately.

This is a beautiful example of why understanding HTTP matters.

You did not need to invent:

```json
{
  "expected_database_version": 7
}
```

HTTP already contains a generic precondition mechanism.

---

# 33. If-None-Match can also protect creation

Conditional requests can express other useful constraints.

For example:

```http
PUT /usernames/alice
If-None-Match: *
```

can conceptually mean:

> Perform this request only if the target does not currently have a representation.

That can be useful when creation must not overwrite an existing resource.

Again, HTTP offers a generic protocol mechanism for expressing preconditions.

---

# 34. 304 is not a normal successful representation response

A subtle point:

```http
304 Not Modified
```

does not contain a new representation body.

It tells the client/cache that its existing stored representation remains usable.

Conceptually:

```text
200 → here is the representation
304 → the representation you already have is still valid
```

This is why treating all `3xx` statuses simply as:

```text
redirects
```

is inaccurate.

The first digit defines a broad class, not a complete semantic description.

---

# 35. Location identifies another URI

`Location` is frequently associated with creation.

Example:

```http
POST /orders
```

response:

```http
HTTP/1.1 201 Created
Location: /orders/ord_123
```

This tells the client where the created resource is identified.

`Location` also appears with redirects.

For example:

```http
HTTP/1.1 303 See Other
Location: /operations/op_123/result
```

Headers are meaningful parts of the protocol.

Do not redundantly invent:

```json
{
  "created_resource_url": "/orders/ord_123"
}
```

unless there is an application-level reason to include such a field as well.

---

# 36. Redirects are protocol behaviour

HTTP allows a server to tell a client that further action should occur at another URI.

Common redirect statuses include:

```text
301 Moved Permanently
302 Found
303 See Other
307 Temporary Redirect
308 Permanent Redirect
```

The differences matter, particularly around whether the client should preserve the request method when following the redirect.

For API design, one especially useful pattern is `303 See Other`.

Imagine:

```http
POST /searches
```

The server processes the search and wants the client to retrieve an existing result resource via `GET`.

It may respond:

```http
HTTP/1.1 303 See Other
Location: /search-results/res_123
```

The client can then:

```http
GET /search-results/res_123
```

We will not make redirect minutiae a major part of this course, but students should recognize that redirection is a first-class HTTP concept.

---

# 37. Representation metadata and application semantics are different

Suppose an API returns:

```http
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "v19"
Cache-Control: max-age=30

{
  "id": "ord_123",
  "status": "shipped",
  "tracking_number": "ABC123"
}
```

There are two layers of meaning.

## HTTP-level semantics

```text
200
Content-Type
ETag
Cache-Control
```

These are understood by generic HTTP participants.

## Application-level semantics

```text
order
status = shipped
tracking_number
```

These are understood by your API's consumers.

Good API design composes the two layers.

It does not force the application layer to reinvent everything HTTP already knows how to express.

---

# 38. HTTP semantics affect infrastructure behaviour

Consider two APIs.

### API A

```http
GET /payments/charge?account=123&amount=50
```

### API B

```http
POST /payments

{
  "account": "123",
  "amount": "50.00"
}
```

Suppose some browser optimization prefetches links.

For API A, a generic HTTP system sees:

```text
GET → safe
```

and may reasonably access the URL.

The application sees:

```text
charge £50
```

The protocol semantics and application semantics disagree.

API B correctly communicates that the operation is state changing.

This illustrates a broader principle:

> HTTP methods communicate not only with your application server but also with every HTTP-aware component between and around the client and server.

---

# 39. HTTP does not make a good API automatically

Correct protocol use is necessary but insufficient.

This:

```http
POST /doStuff
```

might be valid HTTP.

This:

```http
POST /database/runProcedure
```

might also be valid HTTP.

HTTP cannot tell you whether those are good domain abstractions.

Likewise:

```http
PUT /users/123
```

could have terrible application semantics even if it uses `PUT` correctly.

Week 1 still applies.

We can think of API quality as several layers:

```text
+----------------------------------+
| Domain and product semantics     |
+----------------------------------+
| API contract                     |
+----------------------------------+
| HTTP semantics                   |
+----------------------------------+
| HTTP transport/framing           |
+----------------------------------+
| TCP/TLS or QUIC                  |
+----------------------------------+
| Network                          |
+----------------------------------+
```

Each layer solves different problems.

---

# 40. Common mistake: "POST everything"

Some APIs use:

```http
POST /getUser
POST /createUser
POST /updateUser
POST /deleteUser
```

This can be made to work.

But you have thrown away useful HTTP semantics.

A proxy can no longer infer that:

```text
getUser
```

is safe.

Caches cannot naturally operate on retrieval.

Generic clients cannot reason about idempotency from the method.

Monitoring systems see four POSTs instead of semantically distinct operations.

The application has replaced standard protocol semantics with custom naming conventions.

Sometimes there are legitimate reasons to use a uniform RPC-over-POST architecture.

But it should be an intentional architectural choice, not the result of never learning what HTTP provides.

---

# 41. Common mistake: treating PUT as "large PATCH"

Imagine:

```http
PUT /users/123

{
  "display_name": "Alice"
}
```

The server interprets omitted fields as:

```text
leave them unchanged
```

That is not faithful to normal PUT semantics.

`PUT` represents the desired replacement state of the target.

If the API wants:

```text
modify only the supplied properties
```

that is partial-update semantics and is better represented using `PATCH` or a clearly defined application operation.

Why does this matter?

Because semantic consistency allows a consumer to reason about an unfamiliar API based on HTTP knowledge.

---

# 42. Common mistake: assuming PATCH is automatically idempotent

Consider:

```http
PATCH /counters/123

{
  "increment": 1
}
```

Apply once:

```text
10 → 11
```

Apply twice:

```text
10 → 11 → 12
```

Not idempotent.

Compare:

```http
PATCH /users/123

{
  "marketing_emails": false
}
```

Apply once:

```text
true → false
```

Apply repeatedly:

```text
false → false
```

This particular operation can be idempotent.

The method alone does not guarantee it.

---

# 43. Common mistake: thinking DELETE must always return the same result

Suppose:

```http
DELETE /users/123
```

returns:

```http
204 No Content
```

A repeated request returns:

```http
404 Not Found
```

Some developers conclude:

> DELETE is not idempotent because the response changed.

That misunderstands idempotency.

The relevant intended effect is:

```text
resource no longer has the previous association/functionality
```

After both requests, that condition holds.

Responses may differ because the server's observed state at the start of each request differed.

---

# 44. Common mistake: custom concurrency fields everywhere

An API might invent:

```json
{
  "id": "doc_123",
  "database_revision_number": 18273
}
```

and require:

```json
{
  "expected_database_revision_number": 18273,
  "update": {
    ...
  }
}
```

Sometimes application-specific versions are appropriate.

But before inventing them, ask whether the problem is simply:

> Only perform this operation if the representation I previously observed is still current.

If so, validators and conditional requests may already express the required contract:

```text
ETag
If-Match
412 Precondition Failed
```

Knowing the protocol expands your design vocabulary.

---

# 45. Common mistake: believing "no-cache" means "do not cache"

Remember:

```http
Cache-Control: no-cache
```

does not mean:

```text
never store this response
```

It means reuse generally requires validation.

If you actually want to prevent storage:

```http
Cache-Control: no-store
```

is the relevant directive.

HTTP contains historical naming that can be unintuitive.

This is one reason learning from specifications and careful references matters.

---

# 46. Designing with protocol semantics

When designing an HTTP operation, ask questions in this order.

## 1. What is the target resource?

```text
/users/usr_123
/orders/ord_123
/reports/rep_123
```

## 2. What is the caller's intention?

```text
retrieve state
replace state
partially modify state
process a command
remove a resource
```

## 3. Which HTTP method communicates that intention?

Do not start with framework decorators.

Start with semantics.

## 4. What is the successful result?

```text
representation returned?
resource created?
work merely accepted?
no content?
```

## 5. What failures can occur?

```text
missing authentication
forbidden operation
missing resource
invalid state transition
failed precondition
unsupported representation
server failure
temporary dependency failure
```

## 6. Can the request be retried?

Ask separately:

```text
Is the method idempotent by definition?
Is this particular operation idempotent?
Do I need an application-level deduplication mechanism?
```

## 7. Can responses be cached?

If yes:

```text
How fresh can they be?
Who may cache them?
How will they be validated?
```

## 8. Could concurrent writers conflict?

If yes, consider:

```text
ETag + If-Match
```

or another explicit concurrency model.

---

# 47. Worked example: profile API

Suppose a user profile is identified by:

```text
/profiles/usr_123
```

### Retrieve it

```http
GET /profiles/usr_123
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
ETag: "p7"
Cache-Control: private, max-age=30

{
  "display_name": "Alice",
  "timezone": "Europe/London"
}
```

### Replace it

```http
PUT /profiles/usr_123
If-Match: "p7"
Content-Type: application/json

{
  "display_name": "Alice Smith",
  "timezone": "Europe/London"
}
```

Possible response:

```http
HTTP/1.1 204 No Content
ETag: "p8"
```

### Concurrent write

Another client still has:

```text
p7
```

and sends:

```http
PUT /profiles/usr_123
If-Match: "p7"
```

The server now has `p8`:

```http
HTTP/1.1 412 Precondition Failed
```

### Revalidate cached state

```http
GET /profiles/usr_123
If-None-Match: "p8"
```

If unchanged:

```http
HTTP/1.1 304 Not Modified
ETag: "p8"
```

Several parts of HTTP cooperate here:

```text
GET          retrieval semantics
PUT          replacement semantics
ETag         representation validator
If-Match     write precondition
If-None-Match cache validation
412          failed write precondition
304          existing cached representation still current
Cache-Control freshness policy
```

This is what it means to use HTTP as a protocol rather than merely as a tunnel.

---

# 48. Worked example: asynchronous report generation

Suppose generating a report takes ten minutes.

A poor design might leave:

```http
POST /generateReport
```

open for ten minutes.

A better API might model the asynchronous work explicitly.

Request:

```http
POST /reports

{
  "type": "annual",
  "year": 2025
}
```

Response:

```http
HTTP/1.1 202 Accepted
Location: /operations/op_918
```

The client can retrieve the operation:

```http
GET /operations/op_918
```

```json
{
  "id": "op_918",
  "status": "running"
}
```

Later:

```json
{
  "id": "op_918",
  "status": "succeeded",
  "result": "/reports/rep_712"
}
```

This design uses:

```text
202 → work accepted, not completed
Location → URI for another relevant resource
GET → safe polling
resource model → operation exists independently of connection lifetime
```

HTTP gives you the protocol pieces.

The API still has to choose the application model.

---

# 49. Exercise 1 — Read the protocol, not the endpoint name

Consider the following API operations:

```http
GET /orders/123
```

```http
GET /orders/123/cancel
```

```http
PUT /profiles/usr_1
```

```http
POST /reports
```

```http
DELETE /sessions/s_91
```

```http
PATCH /counters/hits

{
  "increment": 1
}
```

For each operation:

1. Is the method safe by definition?
2. Is the method idempotent by definition?
3. Is the application-level operation as shown actually consistent with the method semantics?
4. Would an automated retry be obviously safe?
5. Identify any operation you would redesign and explain why.

### Discussion prompts

Pay particular attention to:

```text
GET /orders/123/cancel
```

and:

```text
PATCH /counters/hits
```

The first conflicts with GET's safety semantics.

The second demonstrates that PATCH is not automatically idempotent.

---

# 50. Exercise 2 — POST or PUT?

For each scenario, choose between `POST` and `PUT` and justify your answer from HTTP semantics.

### A

The client wants to create a new invoice, and the server will choose its identifier.

### B

The client wants to upload the complete contents of:

```text
/documents/doc_123
```

and replace the current contents.

### C

The client generates UUIDs itself and wants to create:

```text
/widgets/0dd13285-...
```

at a known URI.

### D

The client submits a search query to:

```text
/search
```

and receives computed results.

### E

The client wants to set the complete preferences representation for:

```text
/users/usr_1/preferences
```

Then answer:

> Why is "POST = create, PUT = update" insufficient to solve this exercise?

---

# 51. Exercise 3 — Status-code design

Choose an HTTP status code for each scenario and explain what protocol meaning you want the client to infer.

1. A new order was created successfully and is available at `/orders/ord_91`.
2. A report request has been accepted but processing will take several minutes.
3. A session was successfully deleted and there is nothing useful to return.
4. The caller has no valid authentication credentials.
5. The caller is authenticated but cannot access this account.
6. `/users/abc` does not identify a visible resource.
7. The caller tries to cancel an order that has already shipped.
8. A `PUT` contains `If-Match: "v7"`, but the resource is now `"v8"`.
9. The request body is XML but the operation only accepts JSON.
10. The application crashes unexpectedly while processing a valid request.

For each answer, also state:

> What structured application-level information should accompany the status code, if any?

---

# 52. Exercise 4 — Representation and content negotiation

You are designing an API for university transcripts.

The resource:

```text
/transcripts/student_123
```

can be represented as:

```text
JSON for applications
PDF for humans
```

Design requests and responses for:

1. retrieving the JSON representation;
2. retrieving the PDF representation;
3. a request that asks for `image/png`, which the server does not support.

Then answer:

- What is the resource?
- What is the representation?
- Why should representation format not automatically become part of the domain model?
- Would you prefer content negotiation or separate `.json` / `.pdf` URIs here? Defend either answer.

There is no single required architecture for the final question.

The goal is to reason clearly about resource identity and representation format.

---

# 53. Exercise 5 — Cache and validate

An endpoint returns:

```http
HTTP/1.1 200 OK
Cache-Control: max-age=60
ETag: "products-v14"
Content-Type: application/json
```

The client receives the response at:

```text
12:00:00
```

Answer:

### A

At `12:00:30`, can a compliant cache normally reuse the response without contacting the origin?

### B

At `12:02:00`, the cache wants to reuse the response. Construct a conditional request using the entity tag.

### C

The server's current representation is still `"products-v14"`. Construct the response.

### D

The server's representation is now `"products-v15"`. What should happen?

### E

How would the behaviour differ conceptually if the response said:

```http
Cache-Control: no-cache
```

instead of:

```http
Cache-Control: max-age=60
```

### F

How would it differ if it said:

```http
Cache-Control: no-store
```

Explain the answers rather than merely naming directives.

---

# 54. Exercise 6 — Prevent the lost update

A document initially has:

```text
ETag: "v11"
```

Alice and Bob both retrieve it.

Alice changes the title and successfully saves her version.

The server now reports:

```text
ETag: "v12"
```

Bob edits a different field, but his changes are based on the old `v11` representation.

### Part A

Draw the request sequence that causes Alice's update to be lost if no concurrency protection exists.

### Part B

Redesign the write protocol using:

```text
ETag
If-Match
412 Precondition Failed
```

### Part C

What should Bob's client do after receiving the failed precondition?

### Part D

Why would this response be more precise than a generic:

```http
409 Conflict
```

for this particular failure?

### Part E

Now assume Bob's request reached the server and succeeded, but the network connection disappeared before he received the response.

If the operation used `PUT`, what does idempotency allow Bob's client to reason about?

What uncertainty still remains?

This final part deliberately combines conditional requests with retry semantics.

---

# 55. Practical lab — inspect HTTP with curl

Use a real HTTP server or a local application.

Do not use a browser for the entire exercise.

Use `curl` so that request and response metadata are visible.

Useful commands include:

```bash
curl -i https://example.com
```

```bash
curl -I https://example.com
```

```bash
curl -v https://example.com
```

For a local API, experiment with:

```bash
curl -i http://localhost:8000/users/123
```

```bash
curl -i -X OPTIONS http://localhost:8000/users/123
```

```bash
curl -i \
  -H 'Accept: application/json' \
  http://localhost:8000/users/123
```

If your server supports validators, capture an `ETag` and then issue:

```bash
curl -i \
  -H 'If-None-Match: "the-etag-value"' \
  http://localhost:8000/users/123
```

Try to observe:

```text
method
status
request headers
response headers
content type
content length
cache metadata
validators
redirects
```

The goal is to make HTTP visible rather than letting a framework hide it.

---

# 56. API review questions for HTTP

When reviewing an HTTP API, ask:

## Resource

- What resource does this URI identify?
- Is the API manipulating a domain concept or leaking an implementation detail?
- Is the representation being confused with the resource itself?

## Method

- What intention is the caller expressing?
- Does the method communicate that intention correctly?
- Is the operation safe?
- Is it idempotent?
- What assumptions could generic infrastructure make?

## Response

- Does the status code accurately represent the result?
- Is important application detail represented structurally in the response?
- Are protocol failures and business failures distinguishable?

## Representation

- What does `Content-Type` describe?
- Does the client need content negotiation?
- Is the same resource available in multiple representations?

## Reliability

- What happens if the response is lost?
- Can the client retry?
- Could the operation execute twice?
- Does the API require application-level idempotency?

## Caching

- Can this representation be reused?
- How long is it fresh?
- Who is allowed to cache it?
- Can it be efficiently validated?

## Concurrency

- Can two clients overwrite each other's work?
- Can the API expose a validator?
- Would `If-Match` express the required precondition?

---

# 57. Key ideas

This chapter introduced the protocol vocabulary on which later API design will build.

## 1. HTTP has semantics

Methods, status codes, headers, caching, validators, and conditional requests are not decorative conventions.

They form a shared protocol contract.

## 2. Semantics are separate from wire format

HTTP/1.1, HTTP/2, and HTTP/3 transport messages differently while preserving core HTTP semantics.

## 3. HTTP acts on resources through representations

A URI identifies a resource.

The message content transfers or describes a representation.

Do not conflate the two.

## 4. Methods express intent

`GET`, `POST`, `PUT`, `PATCH`, and `DELETE` should not be treated merely as framework routing categories.

## 5. Safe and idempotent are different

Safe means the caller does not request a state change.

Idempotent means repeating the same request has the same intended effect as issuing it once.

## 6. Idempotency matters because networks fail ambiguously

No response does not imply no execution.

Retry behaviour has to be designed deliberately.

## 7. Status codes are machine-readable protocol semantics

Do not return `200 OK` for every outcome and recreate HTTP status inside JSON.

## 8. Representations have metadata

`Content-Type` describes content.

`Accept` expresses representation preferences.

## 9. Caching is part of HTTP

Freshness and validation are part of the protocol, not merely CDN implementation details.

## 10. Validators are useful for both reads and writes

`ETag` plus `If-None-Match` enables efficient validation.

`ETag` plus `If-Match` can prevent lost updates.

## 11. Correct HTTP does not guarantee a good API

HTTP gives you protocol semantics.

You still have to design good domain resources, application contracts, errors, and evolution strategies.

---

# 58. Suggested reading

## Required

### RFC 9110 — HTTP Semantics

Read selectively rather than cover-to-cover.

Focus on:

- Section 3 — Terminology and Core Concepts
- Section 6 — Message Abstraction
- Section 8 — Representation Data and Metadata
- Section 9 — Methods
- Section 12 — Content Negotiation
- Section 13 — Conditional Requests
- Section 15 — Status Codes

https://www.rfc-editor.org/rfc/rfc9110.html

### RFC 9111 — HTTP Caching

Focus on:

- Section 3 — Storing Responses in Caches
- Section 4 — Constructing Responses from Caches
- Section 4.2 — Freshness
- Section 4.3 — Validation
- Section 5.2 — Cache-Control

https://www.rfc-editor.org/rfc/rfc9111.html

### RFC 5789 — PATCH Method for HTTP

Focus on:

- why `PATCH` exists separately from `PUT`;
- patch-document semantics;
- atomic application of a patch;
- discovery through `Accept-Patch`.

https://www.rfc-editor.org/rfc/rfc5789.html

---

## Recommended

### MDN — HTTP

MDN is a useful secondary reference when an RFC section is too dense for a first pass.

Use it to reinforce concepts, not as a replacement for understanding the normative semantics.

https://developer.mozilla.org/en-US/docs/Web/HTTP

### RFC 9457 — Problem Details for HTTP APIs

This will become more important in the later week on failure and error design, but it is worth seeing how application-specific failures can be represented while preserving HTTP status semantics.

https://www.rfc-editor.org/rfc/rfc9457.html

---

# Closing thought

A weak mental model of HTTP is:

```text
send JSON to a backend
```

A stronger model is:

```text
client expresses an intention
        |
        v
HTTP communicates standardized semantics
        |
        v
target resource interprets that intention
        |
        v
server communicates the result
```

HTTP already answers many questions that API designers otherwise end up reinventing:

```text
Is this retrieval safe?

Can this operation be retried?

Has this representation changed?

May this response be reused?

Only perform this write if the resource is still the version I read.

Where is the resource that was just created?

Was the work completed or merely accepted?
```

The goal is not to use every feature HTTP offers.

The goal is to understand the protocol well enough that when you choose to use — or deliberately not use — one of those features, you are making an informed API design decision rather than accidentally creating a second, poorer protocol inside HTTP.
