const crypto = require("node:crypto");

{
  /*
  The data is sent whenever a business action occurs in the mentoring workspace that requires notifying someone or sending an email. Specifically, 
  it is triggered during:
                                                                                                                                                   
  1. Connect Requests: When a mentee requests a mentorship session, or a mentor accepts/declines it (connectRequest.service.js:46).                
  2. Chat Messages: When a message is sent in chat and the recipient needs an unread message alert (messageSocket.js:58).                          
  3. Session Events: When a 1-on-1 session is booked, rescheduled, or cancelled (session.service.js:28).                                           
  4. Finance / Invoices: When an invoice or payout event is generated (internalFinance.controller.js:141). 


   sourceEventId: Unique idempotency key (prevents creating the exact same notification twice).
  • status: Starts as "pending". Once streamPublisher.publish(...) returns delivered: true, it updates to "delivered". If Redis fails, it 
  increments attempts and sets a retry delay.
  */
}

{
  /**
  #### 2. Why do consumers have to join a Group?
  
  Imagine you run 3 instances (workers) of the notifications-support service for high availability and scalability:
  
  • Without a Consumer Group (Normal Pub/Sub or raw Stream reading):
  Every single instance reads every single event.
  (Result: The user gets 3 duplicate emails and 3 duplicate notifications for a single session!)
  • WITH a Consumer Group:
  All instances join under the same group name: "notifications-support".
  Redis acts as a smart load balancer:
      • Event #1 goes to Worker 1 
      • Event #2 goes to Worker 2
      • Event #3 goes to Worker 3 
  No two workers in the same group ever receive the same message. 
   */
}

{
  /**
  ### 2. What happens under the hood? (The PEL - Pending Entries List)
  
  When a consumer reads a message via xReadGroup:
  
  1. Redis delivers the message to that worker.
  2. Redis does NOT mark it as done yet. Instead, Redis adds that message ID into a special internal list called the PEL (Pending Entries List).   
  3. The message stays in the PEL assigned to that worker until xAck is called.
  4. Calling client.xAck(streamName, groupName, record.id) removes the entry from the PEL.
  


  When you create a group (xGroupCreate), Redis creates two internal tracking structures inside memory for that stream:
  
  1. last_delivered_id (A group cursor / bookmark):
  Redis remembers the ID of the last message that was handed out to any worker in this group.
  2. The PEL (Pending Entries List):                                                          
  A table tracking which worker currently holds which message.


   #### Step 1: Worker 1 calls xReadGroup(..., id: ">") 
  
  Redis executes commands one by one (atomic): 
  
  1. Redis sees the special ID ">", which means: "Give me messages that come AFTER last_delivered_id".
  2. Redis hands Msg A to Worker 1.
  3. What gets saved in Redis right then:
      • Redis immediately advances last_delivered_id forward to Msg A.
      • Redis writes to its internal PEL: Msg A -> assigned to Worker 1 (Pending ACK).
  
  ──────
  #### Step 2: Worker 2 calls xReadGroup(..., id: ">") a microsecond later
  
  1. Redis checks last_delivered_id. It is already past Msg A!  
  2. Redis hands Msg B to Worker 2. 
  3. What gets saved in Redis right then:
      • Redis immediately advances last_delivered_id forward to Msg B.
      • Redis writes to its internal PEL: Msg B -> assigned to Worker 2 (Pending ACK).



      

       #### 1. Before xAck:
  
  When Worker 1 reads Message #101 via xReadGroup:
  
  • Redis adds a row to its internal PEL table:
    Pending Entries List (Group: notifications-support):
    ┌────────────┬───────────┬──────────────┬──────────────┐
    │ Message ID │ Consumer  │ Idle Time    │ Deliveries   │
    ├────────────┼───────────┼──────────────┼──────────────┤
    │    #101    │ Worker 1  │ 2 seconds    │ 1            │  <-- Still waiting!
    └────────────┴───────────┴──────────────┴──────────────┘
  As long as this row exists, Redis considers Message #101 "in-progress" / unconfirmed.
  
  #### 2. After xAck(streamName, groupName, "#101"):
  
  • Redis simply deletes that row from the PEL table:
    Pending Entries List (Group: notifications-support):
    ┌────────────┬───────────┬──────────────┬──────────────┐
    │ Message ID │ Consumer  │ Idle Time    │ Deliveries   │
    ├────────────┼───────────┼──────────────┼──────────────┤ 
    │  (EMPTY)   │           │              │              │  <-- Removed!
    └────────────┴───────────┴──────────────┴──────────────┘ 

   */
}

const createEventEnvelope = (event, correlationId) => ({
  // Keep the command fields at the top level while old readers are migrated.
  ...event,
  eventId: event.eventId || crypto.randomUUID(),
  eventType: event.eventType || "notification.requested",
  schemaVersion: 1,
  occurredAt: event.occurredAt || new Date().toISOString(),
  producer: "mentoring-workspace",
  correlationId: correlationId || event.correlationId || "not-provided",
  payload: event,
});

const createNotificationStreamPublisher = ({ client, streamName, enabled = false }) => ({
  connect: async () => {
    if (!enabled || client.isOpen) return enabled;
    client.on("error", (error) => process.stderr.write(`Notification stream error: ${error.message}\n`));
    await client.connect();
    return true;
  },
  publish: async (event, correlationId) => {
    if (!enabled || !client.isReady) return { delivered: false, skipped: true };
    const envelope = createEventEnvelope(event || {}, correlationId);
    //so here the x.Add needs the redis name and then * tells the redis that generate a unique id
    //then the last argument is the value field 
    await client.xAdd(streamName, "*", {
      // Keep sourceEventId as a stream field for simple inspection and old readers.
      sourceEventId: event.sourceEventId || envelope.eventId,
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      schemaVersion: String(envelope.schemaVersion),
      occurredAt: envelope.occurredAt,
      producer: envelope.producer,
      correlationId: envelope.correlationId,
      payload: JSON.stringify(envelope),
    }, { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 10000 } });
    return { delivered: true, transport: "redis-stream" };
  },
  close: async () => {
    if (client.isOpen) await client.quit();
  },
});

module.exports = createNotificationStreamPublisher;
