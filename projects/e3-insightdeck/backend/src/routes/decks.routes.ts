import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';

export const decksRouter = Router();

// GET /api/decks/:id — a deck with its insights (charts + headlines), ranked.
decksRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const deck = await prisma.deck.findUnique({
        where: { id: req.params.id },
        include: {
          insights: { orderBy: { rank: 'asc' } },
          dataset: { select: { id: true, name: true } },
        },
      });
      if (!deck) throw new HttpError(404, 'Deck not found');
      res.json(deck);
    } catch (err) {
      next(err);
    }
  },
);
