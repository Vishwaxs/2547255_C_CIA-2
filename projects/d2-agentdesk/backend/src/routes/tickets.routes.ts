import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import {
  createTicket,
  listTickets,
  getTicketWithSteps,
  deleteTicket,
} from '../services/ticket.service';
import { runTicket, seedDemo } from '../services/agent.service';

export const ticketsRouter = Router();

const createSchema = z.object({
  customerId: z.string().min(1).max(64),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

const STATUSES = ['open', 'resolved', 'escalated'];

// POST /api/tickets — create only. Running the agent is a separate, explicit action so the
// loop is something you watch happen rather than a side effect of filing a ticket.
ticketsRouter.post('/', validateBody(createSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createTicket(req.body as z.infer<typeof createSchema>));
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets?status=open|resolved|escalated
ticketsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = raw && STATUSES.includes(raw) ? raw : undefined;
    res.json(await listTickets(status));
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id — ticket plus its full ordered trace.
ticketsRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    res.json(await getTicketWithSteps(req.params.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets/:id/run — run or resume the agent loop. 409 if already finished.
ticketsRouter.post('/:id/run', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    res.json(await runTicket(req.params.id));
  } catch (err) {
    next(err);
  }
});

ticketsRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await deleteTicket(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/seed — mounted ahead of the :id routes in app.ts so "seed" is never read as an id.
export async function seedHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await seedDemo());
  } catch (err) {
    next(err);
  }
}
