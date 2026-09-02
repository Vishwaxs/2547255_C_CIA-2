import { env } from '../config/env';
import { DeliveryTransport } from './transport';
import { SinkTransport } from './sinkTransport';
import { HttpTransport } from './httpTransport';

export function transportFor(kind: string = env.TRANSPORT): DeliveryTransport {
  return kind === 'http' ? new HttpTransport() : new SinkTransport();
}
