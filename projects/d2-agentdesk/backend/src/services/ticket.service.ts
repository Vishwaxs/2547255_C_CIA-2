import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';

export interface CreateTicketInput {
  customerId: string;
  subject: string;
  body: string;
}

export async function createTicket(input: CreateTicketInput) {
  return prisma.ticket.create({ data: input });
}

export async function listTickets(status?: string) {
  return prisma.ticket.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      customerId: true,
      subject: true,
      status: true,
      outcome: true,
      stepCount: true,
      runtimeMs: true,
      createdAt: true,
    },
  });
}

/** A ticket with its full ordered trace — the only read the trace view needs. */
export async function getTicketWithSteps(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  return ticket;
}

export async function deleteTicket(id: string) {
  try {
    await prisma.ticket.delete({ where: { id } });
  } catch {
    throw new HttpError(404, 'Ticket not found');
  }
}
