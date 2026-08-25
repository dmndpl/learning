# Week 1 — APIs as Contracts

## Learning objectives

By the end of this chapter, you should be able to:

* explain what an API is beyond the context of HTTP or REST;
* distinguish an API's contract from its implementation;
* identify the assumptions an API creates for its consumers;
* recognise accidental coupling between an API and its implementation;
* distinguish internal, partner, and public APIs;
* reason about API boundaries using domain concepts rather than storage structures;
* evaluate an API from the perspective of the consumer rather than the producer;
* understand why API design is primarily an exercise in managing change.

---

## 1. An API is an agreement

The phrase **Application Programming Interface** is easy to reduce to something mechanical.

A frontend sends:

```http
GET /users/123
```

and a backend returns:

```json
{
  "id": 123,
  "name": "Alice"
}
```

It is tempting to say that this endpoint *is* the API.

It is not.

The endpoint is merely one manifestation of a broader agreement between two pieces of software.

The real API includes assumptions such as:

* `/users/123` continues to refer to the same conceptual thing;
* `GET` does not modify that user;
* a successful request returns a representation of the user;
* the `id` field identifies the user;
* `name` means roughly the same thing tomorrow as it does today;
* callers can rely on some defined set of errors;
* existing behaviour will not suddenly change without warning.

An API therefore exists wherever one piece of software depends on another through a defined interface.

That might be:

```python
user = repository.get_user(user_id)
```

a shared library:

```python
result = calculate_risk(portfolio)
```

a REST API:

```http
GET /portfolios/{portfolio_id}/risk
```

an RPC:

```protobuf
rpc CalculateRisk(CalculateRiskRequest)
    returns (CalculateRiskResponse);
```

or even an event:

```json
{
  "type": "invoice.paid",
  "invoice_id": "inv_9382"
}
```

The transport differs.

The central idea does not:

> **An API is a contract between a provider and a consumer.**

The word *contract* is useful because the provider is making promises and the consumer is building software around those promises.

Once consumers depend on those promises, changing them has consequences.

---

# 2. Interface versus implementation

Consider the following Python function:

```python
def get_balance(account_id: str) -> Decimal:
    ...
```

A caller might depend on:

* the function name;
* its argument type;
* its return type;
* what `balance` represents;
* what errors can occur;
* whether the function has side effects.

The caller normally does not need to know whether the implementation uses:

* PostgreSQL;
* Redis;
* an external banking provider;
* an in-memory dictionary;
* another service;
* a CSV file.

That distinction is fundamental.

We can think of a system as:

```text
consumer
    |
    v
+------------------+
|       API        |
+------------------+
         |
         v
+------------------+
| implementation   |
+------------------+
```

The API is the boundary.

The implementation is what happens behind the boundary.

A good boundary allows the implementation to change without requiring consumers to change.

For example, imagine:

```http
GET /accounts/acc_123/balance
```

Initially, the backend reads from PostgreSQL.

Later, the company moves account balances into a distributed ledger system.

If consumers do not need to change, the API has successfully insulated them from that implementation decision.

This is one of the most important properties of an API:

> **The interface should expose what consumers need while hiding implementation details they do not need.**

---

# 3. Why implementation leakage is dangerous

Suppose a service exposes this API:

```http
POST /database/updateCustomerRow
```

with:

```json
{
  "table": "customer_accounts",
  "primary_key": 812,
  "column": "is_disabled",
  "value": true
}
```

Technically, this works.

A client can disable a customer.

But the API has exposed an enormous amount of implementation detail.

The caller now knows that:

* there is a relational database;
* a table is called `customer_accounts`;
* customers are stored as rows;
* customers use numeric primary keys;
* account state is represented by a boolean column;
* disabling an account means changing that column.

The database schema has effectively become the API.

Now imagine that the backend changes.

Perhaps:

```text
customer_accounts
```

is split into:

```text
customers
account_status
account_permissions
```

or perhaps account state becomes:

```text
ACTIVE
SUSPENDED
DELETED
PENDING_REVIEW
```

instead of:

```text
is_disabled = true | false
```

The internal implementation has changed, but because implementation details leaked into the interface, every consumer may now need modification.

Contrast this with:

```http
POST /customers/812/suspensions
```

or possibly:

```http
PATCH /customers/812
```

```json
{
  "status": "suspended"
}
```

The client now communicates in concepts belonging to the business domain:

* customer;
* suspension;
* status.

Those concepts may survive even if the implementation changes radically.

This gives us our first major design principle:

> **Expose domain semantics, not storage mechanics.**

---

# 4. The API is not your database schema

One of the easiest mistakes in backend development is to start with the database.

Suppose we have:

```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    password_hash TEXT,
    created_at TIMESTAMP,
    deleted_at TIMESTAMP
);
```

A framework might make it easy to expose:

```http
GET /users/123
```

returning:

```json
{
  "user_id": 123,
  "first_name": "Alice",
  "last_name": "Smith",
  "password_hash": "$argon2id$...",
  "created_at": "2026-08-22T12:34:52Z",
  "deleted_at": null
}
```

But the fact that data exists in the persistence model does not mean it belongs in the API.

The database model answers questions such as:

> What data must the service store?

The API model answers a different question:

> What information and operations should consumers be allowed to depend on?

Those models may overlap substantially.

They should not automatically be identical.

A better public representation might be:

```json
{
  "id": "usr_a7f3d",
  "name": {
    "given": "Alice",
    "family": "Smith"
  },
  "created_at": "2026-08-22T12:34:52Z"
}
```

The consumer does not need:

```text
password_hash
deleted_at
database primary key structure
```

Likewise, the API may expose values that do not exist directly in any table:

```json
{
  "display_name": "Alice Smith",
  "membership_status": "active"
}
```

They may be calculated from several internal structures.

The API and persistence layers serve different purposes.

Treating them as identical is convenient initially and expensive later.

---

# 5. APIs create dependencies

Consider this response:

```json
{
  "id": 42,
  "status": "active"
}
```

The provider might think:

> We only return two fields. This is simple.

But consumers may quickly write:

```typescript
if (user.status === "active") {
    showDashboard();
}
```

or:

```typescript
const userById = new Map<number, User>();
```

or:

```typescript
const cacheKey = `user:${user.id}`;
```

Those choices create dependencies on:

* `status` existing;
* `"active"` being a valid value;
* `id` being numeric;
* `id` being stable;
* `id` being unique;
* the conceptual meaning of a user remaining stable.

The provider may never have explicitly said:

> IDs will always be integers.

Yet if every response uses integers, clients may reasonably infer that they are.

This is an important point:

> **Consumers depend not only on what you intend to promise, but often on what you consistently expose.**

That means every externally visible behaviour deserves consideration.

Sometimes even behaviour you consider accidental can become part of the effective contract.

---

# 6. Hyrum's Law

A useful observation in API design is commonly known as **Hyrum's Law**:

> With enough users of an API, every observable behaviour will eventually be depended on by somebody.

Consider an API returning objects in this order:

```json
[
  {"name": "Alice"},
  {"name": "Bob"},
  {"name": "Charlie"}
]
```

The API documentation says nothing about ordering.

Internally, the database happens to return rows alphabetically.

Someone writes a frontend assuming alphabetical order.

Two years later, a database migration changes the query plan and the response becomes:

```json
[
  {"name": "Charlie"},
  {"name": "Alice"},
  {"name": "Bob"}
]
```

The API technically did not violate its documented contract.

The application still breaks.

This does not mean APIs must preserve every accidental behaviour forever.

It means designers should be aware of observable behaviour and explicitly define important semantics where possible.

If order is meaningful, say so.

If order is not meaningful, clients should be encouraged not to rely on it.

---

# 7. Producer thinking versus consumer thinking

API designers naturally think like producers.

A backend engineer might think:

> I have a `users` table. I need an endpoint to retrieve rows from it.

A consumer thinks differently:

> I need to display the person responsible for this invoice.

Those perspectives can lead to very different interfaces.

Consider an invoicing system.

The backend may contain:

```text
users
organisations
organisation_members
invoices
invoice_recipients
payment_methods
payment_attempts
```

A frontend developer building an invoice page may simply need:

```http
GET /invoices/inv_123
```

with:

```json
{
  "id": "inv_123",
  "recipient": {
    "name": "Alice Smith",
    "email": "alice@example.com"
  },
  "amount": {
    "currency": "GBP",
    "value": "120.00"
  },
  "status": "outstanding"
}
```

The consumer should not necessarily need to reconstruct this view through knowledge of six backend tables.

Good API design asks:

> What concept is the consumer actually trying to work with?

This does **not** mean creating custom endpoints for every screen.

That produces a different type of coupling.

The goal is to expose stable domain concepts at an appropriate level of abstraction.

---

# 8. Contracts have syntax and semantics

When engineers hear the word *contract*, they often think only about schemas.

For example:

```typescript
interface User {
    id: string;
    status: string;
}
```

This describes part of the contract.

But it describes mostly **syntax**.

It tells us:

```text
id is a string
status is a string
```

It does not tell us:

* whether `id` is stable;
* whether two users can have the same ID;
* which values `status` may contain;
* whether status can move from `deleted` back to `active`;
* whether retrieving the user has side effects;
* how quickly changes become visible;
* whether deleting a user permanently removes them;
* whether a user may disappear from subsequent requests.

These are semantic properties.

For example:

```http
DELETE /users/123
```

does not tell us what *delete* means.

Possible semantics include:

### Hard deletion

The data is permanently removed.

### Soft deletion

The record remains internally but is hidden.

### Deactivation

The account stops being usable but remains visible.

### Scheduled deletion

Deletion occurs after 30 days.

### Compliance anonymisation

Personally identifiable information is erased, but transactional history remains.

The HTTP request alone does not answer this.

The API contract must.

---

# 9. Contracts exist at multiple levels

A useful way to think about API contracts is as several nested layers.

## 9.1 Structural contract

What shape does the data have?

```json
{
  "id": "ord_123",
  "total": "42.50"
}
```

Questions include:

* which fields exist?
* what types do they have?
* which are optional?
* which are nullable?

---

## 9.2 Behavioural contract

What happens when I perform an operation?

For example:

```http
POST /orders
```

Does this:

* immediately create an order?
* reserve inventory?
* charge a payment method?
* send a confirmation email?

---

## 9.3 Error contract

What happens when something goes wrong?

Possible answers:

```text
400 invalid request
401 unauthenticated
403 unauthorized
409 conflicting state
429 rate limited
500 server failure
```

But the contract should ideally include structured information beyond a status code.

---

## 9.4 Temporal contract

When do changes become visible?

If:

```http
PATCH /users/123
```

returns success, does:

```http
GET /users/123
```

immediately return the new value?

In a distributed system, this is not always guaranteed.

---

## 9.5 Compatibility contract

What changes can consumers expect?

Can the provider:

* add new fields?
* add new enum values?
* change ordering?
* remove deprecated fields?
* change error messages?
* change an identifier format?

Compatibility rules are themselves part of the API contract.

---

## 9.6 Operational contract

What performance and availability should consumers expect?

For example:

```text
99.95% availability
P95 latency under 300 ms
maximum 100 requests/second
maximum response size 5 MB
```

Not every API formally guarantees these properties, but serious consumers often need them.

---

# 10. Internal APIs are still APIs

A common belief is:

> We don't need to worry about API design because this is an internal service.

This usually works until the service becomes important.

Imagine:

```text
Service A
   |
   +---- Service B
   |
   +---- Service C
   |
   +---- Service D
```

Initially, Service A is a small internal component.

Over several years, fifteen other systems begin calling it.

The team responsible for Service A now wants to refactor it.

They discover that every consumer depends on:

* undocumented fields;
* strange error behaviour;
* response ordering;
* internal IDs;
* implementation-specific status codes.

The fact that consumers work at the same company does not remove coupling.

In some organisations, internal APIs have **more consumers than public APIs**.

The difference is mainly governance.

An internal API may allow:

* faster deprecation;
* coordinated migrations;
* tighter version control;
* stronger assumptions about client technology.

But contract thinking still applies.

---

# 11. Public, partner, and internal APIs

It is useful to distinguish several categories.

## Internal API

Used within one organisation.

Examples:

```text
frontend → backend
service → service
data pipeline → metadata service
```

You often control both producer and consumers.

This allows coordinated evolution.

---

## Partner API

Used by trusted external organisations.

For example:

```text
bank ↔ payment provider
retailer ↔ logistics provider
hospital ↔ insurance provider
```

The provider does not fully control consumers, but relationships may include contracts, support channels and coordinated releases.

---

## Public API

Available to arbitrary external developers.

Examples include APIs from:

```text
Stripe
GitHub
Twilio
Google Maps
AWS
```

The provider often has no idea how many applications depend on any particular behaviour.

Public APIs therefore usually require the strongest compatibility discipline.

---

# 12. The blast radius of change

Imagine you own this function:

```python
def calculate_total(items):
    ...
```

and only one file calls it.

Changing the function may require changing one caller.

Now imagine:

```text
calculate_total
```

is part of a shared package used by 20 repositories.

Changing it becomes harder.

Now imagine it is exposed as a public API used by 50,000 customers.

The same conceptual change now has a dramatically larger blast radius.

This leads to a useful relationship:

```text
cost of change
    ∝
number of consumers
    ×
lack of consumer control
    ×
strength of dependency
```

The more consumers you have, and the less control you have over them, the more careful you must be about contracts.

This is one reason successful APIs often appear conservative.

Stability is valuable.

---

# 13. API boundaries and coupling

Every interface creates coupling.

The goal is not to eliminate coupling.

That is impossible.

If a client calls:

```http
GET /weather/london
```

it necessarily depends on something.

The goal is to create **intentional coupling**.

Good coupling:

> The client depends on the fact that invoices have a payment status.

Bad coupling:

> The client depends on the fact that payment status is stored in column 17 of a particular table.

Good coupling:

> The client depends on stable user IDs.

Bad coupling:

> The client assumes those IDs are monotonically increasing PostgreSQL sequences.

Good coupling:

> The client depends on an order having a creation timestamp.

Bad coupling:

> The client assumes timestamps are generated by the database server in a particular timezone.

The challenge of abstraction is deciding which information belongs in the contract and which does not.

---

# 14. An API is an abstraction boundary

Abstraction is sometimes taught as simply “hiding complexity.”

That is incomplete.

Good abstractions do more than hide things.

They provide a **stable conceptual model**.

Consider file systems.

Applications generally deal with concepts such as:

```text
file
directory
path
read
write
delete
```

Behind those concepts may be:

```text
SSDs
network storage
block allocation
journaling
caches
replication
permissions
inode tables
```

The file-system interface provides a useful model while hiding unnecessary implementation machinery.

Good APIs serve a similar purpose.

They allow consumers to reason using concepts such as:

```text
customer
invoice
payment
shipment
subscription
portfolio
position
order
```

instead of:

```text
database row
message queue topic
cache entry
microservice
worker process
storage shard
```

The latter concepts may matter to the implementation.

They often should not matter to the consumer.

---

# 15. The danger of thin database wrappers

Consider an automatically generated API:

```http
GET /users
GET /users/{id}

GET /orders
GET /orders/{id}

GET /order_items
GET /order_items/{id}

GET /payments
GET /payments/{id}
```

At first glance this looks clean.

Every table becomes a resource.

But imagine retrieving an order requires:

```text
GET /orders/123
GET /order_items?order_id=123
GET /payments?order_id=123
GET /users/42
```

The consumer now understands your relational model.

Suppose the backend later merges:

```text
orders
order_items
```

into a document store.

You cannot simply remove the old concepts because consumers already depend on them.

The API has frozen your persistence design into your architecture.

This is why API design should normally begin with:

> What concepts does the domain expose?

not:

> What tables exist?

---

# 16. Domain language matters

Imagine a fitness application.

The database contains:

```text
users
exercise_instances
activity_sessions
metrics
metric_values
```

But users and coaches may think in terms of:

```text
athletes
workouts
exercises
sets
reps
personal records
training plans
```

The API should usually reflect the language of the domain.

For example:

```http
GET /athletes/{id}/workouts
```

communicates intent much more effectively than:

```http
GET /activity_sessions?user_fk=123
```

The latter exposes implementation vocabulary.

The former exposes domain vocabulary.

This connects API design to **domain-driven design**.

You do not need full DDD methodology to benefit from one of its most important ideas:

> Software interfaces should reflect the language people use when talking about the problem.

A good API often feels unsurprising because its vocabulary matches the domain.

---

# 17. API design is organisational design

Consider an organisation containing:

```text
Identity Team
Payments Team
Orders Team
Shipping Team
```

Its APIs might naturally become:

```text
Identity API
Payments API
Orders API
Shipping API
```

This is not accidental.

Software boundaries often follow organisational boundaries.

This observation is commonly associated with **Conway's Law**:

> Organisations tend to design systems whose structure mirrors their communication structure.

Suppose a single API requires every request to coordinate synchronously across five teams.

That may indicate that the technical boundary is fighting the organisational boundary.

Conversely, if every small team exposes fifteen tiny APIs simply because each owns different database tables, the system may become unnecessarily fragmented.

API architecture therefore involves both:

```text
domain boundaries
```

and:

```text
ownership boundaries
```

A good interface should have a clear answer to:

> Who is responsible for the behaviour behind this API?

---

# 18. API as product

Even an internal API has users.

Those users are developers.

This means API quality includes **developer experience**.

Suppose two services offer equivalent capabilities.

API A:

```http
POST /v1/customer
```

```json
{
  "fn": "Alice",
  "ln": "Smith",
  "acct_typ": 3
}
```

On failure:

```json
{
  "error": "invalid"
}
```

API B:

```http
POST /v1/customers
```

```json
{
  "name": {
    "given": "Alice",
    "family": "Smith"
  },
  "account_type": "business"
}
```

On failure:

```json
{
  "type": "validation_error",
  "message": "The request contains invalid fields.",
  "errors": [
    {
      "field": "account_type",
      "code": "unsupported_value"
    }
  ]
}
```

The difference is not merely aesthetics.

API B reduces:

* debugging time;
* integration mistakes;
* support requests;
* interpretation ambiguity;
* client-side defensive code.

Developer experience has economic value.

---

# 19. The principle of least surprise

Good APIs are often boring.

That is a compliment.

If an endpoint looks like:

```http
GET /users/123
```

developers will bring expectations with them.

They probably expect:

* the request to retrieve information;
* the operation not to change the user;
* repeated requests to be safe;
* `404` if the user does not exist.

Imagine instead that requesting a user marks them as "viewed":

```http
GET /users/123
```

and causes:

```text
last_viewed_at = now()
```

The interface technically works.

But it violates normal expectations.

Surprising interfaces require additional knowledge.

Additional knowledge creates additional cognitive load and additional ways to make mistakes.

A useful API-design heuristic is:

> When established conventions express your intended semantics well, follow them.

Breaking conventions can be justified.

It should be intentional.

---

# 20. Design for misuse

Suppose an API exposes:

```http
POST /transfer
```

```json
{
  "from_account": "A",
  "to_account": "B",
  "amount": 1000
}
```

A designer might ask:

> Can a legitimate client execute a transfer?

A stronger question is:

> In what ways can a client accidentally misuse this interface?

For example:

* What if the amount is negative?
* What if both account IDs are identical?
* What if the client sends the request twice?
* What if the response times out after the transfer succeeds?
* What if currency is omitted?
* What if account A holds GBP and account B holds EUR?
* What if the client retries automatically?

Good API design is partly about making incorrect behaviour harder.

This idea appears in programming-language design as:

> Make illegal states unrepresentable.

APIs cannot always achieve that fully, but they should move in that direction.

For example, compare:

```json
{
  "amount": 100
}
```

with:

```json
{
  "amount": {
    "currency": "GBP",
    "value": "100.00"
  }
}
```

The second representation carries more semantics and makes some classes of mistakes harder.

---

# 21. APIs and trust

Consumers make decisions based on how much they trust an API.

Imagine an undocumented internal endpoint:

```http
GET /internal/data
```

A developer may hesitate to build a critical system on it because they do not know:

* whether it is supported;
* whether it will disappear;
* who owns it;
* what stability guarantees exist.

Contrast that with an API that has:

```text
clear ownership
versioned documentation
compatibility guarantees
defined errors
service-level objectives
deprecation policies
```

The second API becomes infrastructure.

This illustrates something subtle:

> API quality is not only technical. It is institutional.

Consumers need confidence that the provider will honour the contract.

---

# 22. Contract strength

Not every API needs the same level of rigidity.

Consider three situations.

### Situation A

A function used inside one file:

```python
_parse_internal_header(...)
```

Changing it is cheap.

---

### Situation B

An internal service used by ten teams.

Changing it requires coordination.

---

### Situation C

A public payments API used by thousands of businesses.

Changing it may break checkout flows across the internet.

The appropriate design discipline increases from A to C.

You can think of APIs as existing on a spectrum:

```text
local implementation detail
        |
        |
internal abstraction
        |
        |
shared service
        |
        |
partner API
        |
        |
public API
```

The further downward you move, the more expensive breaking changes become.

---

# 23. What constitutes a breaking change?

Suppose an API returns:

```json
{
  "id": "u123",
  "name": "Alice"
}
```

Consider the following changes.

### Change A

Add:

```json
{
  "email": "alice@example.com"
}
```

Usually compatible.

But only if consumers tolerate unknown fields.

---

### Change B

Rename:

```text
name
```

to:

```text
display_name
```

Almost certainly breaking.

---

### Change C

Change:

```text
id: string
```

to:

```text
id: number
```

Breaking.

---

### Change D

Keep the type but change the meaning of:

```text
name
```

from:

> legal name

to:

> preferred display name

Potentially breaking even though the schema did not change.

This is an important lesson:

> **Compatibility is semantic, not merely structural.**

Schema diff tools can detect many compatibility issues.

They cannot understand every semantic one.

---

# 24. Consumer-driven thinking

A useful design technique is to begin from consumer tasks.

Instead of:

> We need endpoints for the `subscriptions` table.

Ask:

> What does a consumer need to accomplish?

For a subscription platform:

```text
start a subscription
inspect a subscription
change a plan
pause a subscription
cancel a subscription
resume a subscription
view upcoming billing
```

Then ask:

> What concepts should exist in the API so those tasks can be expressed clearly?

You may end up with:

```text
subscriptions
plans
invoices
payment methods
cancellations
```

The exact answer varies.

What matters is the direction of reasoning:

```text
consumer need
    ↓
domain concept
    ↓
API model
    ↓
implementation
```

rather than:

```text
database table
    ↓
endpoint
```

---

# 25. Case study: a badly coupled API

Suppose a university builds this endpoint:

```http
POST /sql/updateStudent
```

```json
{
  "student_row_id": 7381,
  "updates": {
    "programme_fk": 18,
    "registration_state": 2
  }
}
```

A client needs external knowledge to understand:

```text
programme_fk = 18
registration_state = 2
```

Perhaps:

```text
2 = REGISTERED
```

but this information lives elsewhere.

Now imagine a redesigned interface:

```http
PATCH /students/stu_7381
```

```json
{
  "programme": "computer-science",
  "registration_status": "registered"
}
```

This is better, but there are still questions.

Can students switch programme simply by changing this field?

Perhaps changing programme actually requires:

* approval;
* eligibility checks;
* fee recalculation;
* visa checks;
* timetable validation.

In that case:

```http
POST /students/stu_7381/programme-transfers
```

may represent the domain more accurately.

This illustrates why API design cannot be reduced to endpoint naming conventions.

You first need to understand the operation's meaning.

---

# 26. Resources versus operations

A common REST guideline is:

> URLs should contain nouns, not verbs.

This is useful, but incomplete.

Consider:

```http
POST /users/123/ban
```

The word `ban` looks like a verb.

Some designers may mechanically replace it with:

```http
PATCH /users/123
```

```json
{
  "status": "banned"
}
```

But what if banning a user has rich semantics?

It might involve:

```text
reason
moderator
start time
expiry time
appeal status
audit trail
```

Then perhaps **a ban is itself a domain object**:

```http
POST /users/123/bans
```

```json
{
  "reason": "abuse",
  "expires_at": "2026-09-01T12:00:00Z"
}
```

This exposes more useful semantics.

The lesson is not:

> Always turn verbs into nouns.

The lesson is:

> Understand the domain concept before choosing the interface representation.

---

# 27. A practical API-design process

For a new API, a useful sequence is:

## Step 1 — Identify consumers

Ask:

```text
Who will call this?
What do they already know?
What languages do they use?
Do we control those clients?
How long will they live?
```

---

## Step 2 — Identify use cases

Write concrete consumer tasks.

For example:

```text
Create an invoice.
Send it to a customer.
Record payment.
Cancel it.
List overdue invoices.
```

---

## Step 3 — Identify domain concepts

Potential concepts:

```text
invoice
customer
payment
cancellation
```

---

## Step 4 — Identify invariants

For example:

```text
A paid invoice cannot be deleted.
A payment amount must be positive.
An invoice has exactly one currency.
```

---

## Step 5 — Define the contract

Only now think about:

```text
URLs
methods
request schemas
response schemas
errors
```

---

## Step 6 — Test the abstraction

Ask:

```text
Could I completely replace the database without changing this API?
```

Not every implementation change should be invisible.

But if minor persistence changes constantly break your contract, the abstraction boundary is probably too weak.

---

# 28. API review questions

When reviewing an API, ask:

### Domain

* Does the vocabulary match the business domain?
* Are concepts understandable without knowing the database?
* Are operations represented at the correct level of abstraction?

### Consumer

* What does the consumer have to know?
* Is unnecessary implementation knowledge required?
* Is common usage straightforward?
* Are incorrect usages easy to make?

### Contract

* What behaviours are guaranteed?
* Are important semantics documented?
* Are errors predictable?
* Are identifiers stable?

### Evolution

* What happens when requirements change?
* What assumptions are clients likely to make?
* Can new cases be introduced without breaking existing consumers?

### Ownership

* Who maintains the API?
* Who owns the underlying concept?
* How are breaking changes communicated?

These questions are usually more valuable than arguing about whether a URL is perfectly RESTful.

---

# 29. Exercise: API autopsy

Consider:

```http
POST /api/getCustomer
```

Request:

```json
{
  "customer_db_id": 192
}
```

Response:

```json
{
  "first_name": "Alice",
  "last_name": "Smith",
  "status": 1,
  "customer_type": 3,
  "table_version": 7
}
```

Answer the following.

### Part A

Identify all implementation details that appear to leak through the interface.

### Part B

What implicit assumptions might consumers make?

### Part C

What questions are unanswered by this contract?

For example:

```text
What does status = 1 mean?
Can customer_type gain new values?
Is customer_db_id permanent?
Why does table_version matter?
```

### Part D

Redesign the interface.

Do not begin by changing:

```text
POST
```

to:

```text
GET
```

First identify what a **customer** means to the consumer.

---

# 30. Exercise: detect accidental coupling

Consider:

```http
GET /accounts
```

Response:

```json
[
  {
    "id": 10001,
    "owner": "Alice"
  },
  {
    "id": 10002,
    "owner": "Bob"
  }
]
```

The documentation says:

> Returns all accounts.

List assumptions clients may accidentally make.

Possible examples include:

* IDs are integers;
* IDs increase over time;
* results are sorted by ID;
* all accounts fit in one response;
* owner is unique;
* the list contains only active accounts;
* the same account never changes ID.

Which of these should become explicit contractual guarantees?

Which should clients be told not to rely on?

---

# 31. Exercise: design from the domain

You are designing an API for a university.

Requirements:

* students enrol in modules;
* modules have capacity limits;
* students may join a waitlist;
* some modules have prerequisites;
* timetable clashes can prevent enrolment;
* lecturers can approve exceptions.

Do **not** define endpoints yet.

First identify:

### Domain entities

For example:

```text
student
module
enrolment
waitlist entry
prerequisite
exception
```

### State transitions

For example:

```text
requested
enrolled
waitlisted
rejected
withdrawn
```

### Invariants

For example:

```text
A student cannot be enrolled twice.
Capacity cannot normally be exceeded.
A student must meet prerequisites unless an exception exists.
```

Only after describing the domain should you propose an API.

---

# 32. Coursework preparation

Before next week, select an API that you use regularly.

Possible examples:

```text
GitHub API
Stripe API
Spotify API
AWS API
Discord API
Slack API
a backend API from your workplace
```

Choose approximately five operations and analyse them.

For each one, answer:

1. What domain concept does the operation expose?
2. What information is hidden?
3. What information leaks through?
4. What assumptions can clients reasonably make?
5. What would be difficult for the provider to change?
6. Does the API feel designed from the consumer's perspective?
7. Which part of the contract is structural?
8. Which part is semantic?

The goal is not to decide whether the API is "good" or "bad."

The goal is to identify the design decisions embedded within it.

---

# 33. Key ideas

This chapter introduced several principles that will appear throughout the rest of the course.

### 1. APIs are contracts

They create expectations between providers and consumers.

### 2. Contracts are more than schemas

Behaviour, semantics, errors, timing, compatibility and operational expectations all matter.

### 3. Hide implementation details

Consumers should depend on domain concepts rather than persistence mechanics.

### 4. APIs create coupling

The aim is not zero coupling, but deliberate and stable coupling.

### 5. Consumers define the real cost of change

The more clients depend on an interface, the harder the interface becomes to change.

### 6. Observable behaviour matters

Consumers may depend on behaviour even if you did not intend them to.

### 7. API design starts with the domain

Do not begin with tables, HTTP methods or framework annotations.

Begin with concepts and use cases.

### 8. Compatibility is semantic

An API can remain syntactically identical while becoming behaviourally incompatible.

### 9. Internal APIs deserve design

Organisational boundaries do not make coupling disappear.

### 10. The real test of an abstraction is change

A good API allows implementations to evolve while preserving the concepts consumers legitimately depend on.

---

# Suggested reading

For this week, I would assign relatively little reading and spend more time on design discussion.

### Required

**Google API Improvement Proposal 121 — Resource-oriented design**

Focus on why API resources should represent meaningful concepts rather than simply mirroring database objects.

**Hyrum Wright — Hyrum's Law**

Consider what happens as the number of consumers of an interface grows.

### Recommended

**Brenda Jin, Saurabh Sahni, Amir Shevat — *Designing Web APIs***

Read the opening chapters on identifying users and treating APIs as products.

**Eric Evans — *Domain-Driven Design***

You do not need the entire book at this stage. Read enough to understand the ideas of domain models, ubiquitous language and bounded contexts.

**Martin Fowler — Published Interface**

Consider the difference between an interface that happens to exist and one that consumers are deliberately invited to depend upon.

---

# Closing thought

The most important habit to develop in API design is to stop asking:

> What endpoint should I create?

and instead ask:

> What promise should this system make to its consumers?

Once that promise is understood, endpoints, schemas and protocols become implementation choices.

Without that understanding, even a perfectly documented and perfectly typed API can still be badly designed.
