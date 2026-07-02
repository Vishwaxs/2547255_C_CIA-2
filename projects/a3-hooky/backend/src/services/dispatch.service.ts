import { Prisma, Delivery, Event } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { signedHeaders } from '../engine/sign';
import { nextDelayMs } from '../engine/backoff';
import { transportFor } from '../transport/transportFactory';
import { DeliveryTransport } from '../transport/transport';
import { matchingSubscriptions } from './subscription.service';
import { HttpError } from '../middleware/errorHandler';

// Publish an event: persist it, then fan out one Delivery (status=pending, due now) per
// active subscription whose event-type list matches.
export async function publishEvent(input: {
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<{ event: Event; deliveryCount: number }> {
  const event = await prisma.event.create({
    data: {
      type: input.type,
      payload: input.payload as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
  const subs = await matchingSubscriptions(input.type);
  for (const s of subs) {
    await prisma.delivery.create({
      data: { eventId: event.id, subscriptionId: s.id, status: 'pending', nextAttemptAt: new Date() },
    });
  }
  return { event, deliveryCount: subs.length };
}

type DueDelivery = Delivery & {
  event: Event;
  subscription: { endpoint: string; mode: string; secret: string; maxAttempts: number };
};

async function attemptDelivery(d: DueDelivery, now: number, transport: DeliveryTransport): Promise<void> {
  const attempt = d.attempts + 1;
  const payload = JSON.stringify({ id: d.event.id, type: d.event.type, data: d.event.payload });
  const headers = signedHeaders({
    deliveryId: d.id,
    eventType: d.event.type,
    secret: d.subscription.secret,
    payload,
    timestamp: Math.floor(now / 1000),
  });

  const result = await transport.send(
    { url: d.subscription.endpoint, mode: d.subscription.mode, attempt },
    payload,
    headers,
  );

  await prisma.deliveryAttempt.create({
    data: {
      deliveryId: d.id,
      attempt,
      statusCode: result.statusCode ?? null,
      ok: result.ok,
      durationMs: result.durationMs,
      error: result.error ?? null,
      at: new Date(now),
    },
  });

  if (result.ok) {
    await prisma.delivery.update({
      where: { id: d.id },
      data: { status: 'delivered', attempts: attempt, deliveredAt: new Date(now), lastError: null },
    });
  } else if (attempt >= d.subscription.maxAttempts) {
    await prisma.delivery.update({
      where: { id: d.id },
      data: { status: 'dead', attempts: attempt, lastError: result.error ?? 'failed' },
    });
  } else {
    const delay = nextDelayMs(attempt, env.RETRY_BASE_MS, env.RETRY_CAP_MS);
    await prisma.delivery.update({
      where: { id: d.id },
      data: {
        status: 'retrying',
        attempts: attempt,
        nextAttemptAt: new Date(now + delay),
        lastError: result.error ?? 'failed',
      },
    });
  }
}

// Process every delivery that is due (pending/retrying with nextAttemptAt <= now). Each
// attempt is signed, sent via the transport, logged, and the delivery advances to
// delivered / retrying (with backoff) / dead (at maxAttempts). `now` is injectable so
// backoff timing is testable without real waits.
export async function processDue(now: number = Date.now(), limit = 100): Promise<number> {
  const due = (await prisma.delivery.findMany({
    where: { status: { in: ['pending', 'retrying'] }, nextAttemptAt: { lte: new Date(now) } },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
    include: {
      event: true,
      subscription: { select: { endpoint: true, mode: true, secret: true, maxAttempts: true } },
    },
  })) as unknown as DueDelivery[];

  const transport = transportFor();
  for (const d of due) await attemptDelivery(d, now, transport);
  return due.length;
}

// Replay a delivery: start a fresh run with a full retry budget (prior attempts stay in
// the log). Useful for reviving a dead-lettered delivery after the endpoint is fixed.
export async function replay(id: string): Promise<Delivery> {
  const existing = await prisma.delivery.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Delivery not found');
  return prisma.delivery.update({
    where: { id },
    data: { status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null, deliveredAt: null },
  });
}
