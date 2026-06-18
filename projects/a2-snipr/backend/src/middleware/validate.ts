import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// Validate and coerce a JSON body against a Zod schema. On failure it returns a
// 400 with the flattened field errors; on success it replaces req.body with the
// parsed (typed, stripped) value so handlers never see unvalidated input.
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'ValidationError',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    return next();
  };
}
